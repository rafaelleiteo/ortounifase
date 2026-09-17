import { supabase } from './supabase';

export type Papel = 'aluno' | 'professor' | 'admin_master';

export interface PermissaoPapel {
  id?: string;
  papel: Papel;
  modulo: string;
  pode_ver: boolean;
}

export interface ModuloInfo {
  key: string;
  label: string;
  description: string;
  path: string;
}

export const MODULOS_SISTEMA: ModuloInfo[] = [
  { key: 'dashboard', label: 'Visão Geral', description: 'Painel principal e estatísticas de uso', path: '/dashboard' },
  { key: 'aluno', label: 'Área do Aluno', description: 'Atendimento clínico, anamneses e prontuários', path: '/aluno' },
  { key: 'professor', label: 'Área do Professor', description: 'Avaliações, validações e aprovações de turmas', path: '/professor' },
  { key: 'materiais', label: 'Catálogo de Materiais', description: 'Requisição e controle de estoque de insumos', path: '/materiais' },
  { key: 'secretaria', label: 'Secretaria', description: 'Gestão de matrículas, turmas e documentos', path: '/secretaria' },
  { key: 'coordenador', label: 'Coordenação Geral', description: 'Parâmetros corporativos e controle de acesso', path: '/coordenador' },
];

export const PAPEIS_SISTEMA: { key: Papel; label: string; description: string }[] = [
  { key: 'aluno', label: 'Aluno', description: 'Acesso restrito à área de alunos e formulários' },
  { key: 'professor', label: 'Professor', description: 'Supervisão de alunos, turmas e visão geral' },
  { key: 'admin_master', label: 'Admin Master', description: 'Acesso completo a todos os módulos' },
];

export const DEFAULT_PERMISSOES_PAPEL: PermissaoPapel[] = [
  // Aluno
  { papel: 'aluno', modulo: 'aluno', pode_ver: true },
  { papel: 'aluno', modulo: 'dashboard', pode_ver: false },
  { papel: 'aluno', modulo: 'professor', pode_ver: false },
  { papel: 'aluno', modulo: 'materiais', pode_ver: false },
  { papel: 'aluno', modulo: 'secretaria', pode_ver: false },
  { papel: 'aluno', modulo: 'coordenador', pode_ver: false },

  // Professor
  { papel: 'professor', modulo: 'dashboard', pode_ver: true },
  { papel: 'professor', modulo: 'aluno', pode_ver: true },
  { papel: 'professor', modulo: 'professor', pode_ver: true },
  { papel: 'professor', modulo: 'materiais', pode_ver: false },
  { papel: 'professor', modulo: 'secretaria', pode_ver: false },
  { papel: 'professor', modulo: 'coordenador', pode_ver: false },

  // Admin Master
  { papel: 'admin_master', modulo: 'dashboard', pode_ver: true },
  { papel: 'admin_master', modulo: 'aluno', pode_ver: true },
  { papel: 'admin_master', modulo: 'professor', pode_ver: true },
  { papel: 'admin_master', modulo: 'materiais', pode_ver: true },
  { papel: 'admin_master', modulo: 'secretaria', pode_ver: true },
  { papel: 'admin_master', modulo: 'coordenador', pode_ver: true },
];

export async function fetchPermissoesPapel(): Promise<PermissaoPapel[]> {
  const { data, error } = await supabase
    .from('permissoes_papel')
    .select('*');

  if (error) {
    throw new Error(`Erro no Supabase ao buscar permissoes_papel: ${error.message} (Código: ${error.code || 'sem código'})`);
  }

  return (data || []) as PermissaoPapel[];
}

export async function updatePermissaoPapel(
  papel: Papel,
  modulo: string,
  pode_ver: boolean
): Promise<PermissaoPapel> {
  const { data, error } = await supabase
    .from('permissoes_papel')
    .upsert(
      { papel, modulo, pode_ver },
      { onConflict: 'papel,modulo' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar permissão no Supabase: ${error.message}`);
  }

  return data as PermissaoPapel;
}
