-- ==============================================================================
-- MIGRACAO: MODULO ALINHADORES E ORTOPEDICOS
-- Arquivo: supabase/migrations/20261110220000_alinhadores_e_ortopedicos.sql
--
-- Descricao:
-- 1. Adiciona coluna tipo ('alinhador' | 'ortopedico') e aparelho_previsto em alinhadores_pacientes.
-- 2. Adiciona coluna tipo e aparelho em alinhadores_pedidos.
-- 3. Adiciona campos de configuracao para ortopedicos em alinhadores_config.
-- 4. Ajusta constraint de unicidade de pedidos para permitir multiplos aparelhos ortopedicos.
--
-- Idempotente e aditivo: nao apaga nem altera dados existentes.
-- ==============================================================================

-- 1. TABELA public.alinhadores_pacientes
ALTER TABLE public.alinhadores_pacientes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'alinhador',
  ADD COLUMN IF NOT EXISTS aparelho_previsto text NULL;

ALTER TABLE public.alinhadores_pacientes
  DROP CONSTRAINT IF EXISTS chk_alinhadores_pacientes_tipo;

ALTER TABLE public.alinhadores_pacientes
  ADD CONSTRAINT chk_alinhadores_pacientes_tipo
  CHECK (tipo IN ('alinhador', 'ortopedico'));

COMMENT ON COLUMN public.alinhadores_pacientes.tipo IS 'Tipo de tratamento: alinhador ou ortopedico';
COMMENT ON COLUMN public.alinhadores_pacientes.aparelho_previsto IS 'Nome do aparelho ortopedico previsto em texto livre (apenas para tipo ortopedico)';

CREATE INDEX IF NOT EXISTS idx_alinhadores_pacientes_tipo
  ON public.alinhadores_pacientes(tipo);

-- 2. TABELA public.alinhadores_pedidos
ALTER TABLE public.alinhadores_pedidos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'alinhador',
  ADD COLUMN IF NOT EXISTS aparelho text NULL;

ALTER TABLE public.alinhadores_pedidos
  DROP CONSTRAINT IF EXISTS chk_alinhadores_pedidos_tipo;

ALTER TABLE public.alinhadores_pedidos
  ADD CONSTRAINT chk_alinhadores_pedidos_tipo
  CHECK (tipo IN ('alinhador', 'ortopedico'));

COMMENT ON COLUMN public.alinhadores_pedidos.tipo IS 'Tipo do pedido: alinhador ou ortopedico';
COMMENT ON COLUMN public.alinhadores_pedidos.aparelho IS 'Nome do aparelho ortopedico solicitado';

CREATE INDEX IF NOT EXISTS idx_alinhadores_pedidos_tipo
  ON public.alinhadores_pedidos(tipo);

-- Ajuste de unicidade:
-- Para alinhadores, preserva a regra estrita de no maximo 1 pedido por data de retorno.
-- Para ortopedicos, permite pedidos distintos para aparelhos diferentes.
ALTER TABLE public.alinhadores_pedidos
  DROP CONSTRAINT IF EXISTS uq_alinhadores_pedidos_paciente_data;

DROP INDEX IF EXISTS public.idx_uq_alinhadores_pedidos_alinhador;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_alinhadores_pedidos_alinhador
  ON public.alinhadores_pedidos(paciente_id, data_retorno)
  WHERE tipo = 'alinhador';

DROP INDEX IF EXISTS public.idx_uq_alinhadores_pedidos_ortopedico;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_alinhadores_pedidos_ortopedico
  ON public.alinhadores_pedidos(paciente_id, data_retorno, COALESCE(aparelho, ''))
  WHERE tipo = 'ortopedico';

-- 3. TABELA public.alinhadores_config
ALTER TABLE public.alinhadores_config
  ADD COLUMN IF NOT EXISTS antecedencia_ortopedico_dias integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS template_mensagem_ortopedico text NOT NULL DEFAULT (
    'Olá, passando para solicitar os aparelhos ortopédicos para os pacientes abaixo:' || E'\n\n' || '{lista}' || E'\n\n' || 'Agradecemos a confirmação do recebimento do pedido.'
  );

ALTER TABLE public.alinhadores_config
  DROP CONSTRAINT IF EXISTS chk_alinhadores_config_antecedencia_ortopedico;

ALTER TABLE public.alinhadores_config
  ADD CONSTRAINT chk_alinhadores_config_antecedencia_ortopedico
  CHECK (antecedencia_ortopedico_dias BETWEEN 1 AND 90);

COMMENT ON COLUMN public.alinhadores_config.antecedencia_ortopedico_dias IS 'Dias de antecedencia em relacao a data de retorno para alerta de solicitacao de ortopedicos (1 a 90 dias)';
COMMENT ON COLUMN public.alinhadores_config.template_mensagem_ortopedico IS 'Modelo de mensagem para envio ao laboratorio de ortopedia ({lista} e {pacientes})';

-- 4. RECARGA DO SCHEMA NO POSTGREST
NOTIFY pgrst, 'reload schema';
