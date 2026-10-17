-- Migration: 20261016235000_update_compare_agendas_horario_alterado.sql
-- Descrição: Ajusta compare_agendas para realizar matching por paciente + dia_semana (ignorando horario),
-- evitando falsos positivos duplos (AUSENTE + PACIENTE_NOVO) e identificando HORARIO_ALTERADO.

CREATE OR REPLACE FUNCTION public.compare_agendas(
  p_turma_id uuid,
  p_mes_referencia date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec_fixa RECORD;
  rec_mensal RECORD;
  v_match_mensal RECORD;
  v_match_fixa RECORD;
  v_total_ausentes integer := 0;
  v_total_trocados integer := 0;
  v_total_novos integer := 0;
  v_total_horario_alterado integer := 0;
BEGIN
  -- 1. Limpa inconsistências prévias desta turma e mês
  DELETE FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 2. Itera sobre cada registro de agenda_fixa da turma (somente tipo 'paciente')
  FOR rec_fixa IN
    SELECT af.id, af.paciente, af.aluno_id, af.horario, af.dia_semana,
           aa.nome AS aluno_nome
    FROM public.agenda_fixa af
    LEFT JOIN public.agenda_alunos aa ON aa.id = af.aluno_id
    WHERE af.turma_id = p_turma_id
      AND af.tipo_registro = 'paciente'
  LOOP
    -- Busca correspondente em agenda_mensal no mesmo dia_semana (IGNORANDO HORARIO) por similaridade de nome >= 0.4
    SELECT am.id, am.paciente, am.aluno_id, am.horario,
           COALESCE(aa_m.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    INTO v_match_mensal
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa_m ON aa_m.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
      AND upper(trim(am.dia_semana)) = upper(trim(rec_fixa.dia_semana))
      AND similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
    ORDER BY similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) DESC
    LIMIT 1;

    IF v_match_mensal IS NULL THEN
      -- Paciente da fixa não compareceu em nenhum horário naquele dia da semana
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
      ) VALUES (
        'AUSENTE', rec_fixa.paciente, rec_fixa.aluno_nome, NULL, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE', NULL
      );
      v_total_ausentes := v_total_ausentes + 1;
    ELSE
      -- Paciente encontrado no mensal no mesmo dia!
      -- 2.1 Verifica se o horário mudou
      IF rec_fixa.horario <> v_match_mensal.horario THEN
        INSERT INTO public.inconsistencias (
          tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
        ) VALUES (
          'HORARIO_ALTERADO', rec_fixa.paciente, rec_fixa.aluno_nome, v_match_mensal.aluno_nome, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE',
          to_char(rec_fixa.horario, 'HH24:MI') || ' ➔ ' || to_char(v_match_mensal.horario, 'HH24:MI')
        );
        v_total_horario_alterado := v_total_horario_alterado + 1;
      END IF;

      -- 2.2 Verifica se o aluno responsável mudou
      IF v_match_mensal.aluno_id IS DISTINCT FROM rec_fixa.aluno_id THEN
        INSERT INTO public.inconsistencias (
          tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
        ) VALUES (
          'ALUNO_TROCADO', rec_fixa.paciente, rec_fixa.aluno_nome, v_match_mensal.aluno_nome, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE', NULL
        );
        v_total_trocados := v_total_trocados + 1;
      END IF;
    END IF;
  END LOOP;

  -- 3. Itera sobre cada registro de agenda_mensal para identificar PACIENTE_NOVO
  -- (paciente que não consta em nenhum horário na agenda fixa daquele dia da semana)
  FOR rec_mensal IN
    SELECT am.id, am.paciente, am.aluno_id, am.horario, am.dia_semana,
           COALESCE(aa.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa ON aa.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
  LOOP
    -- Busca se existe correspondente na fixa naquele dia da semana (IGNORANDO HORARIO)
    SELECT af.id
    INTO v_match_fixa
    FROM public.agenda_fixa af
    WHERE af.turma_id = p_turma_id
      AND af.tipo_registro = 'paciente'
      AND upper(trim(af.dia_semana)) = upper(trim(rec_mensal.dia_semana))
      AND similarity(normalizar_nome(af.paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
    LIMIT 1;

    IF v_match_fixa IS NULL THEN
      -- Paciente do mensal realmente novo (não está em nenhum horário na fixa daquele dia)
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
      ) VALUES (
        'PACIENTE_NOVO', rec_mensal.paciente, NULL, rec_mensal.aluno_nome, rec_mensal.horario, rec_mensal.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE', NULL
      );
      v_total_novos := v_total_novos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ausentes', v_total_ausentes,
    'trocados', v_total_trocados,
    'novos', v_total_novos,
    'horario_alterado', v_total_horario_alterado,
    'total', (v_total_ausentes + v_total_trocados + v_total_novos + v_total_horario_alterado)
  );
END;
$$;
