ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS quantidade_referencia NUMERIC;
