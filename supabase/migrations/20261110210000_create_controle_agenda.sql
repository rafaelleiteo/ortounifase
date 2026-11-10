-- Migration: 20261110210000_create_controle_agenda.sql
-- Descricao: Cria tabelas e funcao para o modulo Controle de Agenda (mes a mes por turma)

-- 1. TABELA CABECALHO: controle_agenda_mes
CREATE TABLE IF NOT EXISTS public.controle_agenda_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  importado_em timestamptz DEFAULT now(),
  salvo_em timestamptz DEFAULT now(),
  salvo_por uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_controle_agenda_mes UNIQUE (turma_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_controle_agenda_mes_turma_mes
  ON public.controle_agenda_mes(turma_id, mes_referencia);

-- 2. TABELA ITENS: controle_agenda_itens
-- Os itens guardam copia dos valores (paciente, dia, horario, aluno), sem FK para agenda_mensal.
-- Sem unique de slot para permitir multiplos pacientes no mesmo horario.
CREATE TABLE IF NOT EXISTS public.controle_agenda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid NOT NULL REFERENCES public.controle_agenda_mes(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('mensal', 'fixa', 'avulso')),
  dia_semana text NOT NULL CHECK (dia_semana IN ('SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO')),
  data_atendimento date,
  horario text NOT NULL,
  paciente text NOT NULL,
  aluno_nome text,
  aluno_id uuid REFERENCES public.agenda_alunos(id) ON DELETE SET NULL,
  status text CHECK (status IS NULL OR status IN ('atendido', 'faltou', 'desmarcou', 'nao_marcou')),
  observacao text CHECK (observacao IS NULL OR char_length(observacao) <= 500),
  ordem integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_controle_agenda_itens_controle_id
  ON public.controle_agenda_itens(controle_id);

CREATE INDEX IF NOT EXISTS idx_controle_agenda_itens_dia_horario
  ON public.controle_agenda_itens(controle_id, dia_semana, horario);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.controle_agenda_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_agenda_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar controle_agenda_mes" ON public.controle_agenda_mes;
CREATE POLICY "Gerenciar controle_agenda_mes" ON public.controle_agenda_mes
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

DROP POLICY IF EXISTS "Gerenciar controle_agenda_itens" ON public.controle_agenda_itens;
CREATE POLICY "Gerenciar controle_agenda_itens" ON public.controle_agenda_itens
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

REVOKE ALL ON public.controle_agenda_mes FROM anon;
REVOKE ALL ON public.controle_agenda_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_agenda_mes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_agenda_itens TO authenticated;

-- 4. FUNCAO SQL: controle_agenda_salvar
-- Executada como SECURITY INVOKER com search_path fixo.
-- Em uma unica transacao: upsert do cabecalho, remocao dos itens antigos e insercao dos novos.
CREATE OR REPLACE FUNCTION public.controle_agenda_salvar(
  p_turma_id uuid,
  p_mes date,
  p_itens jsonb,
  p_importado_em timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_controle_id uuid;
BEGIN
  -- Upsert do cabecalho
  INSERT INTO public.controle_agenda_mes (
    turma_id,
    mes_referencia,
    importado_em,
    salvo_em,
    salvo_por,
    updated_at
  ) VALUES (
    p_turma_id,
    p_mes,
    COALESCE(p_importado_em, now()),
    now(),
    auth.uid(),
    now()
  )
  ON CONFLICT (turma_id, mes_referencia) DO UPDATE SET
    salvo_em = now(),
    salvo_por = auth.uid(),
    updated_at = now(),
    importado_em = COALESCE(EXCLUDED.importado_em, controle_agenda_mes.importado_em)
  RETURNING id INTO v_controle_id;

  -- Apaga os itens antigos associados ao controle
  DELETE FROM public.controle_agenda_itens
  WHERE controle_id = v_controle_id;

  -- Insere os novos itens a partir do JSONB
  IF p_itens IS NOT NULL AND jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO public.controle_agenda_itens (
      controle_id,
      origem,
      dia_semana,
      data_atendimento,
      horario,
      paciente,
      aluno_nome,
      aluno_id,
      status,
      observacao,
      ordem
    )
    SELECT
      v_controle_id,
      (item->>'origem')::text,
      (item->>'dia_semana')::text,
      CASE
        WHEN item->>'data_atendimento' IS NOT NULL AND item->>'data_atendimento' <> ''
        THEN (item->>'data_atendimento')::date
        ELSE NULL
      END,
      (item->>'horario')::text,
      (item->>'paciente')::text,
      NULLIF(item->>'aluno_nome', ''),
      CASE
        WHEN item->>'aluno_id' IS NOT NULL AND item->>'aluno_id' <> ''
        THEN (item->>'aluno_id')::uuid
        ELSE NULL
      END,
      NULLIF(item->>'status', ''),
      NULLIF(item->>'observacao', ''),
      COALESCE((item->>'ordem')::integer, row_number::integer)
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, row_number);
  END IF;

  RETURN v_controle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.controle_agenda_salvar(uuid, date, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.controle_agenda_salvar(uuid, date, jsonb, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.controle_agenda_salvar(uuid, date, jsonb, timestamptz) TO authenticated;

-- 5. RECARGA DO SCHEMA NO POSTGREST
NOTIFY pgrst, 'reload schema';
