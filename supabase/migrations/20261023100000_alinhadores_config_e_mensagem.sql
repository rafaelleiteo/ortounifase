-- ==============================================================================
-- MIGRAÇÃO: MÓDULO ALINHADORES (PARTE 3 - CONFIGURAÇÕES, MENSAGEM E RETORNOS)
-- Arquivo: supabase/migrations/20261023100000_alinhadores_config_e_mensagem.sql
-- 
-- ROLLBACK (Ordem correta de reversão):
-- DROP INDEX IF EXISTS public.idx_alinhadores_pedidos_mensagem_enviada_em;
-- ALTER TABLE public.alinhadores_pedidos DROP COLUMN IF EXISTS mensagem_enviada_em;
-- DROP TABLE IF EXISTS public.alinhadores_config CASCADE;
-- NOTIFY pgrst, 'reload schema';
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE CONFIGURAÇÃO DO MÓDULO (LINHA ÚNICA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alinhadores_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  antecedencia_dias integer NOT NULL DEFAULT 20 CHECK (antecedencia_dias BETWEEN 1 AND 90),
  quantidade_por_pedido integer NOT NULL DEFAULT 2 CHECK (quantidade_por_pedido >= 1),
  template_mensagem text NOT NULL DEFAULT (
    'Olá, passando para informar que solicitamos alinhadores para os pacientes abaixo:' || E'\n\n' || '{lista}' || E'\n\n' || 'Agradecemos a confirmação do recebimento do pedido.'
  ),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.alinhadores_config IS 'Configurações gerais do módulo de alinhadores (linha única garantida por id=true)';
COMMENT ON COLUMN public.alinhadores_config.antecedencia_dias IS 'Dias de antecedência em relação ao retorno para alerta de solicitação (1 a 90 dias)';
COMMENT ON COLUMN public.alinhadores_config.quantidade_por_pedido IS 'Quantidade padrão de alinhadores sugerida por pedido (ex: 2 alinhadores)';
COMMENT ON COLUMN public.alinhadores_config.template_mensagem IS 'Modelo de mensagem para envio à empresa fornecedora ({lista} e {pacientes})';

-- Inserção da linha de configuração padrão inicial (idempotente)
INSERT INTO public.alinhadores_config (id, antecedencia_dias, quantidade_por_pedido, template_mensagem)
VALUES (
  true,
  20,
  2,
  'Olá, passando para informar que solicitamos alinhadores para os pacientes abaixo:' || E'\n\n' || '{lista}' || E'\n\n' || 'Agradecemos a confirmação do recebimento do pedido.'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. NOVA COLUNA EM alinhadores_pedidos: mensagem_enviada_em
-- ------------------------------------------------------------------------------
ALTER TABLE public.alinhadores_pedidos
  ADD COLUMN IF NOT EXISTS mensagem_enviada_em timestamptz NULL;

COMMENT ON COLUMN public.alinhadores_pedidos.mensagem_enviada_em IS 'Data/hora em que a mensagem de solicitação foi comunicada à empresa';

-- Índice para busca rápida de pedidos aguardando comunicação à empresa
CREATE INDEX IF NOT EXISTS idx_alinhadores_pedidos_mensagem_enviada_em
  ON public.alinhadores_pedidos(mensagem_enviada_em);

-- ------------------------------------------------------------------------------
-- 3. SEGURANÇA E RLS NA TABELA alinhadores_config
-- ------------------------------------------------------------------------------
ALTER TABLE public.alinhadores_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar alinhadores_config" ON public.alinhadores_config;

CREATE POLICY "Gerenciar alinhadores_config" ON public.alinhadores_config
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

-- ------------------------------------------------------------------------------
-- 4. PERMISSÕES DE ACESSO
-- Bloqueio total para anon; permissões explícitas para authenticated (não GRANT ALL)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.alinhadores_config FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alinhadores_config TO authenticated;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
