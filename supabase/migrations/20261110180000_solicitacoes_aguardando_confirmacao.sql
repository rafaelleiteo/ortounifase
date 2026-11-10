-- Migration: 20261110180000_solicitacoes_aguardando_confirmacao.sql
-- Descricao: Adiciona colunas para estado intermediario "aguardando confirmacao" em solicitacoes_agendamento
--
-- ROLLBACK (executar manualmente caso seja necessario reverter):
--   ALTER TABLE public.solicitacoes_agendamento
--     DROP CONSTRAINT IF EXISTS chk_solicitacoes_aguardando_de,
--     DROP CONSTRAINT IF EXISTS chk_solicitacoes_aguardando_coerencia,
--     DROP CONSTRAINT IF EXISTS chk_solicitacoes_aguardando_obs,
--     DROP COLUMN IF EXISTS aguardando_em,
--     DROP COLUMN IF EXISTS aguardando_de,
--     DROP COLUMN IF EXISTS aguardando_obs;
--   NOTIFY pgrst, 'reload schema';
--
-- ATENCAO: O rollback remove permanentemente os dados das colunas de aguardando confirmacao.

-- 1. ADICAO DAS COLUNAS (IDEMPOTENTE VIA ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.solicitacoes_agendamento
  ADD COLUMN IF NOT EXISTS aguardando_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS aguardando_de text NULL,
  ADD COLUMN IF NOT EXISTS aguardando_obs text NULL;

-- Comentarios explicativos sobre as novas colunas
COMMENT ON COLUMN public.solicitacoes_agendamento.aguardando_em IS
  'Data e hora em que a solicitacao entrou no estado aguardando confirmacao';
COMMENT ON COLUMN public.solicitacoes_agendamento.aguardando_de IS
  'Entidade da qual se aguarda confirmacao: recepcao, paciente ou dentista';
COMMENT ON COLUMN public.solicitacoes_agendamento.aguardando_obs IS
  'Descricao da solucao proposta aguardando confirmacao (maximo 500 caracteres)';

-- 2. CONSTRAINTS DE INTEGRIDADE (IDEMPOTENTES VIA BLOCO DO)
DO $$
BEGIN
  -- (a) Valida entidade permitida quando preenchida
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_solicitacoes_aguardando_de'
  ) THEN
    ALTER TABLE public.solicitacoes_agendamento
      ADD CONSTRAINT chk_solicitacoes_aguardando_de
      CHECK (aguardando_de IS NULL OR aguardando_de IN ('recepcao', 'paciente', 'dentista'));
  END IF;

  -- (b) Coerencia: aguardando_em e aguardando_de devem estar ambos nulos ou ambos preenchidos
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_solicitacoes_aguardando_coerencia'
  ) THEN
    ALTER TABLE public.solicitacoes_agendamento
      ADD CONSTRAINT chk_solicitacoes_aguardando_coerencia
      CHECK ((aguardando_em IS NULL) = (aguardando_de IS NULL));
  END IF;

  -- (c) Limite maximo de 500 caracteres na observacao da proposta
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_solicitacoes_aguardando_obs'
  ) THEN
    ALTER TABLE public.solicitacoes_agendamento
      ADD CONSTRAINT chk_solicitacoes_aguardando_obs
      CHECK (aguardando_obs IS NULL OR char_length(aguardando_obs) <= 500);
  END IF;
END $$;

-- 3. RECARGA DO SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
