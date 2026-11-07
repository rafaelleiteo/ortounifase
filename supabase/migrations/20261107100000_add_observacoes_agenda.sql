-- ==============================================================================
-- MIGRACAO: OBSERVACOES POR AGENDAMENTO NA AGENDA FIXA E AGENDA MENSAL
-- Arquivo: supabase/migrations/20261107100000_add_observacoes_agenda.sql
--
-- Descricao:
-- Adiciona a coluna 'observacao' nas tabelas public.agenda_fixa e public.agenda_mensal
-- com restricao CHECK de tamanho maximo de 200 caracteres.
--
-- AVISO DE SEGURANCA E ROLLBACK:
-- Em caso de rollback, executar:
--   ALTER TABLE public.agenda_fixa DROP COLUMN IF EXISTS observacao;
--   ALTER TABLE public.agenda_mensal DROP COLUMN IF EXISTS observacao;
-- ATENCAO: O comando DROP COLUMN e irreversivel e destruira permanentemente
-- todas as observacoes digitadas pelos coordenadores em ambas as tabelas.
-- ==============================================================================

-- 1. TABELA public.agenda_fixa
ALTER TABLE public.agenda_fixa
  ADD COLUMN IF NOT EXISTS observacao text DEFAULT NULL;

COMMENT ON COLUMN public.agenda_fixa.observacao IS
  'Observacao perene ou fixa do agendamento do paciente na grade padrao da turma';

ALTER TABLE public.agenda_fixa
  DROP CONSTRAINT IF EXISTS chk_agenda_fixa_observacao_length;

ALTER TABLE public.agenda_fixa
  ADD CONSTRAINT chk_agenda_fixa_observacao_length
  CHECK (char_length(observacao) <= 200);

-- 2. TABELA public.agenda_mensal
ALTER TABLE public.agenda_mensal
  ADD COLUMN IF NOT EXISTS observacao text DEFAULT NULL;

COMMENT ON COLUMN public.agenda_mensal.observacao IS
  'Observacao pontual ou especifica do paciente no mes de referencia';

ALTER TABLE public.agenda_mensal
  DROP CONSTRAINT IF EXISTS chk_agenda_mensal_observacao_length;

ALTER TABLE public.agenda_mensal
  ADD CONSTRAINT chk_agenda_mensal_observacao_length
  CHECK (char_length(observacao) <= 200);

-- 3. NOTIFICACAO AO POSTGREST PARA RECARREGAR O SCHEMA
NOTIFY pgrst, 'reload schema';
