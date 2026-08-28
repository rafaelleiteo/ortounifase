-- ===================================================
-- SCHEMA INICIAL - ORTOUNIFASE (SUPABASE POSTGRESQL)
-- ===================================================

-- 1. TABELA DE PERFIS (Vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('coordenador', 'admin_master', 'professor')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE PERMISSÕES DE MÓDULO
CREATE TABLE IF NOT EXISTS public.permissoes_modulo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    modulo TEXT NOT NULL,
    pode_ver BOOLEAN NOT NULL DEFAULT false,
    pode_editar BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_usuario_modulo UNIQUE (usuario_id, modulo)
);

-- 3. TABELA DE ALUNOS
CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    turma TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true
);

-- 4. TABELA DE MATERIAIS
CREATE TABLE IF NOT EXISTS public.materiais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao_completa TEXT NOT NULL,
    unidade TEXT NOT NULL,
    categoria TEXT,
    marca TEXT,
    quantidade_referencia NUMERIC,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA DE PEDIDOS
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado')),
    email_destino TEXT DEFAULT 'rafael.leite@prof.unifase-rj.edu.br',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviado_em TIMESTAMPTZ
);

-- 6. TABELA DE ITENS DO PEDIDO
CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materiais(id) ON DELETE SET NULL,
    descricao_manual TEXT,
    quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
    unidade TEXT NOT NULL
);


-- ===================================================
-- FUNÇÕES AUXILIARES SEGURAS PARA RLS
-- ===================================================

CREATE OR REPLACE FUNCTION public.get_user_papel(u_id UUID)
RETURNS TEXT AS $$
    SELECT papel FROM public.perfis WHERE id = u_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_module_permission(u_id UUID, mod_name TEXT, req_edit BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
    v_papel TEXT;
    v_ver BOOLEAN;
    v_editar BOOLEAN;
BEGIN
    SELECT papel INTO v_papel FROM public.perfis WHERE id = u_id;
    IF v_papel = 'coordenador' OR v_papel = 'admin_master' THEN
        RETURN true;
    END IF;

    SELECT pode_ver, pode_editar INTO v_ver, v_editar 
    FROM public.permissoes_modulo 
    WHERE usuario_id = u_id AND modulo = mod_name;

    IF req_edit THEN
        RETURN COALESCE(v_editar, false);
    ELSE
        RETURN COALESCE(v_ver, false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ===================================================
-- HABILITAÇÃO E POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ===================================================

-- RLS: PERFIS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver perfis" ON public.perfis
    FOR SELECT USING (
        id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador'
    );

CREATE POLICY "Atualizar perfis" ON public.perfis
    FOR UPDATE USING (
        id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador'
    );

CREATE POLICY "Inserir perfis" ON public.perfis
    FOR INSERT WITH CHECK (
        id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador'
    );


-- RLS: PERMISSÕES DE MÓDULO
ALTER TABLE public.permissoes_modulo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver permissões" ON public.permissoes_modulo
    FOR SELECT USING (
        usuario_id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador'
    );

CREATE POLICY "Gerenciar permissões" ON public.permissoes_modulo
    FOR ALL USING (
        public.get_user_papel(auth.uid()) = 'coordenador'
    );


-- RLS: MATERIAIS
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver materiais" ON public.materiais
    FOR SELECT USING (
        public.has_module_permission(auth.uid(), 'materiais', false)
    );

CREATE POLICY "Editar materiais" ON public.materiais
    FOR ALL USING (
        public.has_module_permission(auth.uid(), 'materiais', true)
    );


-- RLS: PEDIDOS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver pedidos" ON public.pedidos
    FOR SELECT USING (
        usuario_id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador'
    );

CREATE POLICY "Criar pedidos" ON public.pedidos
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
    );

CREATE POLICY "Editar ou deletar rascunhos" ON public.pedidos
    FOR UPDATE USING (
        (usuario_id = auth.uid() AND status = 'rascunho') OR public.get_user_papel(auth.uid()) = 'coordenador'
    );


-- RLS: ITENS DO PEDIDO
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver itens do pedido" ON public.itens_pedido
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pedidos p
            WHERE p.id = itens_pedido.pedido_id
            AND (p.usuario_id = auth.uid() OR public.get_user_papel(auth.uid()) = 'coordenador')
        )
    );

CREATE POLICY "Editar itens do pedido" ON public.itens_pedido
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pedidos p
            WHERE p.id = itens_pedido.pedido_id
            AND ((p.usuario_id = auth.uid() AND p.status = 'rascunho') OR public.get_user_papel(auth.uid()) = 'coordenador')
        )
    );


-- RLS: ALUNOS (RLS Ativado sem políticas públicas abertas)
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
