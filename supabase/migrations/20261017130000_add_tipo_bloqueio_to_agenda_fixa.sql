-- Migration: add tipo_bloqueio to agenda_fixa
-- Tipos: SEQUENCIA (continuação), LIVRE (horário vago deliberado), OUTRO (observação personalizada)

ALTER TABLE public.agenda_fixa
ADD COLUMN IF NOT EXISTS tipo_bloqueio TEXT DEFAULT NULL;

COMMENT ON COLUMN public.agenda_fixa.tipo_bloqueio IS 'Tipo de bloqueio de horário: SEQUENCIA (continuação), LIVRE (horário vago confirmado), OUTRO (observação personalizada)';
