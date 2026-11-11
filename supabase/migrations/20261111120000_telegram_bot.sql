-- ==============================================================================
-- MIGRACAO: BOT DO TELEGRAM (ESTADO, DEDUPLICACAO E LOGS)
-- Arquivo: supabase/migrations/20261111120000_telegram_bot.sql
--
-- Descricao:
-- 1. Cria tabela telegram_estado para controle de sessao de conversa (expira em 30 min).
-- 2. Cria tabela telegram_updates_processados para deduplicacao de updates do webhook.
-- 3. Cria tabela telegram_log para trilha de auditoria e controle de envio diario.
-- 4. Habilita RLS em todas as tabelas sem policies publicas (apenas service_role acessa).
--
-- Idempotente e aditivo: nao apaga nem altera dados existentes.
-- ==============================================================================

-- 1. TABELA public.telegram_estado
CREATE TABLE IF NOT EXISTS public.telegram_estado (
  chat_id bigint PRIMARY KEY,
  passo text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_estado IS 'Estado da maquina de conversa do bot Telegram por chat_id';
COMMENT ON COLUMN public.telegram_estado.chat_id IS 'ID do chat no Telegram (canal do coordenador)';
COMMENT ON COLUMN public.telegram_estado.passo IS 'Etapa atual do fluxo de conversa';
COMMENT ON COLUMN public.telegram_estado.dados IS 'Payload transacional em andamento (jsonb)';
COMMENT ON COLUMN public.telegram_estado.updated_at IS 'Data/hora da ultima interacao (expira em 30 min)';

-- RLS: Habilitado e sem policies (somente service_role tem acesso via bypass RLS)
ALTER TABLE public.telegram_estado ENABLE ROW LEVEL SECURITY;

-- 2. TABELA public.telegram_updates_processados
CREATE TABLE IF NOT EXISTS public.telegram_updates_processados (
  update_id bigint PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_updates_processados IS 'Registro de update_id do Telegram para evitar reprocessamento duplicado';
COMMENT ON COLUMN public.telegram_updates_processados.update_id IS 'ID sequencial do update enviado pelo Telegram';
COMMENT ON COLUMN public.telegram_updates_processados.criado_em IS 'Data/hora do recebimento do update';

CREATE INDEX IF NOT EXISTS idx_telegram_updates_criado_em
  ON public.telegram_updates_processados(criado_em);

-- RLS: Habilitado e sem policies
ALTER TABLE public.telegram_updates_processados ENABLE ROW LEVEL SECURITY;

-- 3. TABELA public.telegram_log
CREATE TABLE IF NOT EXISTS public.telegram_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  acao text NOT NULL,
  resumo text NOT NULL,
  detalhes jsonb NULL
);

COMMENT ON TABLE public.telegram_log IS 'Log de auditoria e controle de operacoes do bot Telegram';
COMMENT ON COLUMN public.telegram_log.acao IS 'Identificador da acao (ex: aviso_diario, paciente_criado, pedido_solicitado)';
COMMENT ON COLUMN public.telegram_log.resumo IS 'Descricao resumida e segura da acao (sem dados clinicos)';
COMMENT ON COLUMN public.telegram_log.detalhes IS 'Metadados operacionais estruturados (jsonb)';

CREATE INDEX IF NOT EXISTS idx_telegram_log_acao_criado_em
  ON public.telegram_log(acao, criado_em DESC);

-- RLS: Habilitado e sem policies
ALTER TABLE public.telegram_log ENABLE ROW LEVEL SECURITY;

-- 4. RECARGA DO SCHEMA NO POSTGREST
NOTIFY pgrst, 'reload schema';
