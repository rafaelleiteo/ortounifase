-- ===================================================
-- MIGRATION: 20260917100000_create_links_uteis.sql
-- TABELA DE LINKS ÚTEIS (FORMULÁRIOS E SISTEMAS EXTERNOS)
-- ===================================================

CREATE TABLE IF NOT EXISTS public.links_uteis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    url TEXT NOT NULL,
    papeis_visiveis TEXT[] NOT NULL DEFAULT ARRAY['aluno', 'professor']::TEXT[],
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Popula com os 3 links padrão iniciais
INSERT INTO public.links_uteis (titulo, url, papeis_visiveis, ordem) VALUES
    ('Sistema Clinicorp', 'https://sistema.clinicorp.com/#', ARRAY['aluno', 'professor']::TEXT[], 1),
    ('Ficha Ortodôntica UNIFASE', 'https://docs.google.com/forms/d/e/1FAIpQLSfa3dFzjMT5YoWLri_cTjnkV7RGYrDGOa6Iu0yD67ZMw-QKUw/viewform', ARRAY['aluno', 'professor']::TEXT[], 2),
    ('Ficha UNIFASE Triagem', 'https://docs.google.com/forms/d/e/1FAIpQLSe6d2cCZHg0eaWvHbhdGH26ol0dvh6CV5e7a2RrIVcGNCsfcQ/viewform', ARRAY['aluno', 'professor']::TEXT[], 3)
ON CONFLICT DO NOTHING;

-- Habilita RLS
ALTER TABLE public.links_uteis ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para qualquer usuário
DROP POLICY IF EXISTS "Ver links_uteis" ON public.links_uteis;
CREATE POLICY "Ver links_uteis" ON public.links_uteis
    FOR SELECT USING (true);

-- Escrita (insert/update/delete) liberada apenas para coordenador e admin_master
DROP POLICY IF EXISTS "Gerenciar links_uteis" ON public.links_uteis;
CREATE POLICY "Gerenciar links_uteis" ON public.links_uteis
    FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));
