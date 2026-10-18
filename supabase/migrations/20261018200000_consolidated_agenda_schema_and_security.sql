-- ==============================================================================
-- MIGRAÇÃO CONSOLIDADA: AGENDA SCHEMA, DUPLAS ESP2, BLOQUEIOS E SEGURANÇA
-- Arquivo: supabase/migrations/20261018200000_consolidated_agenda_schema_and_security.sql
-- 
-- Conteúdo:
-- 1. Criação idempotente de colunas (agenda_fixa, agenda_mensal, agenda_alunos)
-- 2. Atualização idempotente dos membros das duplas e inativação de legados da ESP2
-- 3. Backfill idempotente de bloqueios com prefixo ([SEQUENCIA], [LIVRE], [OUTRO])
-- 4. Função compare_agendas (search_path public, regex paciente, retorno completo)
-- 5. Função mesclar_alunos (search_path public, checagem de papel coordenador/admin_master)
-- 6. Configuração de permissões: REVOKE de PUBLIC/anon e GRANT para authenticated/service_role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CRIAÇÃO DE COLUNAS (IF NOT EXISTS)
-- ------------------------------------------------------------------------------

-- Colunas na tabela agenda_fixa
ALTER TABLE public.agenda_fixa
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'paciente',
  ADD COLUMN IF NOT EXISTS tipo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS aluno TEXT DEFAULT NULL;

COMMENT ON COLUMN public.agenda_fixa.tipo_bloqueio IS 'Tipo do bloqueio: SEQUENCIA, LIVRE ou OUTRO';
COMMENT ON COLUMN public.agenda_fixa.aluno IS 'Nome textual do aluno para atendimentos virtuais como ATENDIMENTO EXTRA';

-- Colunas na tabela agenda_mensal
ALTER TABLE public.agenda_mensal
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'paciente',
  ADD COLUMN IF NOT EXISTS tipo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS aluno TEXT DEFAULT NULL;

COMMENT ON COLUMN public.agenda_mensal.tipo_registro IS 'Tipo do registro mensal: paciente ou bloqueio';
COMMENT ON COLUMN public.agenda_mensal.tipo_bloqueio IS 'Tipo do bloqueio mensal: SEQUENCIA, LIVRE ou OUTRO';
COMMENT ON COLUMN public.agenda_mensal.aluno IS 'Nome textual do aluno para atendimentos virtuais como ATENDIMENTO EXTRA';

-- Colunas na tabela agenda_alunos
ALTER TABLE public.agenda_alunos
  ADD COLUMN IF NOT EXISTS membros TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.agenda_alunos.membros IS 'Lista de membros que compõem a dupla (ex: ARRAY[''Gabriel'', ''João''])';


-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO DAS DUPLAS E INATIVAÇÃO DE LEGADOS DA ESP2
-- ------------------------------------------------------------------------------

-- Atualização das 4 duplas ativas na turma ESP2 (turma_id: 9baa41ed-8c13-4a27-8e32-459987545305)
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

-- Inativação de alunos legados sem atendimentos vinculados na ESP2
-- (Mantém DUDA da ESP1 ativa e intocada)
UPDATE public.agenda_alunos
SET ativo = false
WHERE turma_id = '9baa41ed-8c13-4a27-8e32-459987545305'
  AND id IN (
    '229e0cd8-0cff-48a4-9a36-9dd3bfd576e4', -- Adriele
    '7a1d2024-e612-4455-a9aa-cafb864ad8be', -- Atendimento Extra (registro físico)
    'fad700ad-ad89-45be-a6ae-0c51205898c4', -- Dr. Fernando Rocha
    'b2920749-08a8-4135-be9d-765fc842e19e'  -- Dra. Patricia Pillar
  );


-- ------------------------------------------------------------------------------
-- 3. BACKFILL IDEMPOTENTE DE BLOQUEIOS COM PREFIXO
-- ------------------------------------------------------------------------------

-- Agenda Fixa: [SEQUENCIA]
UPDATE public.agenda_fixa
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'SEQUENCIA',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[SEQUENCIA\]\s*', '', 'i')), ''), 'Continuação'),
    updated_at = now()
WHERE paciente ~* '^\s*\[SEQUENCIA\]';

