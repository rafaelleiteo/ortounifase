-- ==============================================================================
-- MIGRATION: 20261110120000_compare_agendas_canonicalizar_dia.sql
-- DESCRICAO: Canonicaliza dia_semana na funcao compare_agendas para reconhecer
--            variacoes de acento (Sabado vs SÁBADO), caixa e abreviacoes.
--
-- ROLLBACK MANUAL:
--   Caso seja necessario reverter, execute a definicao anterior presente em:
--   supabase/migrations/20261018200000_consolidated_agenda_schema_and_security.sql
-- ==============================================================================

-- 1. Funcao pura auxiliar no PostgreSQL para canonicalizacao de dia da semana
CREATE OR REPLACE FUNCTION public.canonicalizar_dia(p_dia text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_dia IS NULL THEN NULL
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^SAB(ADO)?(\.|\b)?' THEN 'SABADO'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^SEX(TA)?(\.|\b)?' THEN 'SEXTA'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^QUI(NTA)?(\.|\b)?' THEN 'QUINTA'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^QUA(RTA)?(\.|\b)?' THEN 'QUARTA'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^TER(CA)?(\.|\b)?' THEN 'TERCA'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^SEG(UNDA)?(\.|\b)?' THEN 'SEGUNDA'
    WHEN translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC') ~ '^DOM(INGO)?(\.|\b)?' THEN 'DOMINGO'
    ELSE translate(upper(trim(p_dia)), 'ÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'AAAAEEEIIIOOOUUUC')
  END;
$$;

-- 2. Atualiza compare_agendas utilizando canonicalizar_dia na comparacao de dias
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
  -- 1. Cria tabela temporaria para reter status e observacoes previamente definidos pelo coordenador
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

  -- 2. Limpa inconsistencias previas desta turma e mes
  DELETE FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 3. Itera sobre cada registro de agenda_fixa da turma (somente tipo paciente e nao bloqueios)
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
      AND public.canonicalizar_dia(am.dia_semana) = public.canonicalizar_dia(rec_fixa.dia_semana)
      AND COALESCE(am.tipo_registro, 'paciente') = 'paciente'
      AND am.paciente !~ '^\s*\['
      AND lower(trim(am.paciente)) NOT IN ('horário livre', 'livre')
      AND lower(trim(am.paciente)) NOT LIKE 'bloqueio%'
      AND similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
    ORDER BY similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) DESC
    LIMIT 1;

    IF v_match_mensal IS NULL THEN
      -- Paciente da fixa nao compareceu em nenhum horario naquele dia da semana (AUSENTE)
      SELECT status, observacao
      INTO v_prev_status, v_prev_obs
      FROM tmp_prev_inconsistencias
      WHERE tipo = 'AUSENTE'
        AND public.canonicalizar_dia(dia_semana) = public.canonicalizar_dia(rec_fixa.dia_semana)
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
      -- 3.1 Verifica se o horario mudou (independente de quem e o aluno)
      IF rec_fixa.horario <> v_match_mensal.horario THEN
        SELECT status, observacao
        INTO v_prev_status, v_prev_obs
        FROM tmp_prev_inconsistencias
        WHERE tipo = 'HORARIO_ALTERADO'
          AND public.canonicalizar_dia(dia_semana) = public.canonicalizar_dia(rec_fixa.dia_semana)
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
          COALESCE(v_prev_obs, to_char(rec_fixa.horario, 'HH24:MI') || ' -> ' || to_char(v_match_mensal.horario, 'HH24:MI'))
        );
        v_total_horario_alterado := v_total_horario_alterado + 1;
      END IF;

      -- 3.2 Verifica se o aluno responsavel mudou (verificacao independente comparando aluno_id)
      IF v_match_mensal.aluno_id IS DISTINCT FROM rec_fixa.aluno_id THEN
        SELECT status, observacao
        INTO v_prev_status, v_prev_obs
        FROM tmp_prev_inconsistencias
        WHERE tipo = 'ALUNO_TROCADO'
          AND public.canonicalizar_dia(dia_semana) = public.canonicalizar_dia(rec_fixa.dia_semana)
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
      AND public.canonicalizar_dia(af.dia_semana) = public.canonicalizar_dia(rec_mensal.dia_semana)
      AND similarity(normalizar_nome(af.paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
    LIMIT 1;

    IF v_match_fixa IS NULL THEN
      SELECT status, observacao
      INTO v_prev_status, v_prev_obs
      FROM tmp_prev_inconsistencias
      WHERE tipo = 'PACIENTE_NOVO'
        AND public.canonicalizar_dia(dia_semana) = public.canonicalizar_dia(rec_mensal.dia_semana)
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

NOTIFY pgrst, 'reload schema';
