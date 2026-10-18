-- Migration: 20261018120000_esp2_duplas_and_atendimento_extra.sql
-- Descrição:
-- 1. Adiciona coluna membros text[] na tabela agenda_alunos.
-- 2. Adiciona coluna aluno text na tabela agenda_fixa.
-- 3. Atualiza os 4 registros de duplas da ESP2 com seus respectivos membros.
-- 4. Desativa registros legados sem atendimentos da ESP2 ('Adriele', 'Dr. Fernando Rocha', 'Dra. Patricia Pillar', 'Atendimento Extra').
-- 5. Atualiza compare_agendas para garantir COALESCE(aa.nome, af.aluno, 'ATENDIMENTO EXTRA') na agenda_fixa.

ALTER TABLE public.agenda_alunos
ADD COLUMN IF NOT EXISTS membros TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.agenda_alunos.membros IS 'Lista de membros individuais da dupla ou aluno (ex: ARRAY[''Gabriel'', ''João''])';

ALTER TABLE public.agenda_fixa
ADD COLUMN IF NOT EXISTS aluno TEXT DEFAULT NULL;

COMMENT ON COLUMN public.agenda_fixa.aluno IS 'Nome do aluno para registros virtuais como ATENDIMENTO EXTRA quando aluno_id é NULL';

-- Atualiza membros das 4 duplas na ESP2
UPDATE public.agenda_alunos
SET membros = ARRAY['Gabriel', 'João']
WHERE id = 'f67d3f05-2d0f-432b-bf48-9c1ee0a85678';

UPDATE public.agenda_alunos
SET membros = ARRAY['Leticia', 'Duda']
WHERE id = 'e89459c3-d9dc-4de3-853e-23b02d4f0fb8';

UPDATE public.agenda_alunos
SET membros = ARRAY['Camila', 'Marcela']
WHERE id = '72ca113c-ef99-4d9e-9630-16e8e87b7aea';

UPDATE public.agenda_alunos
SET membros = ARRAY['Carla', 'Mauro']
WHERE id = 'b8d0e63e-484b-46bf-9409-6204d9baed4f';

-- Desativa os registros legados sem atendimentos na ESP2
UPDATE public.agenda_alunos
SET ativo = false
WHERE turma_id = '9baa41ed-8c13-4a27-8e32-459987545305'
  AND id IN (
    '229e0cd8-0cff-48a4-9a36-9dd3bfd576e4', -- Adriele
    '7a1d2024-e612-4455-a9aa-cafb864ad8be', -- Atendimento Extra físico
    'fad700ad-ad89-45be-a6ae-0c51205898c4', -- Dr. Fernando Rocha
    'b2920749-08a8-4135-be9d-765fc842e19e'  -- Dra. Patricia Pillar
  );