-- Agenda Fixa: [LIVRE]
UPDATE public.agenda_fixa
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'LIVRE',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[LIVRE\]\s*', '', 'i')), ''), 'Horário Livre'),
    updated_at = now()
WHERE paciente ~* '^\s*\[LIVRE\]';

-- Agenda Fixa: [OUTRO]
UPDATE public.agenda_fixa
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'OUTRO',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[OUTRO\]\s*', '', 'i')), ''), 'Bloqueado'),
    updated_at = now()
WHERE paciente ~* '^\s*\[OUTRO\]';

-- Agenda Mensal: [SEQUENCIA] (sem updated_at pois a coluna não existe nesta tabela)
UPDATE public.agenda_mensal
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'SEQUENCIA',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[SEQUENCIA\]\s*', '', 'i')), ''), 'Continuação')
WHERE paciente ~* '^\s*\[SEQUENCIA\]';

-- Agenda Mensal: [LIVRE]
UPDATE public.agenda_mensal
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'LIVRE',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[LIVRE\]\s*', '', 'i')), ''), 'Horário Livre')
WHERE paciente ~* '^\s*\[LIVRE\]';

-- Agenda Mensal: [OUTRO]
UPDATE public.agenda_mensal
SET tipo_registro = 'bloqueio',
    tipo_bloqueio = 'OUTRO',
    paciente = COALESCE(NULLIF(trim(regexp_replace(paciente, '^\s*\[OUTRO\]\s*', '', 'i')), ''), 'Bloqueado')
WHERE paciente ~* '^\s*\[OUTRO\]';


