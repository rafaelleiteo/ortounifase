
ALTER TABLE public.agenda_mensal
ADD COLUMN IF NOT EXISTS aluno text;

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
BEGIN
  -- 1. Limpa inconsistências prévias desta turma e mês
  DELETE FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 2. Itera sobre cada registro de agenda_fixa da turma (somente registros do tipo paciente)
  FOR rec_fixa IN
    SELECT af.id, af.paciente, af.aluno_id, af.horario, af.dia_semana,
           aa.nome AS aluno_nome
    FROM public.agenda_fixa af
    LEFT JOIN public.agenda_alunos aa ON aa.id = af.aluno_id
    WHERE af.turma_id = p_turma_id
      AND af.tipo_registro = 'paciente'
  LOOP
    -- Busca correspondente em agenda_mensal no mesmo horário, dia_semana e similaridade de nome >= 0.4
    SELECT am.id, am.paciente, am.aluno_id, COALESCE(aa_m.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    INTO v_match_mensal
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa_m ON aa_m.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
      AND am.horario = rec_fixa.horario
      AND upper(trim(am.dia_semana)) = upper(trim(rec_fixa.dia_semana))
      AND similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
    ORDER BY similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) DESC
    LIMIT 1;

    IF v_match_mensal IS NULL THEN
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'AUSENTE', rec_fixa.paciente, rec_fixa.aluno_nome, NULL, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_ausentes := v_total_ausentes + 1;
    ELSIF v_match_mensal.aluno_id IS DISTINCT FROM rec_fixa.aluno_id THEN
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'ALUNO_TROCADO', rec_fixa.paciente, rec_fixa.aluno_nome, v_match_mensal.aluno_nome, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_trocados := v_total_trocados + 1;
    END IF;
  END LOOP;

  -- 3. Itera sobre cada registro de agenda_mensal para identificar PACIENTE_NOVO
  FOR rec_mensal IN
    SELECT am.id, am.paciente, am.aluno_id, am.horario, am.dia_semana,
           COALESCE(aa.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa ON aa.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
  LOOP
    SELECT af.id
    INTO v_match_fixa
    FROM public.agenda_fixa af
    WHERE af.turma_id = p_turma_id
      AND af.tipo_registro = 'paciente'
      AND af.horario = rec_mensal.horario
      AND upper(trim(af.dia_semana)) = upper(trim(rec_mensal.dia_semana))
      AND similarity(normalizar_nome(af.paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
    LIMIT 1;

    IF v_match_fixa IS NULL THEN
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'PACIENTE_NOVO', rec_mensal.paciente, NULL, rec_mensal.aluno_nome, rec_mensal.horario, rec_mensal.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_novos := v_total_novos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ausentes', v_total_ausentes,
    'trocados', v_total_trocados,
    'novos', v_total_novos,
    'total', (v_total_ausentes + v_total_trocados + v_total_novos)
  );
END;
$$;