-- Atualiza compare_agendas
CREATE OR REPLACE FUNCTION public.compare_agendas(
  p_turma_id uuid,
  p_mes_referencia date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  rec_fixa RECORD;
  rec_mensal RECORD;
  v_match_mensal RECORD;
  v_match_fixa RECORD;
  v_total_ausentes integer := 0;
  v_total_trocados integer := 0;
  v_total_novos integer := 0;
  v_total_horario_alterado integer := 0;
  v_prev_status text;
  v_prev_obs text;
BEGIN
  -- 1. Cria tabela temporária para reter status e observações previamente definidos pelo coordenador
  CREATE TEMP TABLE IF NOT EXISTS tmp_prev_inconsistencias (
    tipo text,
    paciente text,
    dia_semana text,
    status text,
    observacao text
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_prev_inconsistencias;

  INSERT INTO tmp_prev_inconsistencias (tipo, paciente, dia_semana, status, observacao)
  SELECT tipo, paciente, dia_semana, status, observacao
  FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 2. Limpa inconsistências prévias desta turma e mês
  DELETE FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 3. Itera sobre cada registro de agenda_fixa da turma (somente tipo 'paciente' e não bloqueios)
  FOR rec_fixa IN
    SELECT af.id, af.paciente, af.aluno_id, af.horario, af.dia_semana,
           COALESCE(aa.nome, af.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    FROM public.agenda_fixa af
    LEFT JOIN public.agenda_alunos aa ON aa.id = af.aluno_id
    WHERE af.turma_id = p_turma_id
      AND COALESCE(af.tipo_registro, 'paciente') = 'paciente'
      AND af.paciente NOT LIKE '[%]'
      AND lower(trim(af.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(af.paciente)) NOT LIKE 'bloqueio%'
  LOOP
    -- Busca correspondente em agenda_mensal no mesmo dia_semana (IGNORANDO HORARIO) por similaridade de nome >= 0.4
    -- Ignorando registros que sejam bloqueios na mensal
    SELECT am.id, am.paciente, am.aluno_id, am.horario,
           COALESCE(aa_m.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    INTO v_match_mensal
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa_m ON aa_m.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
      AND upper(trim(am.dia_semana)) = upper(trim(rec_fixa.dia_semana))
      AND COALESCE(am.tipo_registro, 'paciente') = 'paciente'
      AND am.paciente NOT LIKE '[%]'
      AND lower(trim(am.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(am.paciente)) NOT LIKE 'bloqueio%'
      AND similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
    ORDER BY similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) DESC
    LIMIT 1;

    IF v_match_mensal IS NULL THEN
      -- Paciente da fixa não compareceu em nenhum horário naquele dia da semana (AUSENTE)
      SELECT status, observacao
      INTO v_prev_status, v_prev_obs
      FROM tmp_prev_inconsistencias
      WHERE tipo = 'AUSENTE'
        AND upper(trim(dia_semana)) = upper(trim(rec_fixa.dia_semana))
        AND similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
      ORDER BY similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) DESC
      LIMIT 1;

      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
      ) VALUES (
        'AUSENTE',
        rec_fixa.paciente,
        rec_fixa.aluno_nome,
        NULL,
        rec_fixa.horario,
        rec_fixa.dia_semana,
        p_turma_id,
        p_mes_referencia,
        COALESCE(v_prev_status, 'PENDENTE'),
        v_prev_obs
      );
      v_total_ausentes := v_total_ausentes + 1;
    ELSE
      -- Paciente encontrado no mensal no mesmo dia!
      -- 3.1 Verifica se o horário mudou
      IF rec_fixa.horario <> v_match_mensal.horario THEN
        SELECT status, observacao
        INTO v_prev_status, v_prev_obs
        FROM tmp_prev_inconsistencias
        WHERE tipo = 'HORARIO_ALTERADO'
          AND upper(trim(dia_semana)) = upper(trim(rec_fixa.dia_semana))
          AND similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
        ORDER BY similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) DESC
        LIMIT 1;

        INSERT INTO public.inconsistencias (
          tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
        ) VALUES (
          'HORARIO_ALTERADO',
          rec_fixa.paciente,
          rec_fixa.aluno_nome,
          v_match_mensal.aluno_nome,
          rec_fixa.horario,
          rec_fixa.dia_semana,
          p_turma_id,
          p_mes_referencia,
          COALESCE(v_prev_status, 'PENDENTE'),
          COALESCE(v_prev_obs, to_char(rec_fixa.horario, 'HH24:MI') || ' ➔ ' || to_char(v_match_mensal.horario, 'HH24:MI'))
        );
        v_total_horario_alterado := v_total_horario_alterado + 1;
      END IF;

      -- 3.2 Verifica se o aluno responsável mudou
      IF v_match_mensal.aluno_id IS DISTINCT FROM rec_fixa.aluno_id THEN
        SELECT status, observacao
        INTO v_prev_status, v_prev_obs
        FROM tmp_prev_inconsistencias
        WHERE tipo = 'ALUNO_TROCADO'
          AND upper(trim(dia_semana)) = upper(trim(rec_fixa.dia_semana))
          AND similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
        ORDER BY similarity(normalizar_nome(paciente), normalizar_nome(rec_fixa.paciente)) DESC
        LIMIT 1;

        INSERT INTO public.inconsistencias (
          tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
        ) VALUES (
          'ALUNO_TROCADO',
          rec_fixa.paciente,
          rec_fixa.aluno_nome,
          v_match_mensal.aluno_nome,
          rec_fixa.horario,
          rec_fixa.dia_semana,
          p_turma_id,
          p_mes_referencia,
          COALESCE(v_prev_status, 'PENDENTE'),
          v_prev_obs
        );
        v_total_trocados := v_total_trocados + 1;
      END IF;
    END IF;
  END LOOP;

  -- 4. Itera sobre cada registro de agenda_mensal para identificar PACIENTE_NOVO (ignorando bloqueios)
  FOR rec_mensal IN
    SELECT am.id, am.paciente, am.aluno_id, am.horario, am.dia_semana,
           COALESCE(aa.nome, am.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa ON aa.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
      AND COALESCE(am.tipo_registro, 'paciente') = 'paciente'
      AND am.paciente NOT LIKE '[%]'
      AND lower(trim(am.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(am.paciente)) NOT LIKE 'bloqueio%'
  LOOP
    -- Busca se existe correspondente na fixa naquele dia da semana (IGNORANDO HORARIO)
    SELECT af.id
    INTO v_match_fixa
    FROM public.agenda_fixa af
    WHERE af.turma_id = p_turma_id
      AND COALESCE(af.tipo_registro, 'paciente') = 'paciente'
      AND af.paciente NOT LIKE '[%]'
      AND lower(trim(af.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(af.paciente)) NOT LIKE 'bloqueio%'
      AND upper(trim(af.dia_semana)) = upper(trim(rec_mensal.dia_semana))
      AND similarity(normalizar_nome(af.paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
    LIMIT 1;

    IF v_match_fixa IS NULL THEN
      SELECT status, observacao
      INTO v_prev_status, v_prev_obs
      FROM tmp_prev_inconsistencias
      WHERE tipo = 'PACIENTE_NOVO'
        AND upper(trim(dia_semana)) = upper(trim(rec_mensal.dia_semana))
        AND similarity(normalizar_nome(paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
      ORDER BY similarity(normalizar_nome(paciente), normalizar_nome(rec_mensal.paciente)) DESC
      LIMIT 1;

      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status, observacao
      ) VALUES (
        'PACIENTE_NOVO',
        rec_mensal.paciente,
        NULL,
        rec_mensal.aluno_nome,
        rec_mensal.horario,
        rec_mensal.dia_semana,
        p_turma_id,
        p_mes_referencia,
        COALESCE(v_prev_status, 'PENDENTE'),
        v_prev_obs
      );
      v_total_novos := v_total_novos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_ausentes', v_total_ausentes,
    'total_trocados', v_total_trocados,
    'total_novos', v_total_novos,
    'total_horario_alterado', v_total_horario_alterado
  );
END;
$func$;