-- ------------------------------------------------------------------------------
-- 4. FUNÇÃO compare_agendas
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compare_agendas(
  p_turma_id uuid,
  p_mes_referencia date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 3. Itera sobre cada registro de agenda_fixa da turma (somente tipo paciente e não bloqueios)
  FOR rec_fixa IN
    SELECT af.id, af.paciente, af.aluno_id, af.horario, af.dia_semana,
           COALESCE(aa.nome, af.aluno, 'ATENDIMENTO EXTRA') AS aluno_nome
    FROM public.agenda_fixa af
    LEFT JOIN public.agenda_alunos aa ON aa.id = af.aluno_id
    WHERE af.turma_id = p_turma_id
      AND COALESCE(af.tipo_registro, 'paciente') = 'paciente'
      AND af.paciente !~ '^\s*\['
      AND lower(trim(af.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(af.paciente)) NOT LIKE 'bloqueio%'
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
      AND COALESCE(am.tipo_registro, 'paciente') = 'paciente'
      AND am.paciente !~ '^\s*\['
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
      -- 3.1 Verifica se o horário mudou (independente de quem é o aluno)
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

      -- 3.2 Verifica se o aluno responsável mudou (verificação independente comparando aluno_id)
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
      AND am.paciente !~ '^\s*\['
      AND lower(trim(am.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(am.paciente)) NOT LIKE 'bloqueio%'
  LOOP
    -- Busca se existe correspondente na fixa naquele dia da semana (IGNORANDO HORARIO)
    SELECT af.id
    INTO v_match_fixa
    FROM public.agenda_fixa af
    WHERE af.turma_id = p_turma_id
      AND COALESCE(af.tipo_registro, 'paciente') = 'paciente'
      AND af.paciente !~ '^\s*\['
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

  -- 5. Retorno com formato completo para total compatibilidade
  RETURN jsonb_build_object(
    'success', true,
    'turma_id', p_turma_id,
    'mes_referencia', p_mes_referencia,
    'ausentes', v_total_ausentes,
    'trocados', v_total_trocados,
    'novos', v_total_novos,
    'horario_alterado', v_total_horario_alterado,
    'total', (v_total_ausentes + v_total_trocados + v_total_novos + v_total_horario_alterado),
    'total_ausentes', v_total_ausentes,
    'total_trocados', v_total_trocados,
    'total_novos', v_total_novos,
    'total_horario_alterado', v_total_horario_alterado
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. FUNÇÃO mesclar_alunos
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mesclar_alunos(
  p_aluno_oficial_id uuid,
  p_aluno_duplicado_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma_oficial uuid;
  v_turma_duplicado uuid;
  v_nome_oficial text;
  v_nome_duplicado text;
  v_fixa_count integer := 0;
  v_mensal_count integer := 0;
BEGIN
  -- Checagem de papel de segurança: apenas coordenador, admin_master ou service_role
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND papel IN ('coordenador', 'admin_master')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas coordenador ou administrador podem mesclar alunos.';
  END IF;

  -- 1. Validações básicas
  IF p_aluno_oficial_id IS NULL OR p_aluno_duplicado_id IS NULL THEN
    RAISE EXCEPTION 'IDs dos alunos não podem ser nulos.';
  END IF;

  IF p_aluno_oficial_id = p_aluno_duplicado_id THEN
    RAISE EXCEPTION 'Não é possível mesclar um aluno com ele mesmo.';
  END IF;

  SELECT turma_id, nome INTO v_turma_oficial, v_nome_oficial
  FROM public.agenda_alunos
  WHERE id = p_aluno_oficial_id;

  IF v_turma_oficial IS NULL THEN
    RAISE EXCEPTION 'Aluno oficial não encontrado.';
  END IF;

  SELECT turma_id, nome INTO v_turma_duplicado, v_nome_duplicado
  FROM public.agenda_alunos
  WHERE id = p_aluno_duplicado_id;

  IF v_turma_duplicado IS NULL THEN
    RAISE EXCEPTION 'Aluno duplicado não encontrado.';
  END IF;

  IF v_turma_oficial IS DISTINCT FROM v_turma_duplicado THEN
    RAISE EXCEPTION 'Os alunos pertencem a turmas diferentes e não podem ser mesclados.';
  END IF;

  -- 2. Reatribui agenda_fixa
  WITH updated_fixa AS (
    UPDATE public.agenda_fixa
    SET aluno_id = p_aluno_oficial_id,
        updated_at = now()
    WHERE aluno_id = p_aluno_duplicado_id
    RETURNING id
  )
  SELECT count(*) INTO v_fixa_count FROM updated_fixa;

  -- 3. Reatribui agenda_mensal (remove antes duplicatas idênticas para não violar uq_agenda_mensal)
  DELETE FROM public.agenda_mensal m_dup
  WHERE m_dup.aluno_id = p_aluno_duplicado_id
    AND EXISTS (
      SELECT 1 FROM public.agenda_mensal m_ofic
      WHERE m_ofic.turma_id = m_dup.turma_id
        AND m_ofic.mes_referencia = m_dup.mes_referencia
        AND m_ofic.paciente = m_dup.paciente
        AND m_ofic.horario = m_dup.horario
        AND m_ofic.dia_semana = m_dup.dia_semana
        AND m_ofic.aluno_id = p_aluno_oficial_id
    );

  WITH updated_mensal AS (
    UPDATE public.agenda_mensal
    SET aluno_id = p_aluno_oficial_id
    WHERE aluno_id = p_aluno_duplicado_id
    RETURNING id
  )
  SELECT count(*) INTO v_mensal_count FROM updated_mensal;

  -- 4. Exclui o aluno duplicado
  DELETE FROM public.agenda_alunos
  WHERE id = p_aluno_duplicado_id;

  -- 5. Retorna o resumo da mesclagem
  RETURN jsonb_build_object(
    'success', true,
    'aluno_oficial_id', p_aluno_oficial_id,
    'nome_oficial', v_nome_oficial,
    'aluno_duplicado_id', p_aluno_duplicado_id,
    'nome_duplicado', v_nome_duplicado,
    'fixa_migrados', v_fixa_count,
    'mensal_migrados', v_mensal_count
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. PERMISSÕES DE EXECUÇÃO (REVOKE E GRANT)
-- ------------------------------------------------------------------------------

-- compare_agendas
REVOKE ALL ON FUNCTION public.compare_agendas(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compare_agendas(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.compare_agendas(uuid, date) TO authenticated, service_role;

-- mesclar_alunos
REVOKE ALL ON FUNCTION public.mesclar_alunos(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mesclar_alunos(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mesclar_alunos(uuid, uuid) TO authenticated, service_role;

-- ==============================================================================
-- FIM DA MIGRAÇÃO CONSOLIDADA
-- ==============================================================================
