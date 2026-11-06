-- ==============================================================================
-- MIGRAÇÃO: MÓDULO ARQUIVOS ADMIN (STORAGE, TABELA, RLS E PERMISSÕES)
-- Arquivo: supabase/migrations/20261106100000_create_arquivos_admin.sql
-- 
-- ROLLBACK (Ordem correta de reversão):
-- DROP POLICY IF EXISTS "Acesso storage arquivos-admin select" ON storage.objects;
-- DROP POLICY IF EXISTS "Acesso storage arquivos-admin insert" ON storage.objects;
-- DROP POLICY IF EXISTS "Acesso storage arquivos-admin update" ON storage.objects;
-- DROP POLICY IF EXISTS "Acesso storage arquivos-admin delete" ON storage.objects;
-- DROP POLICY IF EXISTS "Gerenciar arquivos_admin" ON public.arquivos_admin;
-- DROP TABLE IF EXISTS public.arquivos_admin CASCADE;
-- DELETE FROM storage.buckets WHERE id = 'arquivos-admin';
-- NOTIFY pgrst, 'reload schema';
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BUCKET PRIVADO NO SUPABASE STORAGE (50 MB DE LIMITE)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arquivos-admin',
  'arquivos-admin',
  false,
  52428800, -- 50 MB em bytes (50 * 1024 * 1024)
  NULL      -- Mime types validados também na camada da aplicação
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.arquivos_admin
-- Metadados dos arquivos internos gerenciados pela administração
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arquivos_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NULL,
  caminho_storage text NOT NULL UNIQUE,
  nome_original text NOT NULL,
  tipo_mime text NULL,
  tamanho_bytes bigint NULL,
  criado_por uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.arquivos_admin IS 'Metadados dos arquivos internos da administração (armazenados no bucket arquivos-admin)';
COMMENT ON COLUMN public.arquivos_admin.nome IS 'Nome exibido do arquivo no sistema (editável)';
COMMENT ON COLUMN public.arquivos_admin.descricao IS 'Descrição ou observações opcionais sobre o arquivo';
COMMENT ON COLUMN public.arquivos_admin.caminho_storage IS 'Caminho seguro do objeto no bucket arquivos-admin (ex: uuid.ext)';
COMMENT ON COLUMN public.arquivos_admin.nome_original IS 'Nome do arquivo original no momento do envio';
COMMENT ON COLUMN public.arquivos_admin.tipo_mime IS 'MIME type do arquivo';
COMMENT ON COLUMN public.arquivos_admin.tamanho_bytes IS 'Tamanho em bytes do arquivo';
COMMENT ON COLUMN public.arquivos_admin.criado_por IS 'ID do usuário autenticado que enviou o arquivo';

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_arquivos_admin_created_at ON public.arquivos_admin(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arquivos_admin_nome ON public.arquivos_admin(nome);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) NA TABELA public.arquivos_admin
-- ------------------------------------------------------------------------------
ALTER TABLE public.arquivos_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar arquivos_admin" ON public.arquivos_admin;

CREATE POLICY "Gerenciar arquivos_admin" ON public.arquivos_admin
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

REVOKE ALL ON public.arquivos_admin FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos_admin TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS DE RLS NO BUCKET storage.objects
-- Acesso restrito exclusivamente ao bucket 'arquivos-admin' e a coordenador / admin_master
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Acesso storage arquivos-admin select" ON storage.objects;
DROP POLICY IF EXISTS "Acesso storage arquivos-admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Acesso storage arquivos-admin update" ON storage.objects;
DROP POLICY IF EXISTS "Acesso storage arquivos-admin delete" ON storage.objects;

CREATE POLICY "Acesso storage arquivos-admin select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'arquivos-admin'
    AND public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master')
  );

CREATE POLICY "Acesso storage arquivos-admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'arquivos-admin'
    AND public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master')
  );

CREATE POLICY "Acesso storage arquivos-admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'arquivos-admin'
    AND public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master')
  );

CREATE POLICY "Acesso storage arquivos-admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'arquivos-admin'
    AND public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master')
  );

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
