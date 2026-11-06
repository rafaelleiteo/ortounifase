import { supabase } from './supabase';
import {
  ArquivoAdmin,
  CriarArquivoParams,
  EditarArquivoParams,
  validarArquivo,
  sanitizarNomeOriginal,
  gerarCaminhoStorage
} from './arquivosTypes';

export const BUCKET_NAME = 'arquivos-admin';

/**
 * Lista todos os arquivos da administração ordenados por data de criação (mais recentes primeiro).
 */
export async function listarArquivos(buscaNome?: string): Promise<ArquivoAdmin[]> {
  let query = supabase
    .from('arquivos_admin')
    .select('*')
    .order('created_at', { ascending: false });

  if (buscaNome && buscaNome.trim()) {
    query = query.ilike('nome', `%${buscaNome.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao listar arquivos admin:', error);
    throw new Error(`Erro ao listar arquivos: ${error.message}`);
  }

  return (data || []) as ArquivoAdmin[];
}

/**
 * Envia um novo arquivo para o Supabase Storage e registra os metadados na tabela.
 * Se o registro na tabela falhar, o arquivo recém-enviado ao Storage é removido imediatamente (rollback).
 */
export async function enviarArquivo(params: CriarArquivoParams): Promise<ArquivoAdmin> {
  const { file, nome, descricao } = params;

  // 1. Validação prévia
  const validacao = validarArquivo(file);
  if (!validacao.valido) {
    throw new Error(validacao.erro || 'Arquivo inválido.');
  }

  const nomeOriginalLimpo = sanitizarNomeOriginal(file.name);
  const caminhoStorage = gerarCaminhoStorage(nomeOriginalLimpo);
  const nomeExibido = (nome && nome.trim()) ? nome.trim() : nomeOriginalLimpo;

  // 2. Upload para o Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(caminhoStorage, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Erro no upload para o Storage:', uploadError);
    throw new Error(`Erro ao enviar arquivo para o Storage: ${uploadError.message}`);
  }

  // 3. Registro na tabela arquivos_admin
  const novoRegistro = {
    nome: nomeExibido,
    descricao: descricao?.trim() || null,
    caminho_storage: caminhoStorage,
    nome_original: nomeOriginalLimpo,
    tipo_mime: file.type || null,
    tamanho_bytes: file.size
  };

  const { data: dbData, error: dbError } = await supabase
    .from('arquivos_admin')
    .insert([novoRegistro])
    .select()
    .single();

  if (dbError) {
    console.error('Erro ao salvar metadados do arquivo, executando rollback no Storage:', dbError);
    // Rollback no Storage: remove o objeto para não deixar arquivo órfão
    try {
      await supabase.storage.from(BUCKET_NAME).remove([caminhoStorage]);
    } catch (cleanupErr) {
      console.error('Falha ao limpar arquivo órfão do Storage:', cleanupErr);
    }
    throw new Error(`Erro ao registrar arquivo no banco de dados: ${dbError.message}`);
  }

  return dbData as ArquivoAdmin;
}

/**
 * Gera URL assinada de curta duração (60 segundos) com download forçado e nome original.
 */
export async function obterUrlDownload(caminhoStorage: string, nomeOriginal: string): Promise<string> {
  const nomeLimpo = sanitizarNomeOriginal(nomeOriginal);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(caminhoStorage, 60, {
      download: nomeLimpo
    });

  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar URL assinada de download:', error);
    throw new Error(`Erro ao obter link de download: ${error?.message || 'URL não gerada'}`);
  }

  return data.signedUrl;
}

/**
 * Edita o nome exibido e a descrição de um arquivo existente.
 */
export async function editarArquivo(params: EditarArquivoParams): Promise<ArquivoAdmin> {
  const { id, nome, descricao } = params;

  if (!nome || !nome.trim()) {
    throw new Error('O nome do arquivo não pode ficar em branco.');
  }

  const { data, error } = await supabase
    .from('arquivos_admin')
    .update({
      nome: nome.trim(),
      descricao: descricao?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao editar arquivo:', error);
    throw new Error(`Erro ao salvar alterações do arquivo: ${error.message}`);
  }

  return data as ArquivoAdmin;
}

/**
 * Substitui o conteúdo binário de um arquivo:
 * 1. Envia o novo arquivo para um caminho novo no Storage.
 * 2. Atualiza os metadados da linha na tabela.
 * 3. Somente após a atualização confirmada da tabela, apaga o arquivo antigo do Storage.
 */
export async function substituirArquivo(arquivoAtual: ArquivoAdmin, novoFile: File): Promise<ArquivoAdmin> {
  const validacao = validarArquivo(novoFile);
  if (!validacao.valido) {
    throw new Error(validacao.erro || 'Arquivo inválido.');
  }

  const novoNomeOriginal = sanitizarNomeOriginal(novoFile.name);
  const novoCaminhoStorage = gerarCaminhoStorage(novoNomeOriginal);
  const caminhoStorageAntigo = arquivoAtual.caminho_storage;

  // 1. Upload do novo arquivo
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(novoCaminhoStorage, novoFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Erro ao enviar novo arquivo para substituição:', uploadError);
    throw new Error(`Erro ao enviar novo arquivo para o Storage: ${uploadError.message}`);
  }

  // 2. Atualizar registro no banco
  const { data: dbData, error: dbError } = await supabase
    .from('arquivos_admin')
    .update({
      caminho_storage: novoCaminhoStorage,
      nome_original: novoNomeOriginal,
      tipo_mime: novoFile.type || null,
      tamanho_bytes: novoFile.size,
      updated_at: new Date().toISOString()
    })
    .eq('id', arquivoAtual.id)
    .select()
    .single();

  if (dbError) {
    console.error('Erro ao atualizar linha do arquivo na substituição, revertendo novo arquivo:', dbError);
    // Rollback do novo arquivo enviado
    try {
      await supabase.storage.from(BUCKET_NAME).remove([novoCaminhoStorage]);
    } catch (cleanupErr) {
      console.error('Falha ao limpar novo arquivo após erro no banco:', cleanupErr);
    }
    throw new Error(`Erro ao atualizar arquivo no banco: ${dbError.message}`);
  }

  // 3. Remover com segurança o arquivo antigo do Storage
  if (caminhoStorageAntigo) {
    try {
      const { error: removeError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([caminhoStorageAntigo]);
      if (removeError) {
        console.warn('Aviso: arquivo antigo não pôde ser removido do Storage:', removeError);
      }
    } catch (removeErr) {
      console.warn('Aviso ao tentar excluir arquivo antigo do Storage:', removeErr);
    }
  }

  return dbData as ArquivoAdmin;
}

/**
 * Exclui um arquivo da administração:
 * 1. Remove do Storage.
 * 2. Remove da tabela arquivos_admin.
 * Se a exclusão no banco falhar, lança erro para evitar que a inconsistência passe despercebida.
 */
export async function apagarArquivo(arquivo: ArquivoAdmin): Promise<void> {
  // 1. Remove do Storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([arquivo.caminho_storage]);

  if (storageError) {
    console.error('Erro ao remover arquivo do Storage:', storageError);
    throw new Error(`Erro ao remover arquivo do Storage: ${storageError.message}`);
  }

  // 2. Remove da tabela
  const { error: dbError } = await supabase
    .from('arquivos_admin')
    .delete()
    .eq('id', arquivo.id);

  if (dbError) {
    console.error('Erro ao remover registro da tabela arquivos_admin:', dbError);
    throw new Error(`Erro ao remover metadados do banco: ${dbError.message}`);
  }
}
