-- Migration: 20261109140000_create_solicitacoes_agendamento.sql
-- Descricao: Cria tabela public.solicitacoes_agendamento para lista de solicitacoes de agendamento
--
-- ROLLBACK (executar manualmente caso seja necessario reverter):
--   DROP TABLE IF EXISTS public.solicitacoes_agendamento CASCADE;
--   NOTIFY pgrst, 'reload schema';
--
-- ATENCAO: O rollback remove permanentemente os dados da tabela de solicitacoes de agendamento.

-- 1. TABELA public.solicitacoes_agendamento
CREATE TABLE IF NOT EXISTS public.solicitacoes_agendamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente text NOT NULL CHECK (trim(paciente) <> ''),
  turma_id uuid NULL REFERENCES public.turmas(id) ON DELETE SET NULL,
  observacao text NULL CHECK (observacao IS NULL OR char_length(observacao) <= 1000),
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_em timestamptz NULL,
  criado_por uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentarios explicativos
COMMENT ON TABLE public.solicitacoes_agendamento IS
  'Fila de espera e triagem de pacientes para inclusao nas agendas das turmas';
COMMENT ON COLUMN public.solicitacoes_agendamento.paciente IS
  'Nome do paciente aguardando agendamento (obrigatorio, nao vazio)';
COMMENT ON COLUMN public.solicitacoes_agendamento.turma_id IS
  'Turma pretendida para o agendamento (NULL indica sem agenda definida / qualquer turma)';
COMMENT ON COLUMN public.solicitacoes_agendamento.observacao IS
  'Observacoes e notas de triagem sobre a solicitacao (maximo 1000 caracteres)';
COMMENT ON COLUMN public.solicitacoes_agendamento.resolvido IS
  'Indica se a solicitacao ja foi atendida ou agendada';
COMMENT ON COLUMN public.solicitacoes_agendamento.resolvido_em IS
  'Data e hora em que a solicitacao foi marcada como resolvida';

-- 2. INDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_solicitacoes_resolvido_created
  ON public.solicitacoes_agendamento(resolvido, created_at);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_turma
  ON public.solicitacoes_agendamento(turma_id);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.solicitacoes_agendamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar solicitacoes_agendamento" ON public.solicitacoes_agendamento;

CREATE POLICY "Gerenciar solicitacoes_agendamento" ON public.solicitacoes_agendamento
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

REVOKE ALL ON public.solicitacoes_agendamento FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_agendamento TO authenticated;

-- 4. RECARGA DO SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
