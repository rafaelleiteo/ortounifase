-- ===================================================
-- MIGRATION: 20260924110000_create_pacientes.sql
-- MÓDULO DE PACIENTES, FICHAS E FILA DE CONFLITOS DE VÍNCULO
-- ===================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalizar_nome(p_nome TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_nome IS NULL THEN RETURN ''; END IF;
  RETURN regexp_replace(
    trim(
      translate(
        lower(p_nome),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaeeeeiiiiooooouuuucaaaaeeeeiiiiooooouuuuc'
      )
    ),
    '\\s+', ' ', 'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nome_normalizado TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    telefone TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'mesclado')),
    mesclado_com_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_nome_norm ON public.pacientes USING gin (nome_normalizado gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pacientes_nascimento ON public.pacientes (data_nascimento);

CREATE TABLE IF NOT EXISTS public.fichas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
    form_response_id TEXT UNIQUE NOT NULL,
    respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
    nome_informado TEXT NOT NULL,
    nascimento_informado DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('vinculada', 'pendente')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichas_paciente ON public.fichas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_fichas_status ON public.fichas (status);

CREATE TABLE IF NOT EXISTS public.fila_conflitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_id UUID NOT NULL REFERENCES public.fichas(id) ON DELETE CASCADE,
    pacientes_candidatos JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'resolvida')),
    resolvido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
    resolvido_em TIMESTAMPTZ,
    decisao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fila_conflitos_status ON public.fila_conflitos (status);

-- RLS
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_conflitos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver pacientes" ON public.pacientes;
CREATE POLICY "Ver pacientes" ON public.pacientes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciar pacientes" ON public.pacientes;
CREATE POLICY "Gerenciar pacientes" ON public.pacientes FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

DROP POLICY IF EXISTS "Ver fichas" ON public.fichas;
CREATE POLICY "Ver fichas" ON public.fichas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciar fichas" ON public.fichas;
CREATE POLICY "Gerenciar fichas" ON public.fichas FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

DROP POLICY IF EXISTS "Ver fila_conflitos" ON public.fila_conflitos;
CREATE POLICY "Ver fila_conflitos" ON public.fila_conflitos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciar fila_conflitos" ON public.fila_conflitos;
CREATE POLICY "Gerenciar fila_conflitos" ON public.fila_conflitos FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));
