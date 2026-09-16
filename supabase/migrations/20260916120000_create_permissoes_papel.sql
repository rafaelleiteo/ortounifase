-- ===================================================
-- MIGRATION: 20260916120000_create_permissoes_papel.sql
-- TABELA DE PERMISSÕES POR PAPEL (GLOBAL)
-- ===================================================

CREATE TABLE IF NOT EXISTS public.permissoes_papel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    papel TEXT NOT NULL CHECK (papel IN ('aluno', 'professor', 'admin_master')),
    modulo TEXT NOT NULL,
    pode_ver BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_papel_modulo UNIQUE (papel, modulo)
);

-- Popula com permissões padrão atuais
INSERT INTO public.permissoes_papel (papel, modulo, pode_ver) VALUES
    ('aluno', 'aluno', true),
    ('aluno', 'dashboard', false),
    ('aluno', 'professor', false),
    ('aluno', 'materiais', false),
    ('aluno', 'secretaria', false),
    ('aluno', 'coordenador', false),
    ('professor', 'dashboard', true),
    ('professor', 'aluno', true),
    ('professor', 'professor', true),
    ('professor', 'materiais', false),
    ('professor', 'secretaria', false),
    ('professor', 'coordenador', false),
    ('admin_master', 'dashboard', true),
    ('admin_master', 'aluno', true),
    ('admin_master', 'professor', true),
    ('admin_master', 'materiais', true),
    ('admin_master', 'secretaria', true),
    ('admin_master', 'coordenador', true)
ON CONFLICT (papel, modulo) DO NOTHING;

-- Habilita RLS
ALTER TABLE public.permissoes_papel ENABLE ROW LEVEL SECURITY;

-- Leitura permitida para qualquer usuário autenticado
CREATE POLICY "Ver permissoes_papel" ON public.permissoes_papel
    FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita (insert/update/delete) permitida para coordenador e admin_master
CREATE POLICY "Gerenciar permissoes_papel" ON public.permissoes_papel
    FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));
