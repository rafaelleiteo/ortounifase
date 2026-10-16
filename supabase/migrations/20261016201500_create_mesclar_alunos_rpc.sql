-- Migration: create mesclar_alunos RPC for safe and atomic student merging
CREATE OR REPLACE FUNCTION public.mesclar_alunos(
  p_aluno_oficial_id uuid,
  p_aluno_duplicado_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_turma_oficial uuid;
  v_turma_duplicado uuid;
  v_nome_oficial text;
  v_nome_duplicado text;
  v_fixa_count integer := 0;
  v_mensal_count integer := 0;
BEGIN
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
