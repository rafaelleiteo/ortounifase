-- ==============================================================================
-- MIGRAÇÃO: MÓDULO ALINHADORES (SCHEMA, ÍNDICES, RLS E PERMISSÕES)
-- Arquivo: supabase/migrations/20261022200000_alinhadores_schema.sql
-- 
-- ROLLBACK (Ordem correta respeitando foreign keys):
-- DROP TABLE IF EXISTS public.alinhadores_pedidos CASCADE;
-- DROP TABLE IF EXISTS public.alinhadores_pacientes CASCADE;
-- DROP TABLE IF EXISTS public.alinhadores_calendario CASCADE;
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA: alinhadores_calendario
-- Datas de atendimento de cada turma (ESP1, ESP2, SERVIÇO)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alinhadores_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data date NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_alinhadores_calendario_turma_data UNIQUE (turma_id, data)
);

COMMENT ON TABLE public.alinhadores_calendario IS 'Datas de atendimento de alinhadores por turma';
COMMENT ON COLUMN public.alinhadores_calendario.turma_id IS 'Referência à turma (ESP1, ESP2, SERVIÇO)';
COMMENT ON COLUMN public.alinhadores_calendario.data IS 'Data do dia de clínica para alinhadores';

-- ------------------------------------------------------------------------------
-- 2. TABELA: alinhadores_pacientes
-- Cadastro de pacientes em tratamento com alinhadores
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alinhadores_pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  total_alinhadores integer NULL,
  observacao text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.alinhadores_pacientes IS 'Pacientes em tratamento com alinhadores';
COMMENT ON COLUMN public.alinhadores_pacientes.total_alinhadores IS 'Total previsto de alinhadores do tratamento (se definido)';
COMMENT ON COLUMN public.alinhadores_pacientes.ativo IS 'Status do paciente no acompanhamento de alinhadores';

-- ------------------------------------------------------------------------------
-- 3. TABELA: alinhadores_pedidos
-- Histórico e controle de solicitações de alinhadores por paciente e data de retorno
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alinhadores_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.alinhadores_pacientes(id) ON DELETE CASCADE,
  data_retorno date NOT NULL,
  alinhador_de integer NULL,
  alinhador_ate integer NULL,
  solicitado_em timestamptz NULL,
  lote_id uuid NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_alinhadores_pedidos_paciente_data UNIQUE (paciente_id, data_retorno)
);

COMMENT ON TABLE public.alinhadores_pedidos IS 'Pedidos de alinhadores para as datas de retorno dos pacientes';
COMMENT ON COLUMN public.alinhadores_pedidos.data_retorno IS 'Data prevista para a consulta de retorno';
COMMENT ON COLUMN public.alinhadores_pedidos.alinhador_de IS 'Número inicial do intervalo de alinhadores solicitado (ex: 3)';
COMMENT ON COLUMN public.alinhadores_pedidos.alinhador_ate IS 'Número final do intervalo de alinhadores solicitado (ex: 4)';
COMMENT ON COLUMN public.alinhadores_pedidos.solicitado_em IS 'Data/hora em que o pedido foi encaminhado à empresa';
COMMENT ON COLUMN public.alinhadores_pedidos.lote_id IS 'UUID de identificação do lote gerado na solicitação conjunta';

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alinhadores_calendario_turma_id 
  ON public.alinhadores_calendario(turma_id);

CREATE INDEX IF NOT EXISTS idx_alinhadores_calendario_data 
  ON public.alinhadores_calendario(data);

CREATE INDEX IF NOT EXISTS idx_alinhadores_pacientes_turma_id 
  ON public.alinhadores_pacientes(turma_id);

CREATE INDEX IF NOT EXISTS idx_alinhadores_pedidos_paciente_id 
  ON public.alinhadores_pedidos(paciente_id);

CREATE INDEX IF NOT EXISTS idx_alinhadores_pedidos_data_retorno 
  ON public.alinhadores_pedidos(data_retorno);

CREATE INDEX IF NOT EXISTS idx_alinhadores_pedidos_solicitado_em 
  ON public.alinhadores_pedidos(solicitado_em);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.alinhadores_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinhadores_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinhadores_pedidos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas anteriores se existirem (idempotência)
DROP POLICY IF EXISTS "Gerenciar alinhadores_calendario" ON public.alinhadores_calendario;
DROP POLICY IF EXISTS "Gerenciar alinhadores_pacientes" ON public.alinhadores_pacientes;
DROP POLICY IF EXISTS "Gerenciar alinhadores_pedidos" ON public.alinhadores_pedidos;

-- Políticas de RLS estritas: leitura e escrita exclusivas para coordenador e admin_master
CREATE POLICY "Gerenciar alinhadores_calendario" ON public.alinhadores_calendario
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar alinhadores_pacientes" ON public.alinhadores_pacientes
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar alinhadores_pedidos" ON public.alinhadores_pedidos
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

-- ------------------------------------------------------------------------------
-- 6. PERMISSÕES DE ACESSO
-- Bloqueio total para anon (sem permissão nem RLS para anônimos)
-- Concessão para usuários autenticados (filtrados pela política de RLS acima)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.alinhadores_calendario FROM anon;
REVOKE ALL ON public.alinhadores_pacientes FROM anon;
REVOKE ALL ON public.alinhadores_pedidos FROM anon;

GRANT ALL ON public.alinhadores_calendario TO authenticated;
GRANT ALL ON public.alinhadores_pacientes TO authenticated;
GRANT ALL ON public.alinhadores_pedidos TO authenticated;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
