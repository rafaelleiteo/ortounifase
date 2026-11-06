/**
 * Tipos e Interfaces do Módulo de Arquivos da Administração
 */

export interface ArquivoAdmin {
  id: string;
  nome: string;
  descricao: string | null;
  caminho_storage: string;
  nome_original: string;
  tipo_mime: string | null;
  tamanho_bytes: number | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CriarArquivoParams {
  file: File;
  nome?: string;
  descricao?: string;
}

export interface EditarArquivoParams {
  id: string;
  nome: string;
  descricao?: string | null;
}

export interface ProgressoUploadItem {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  progresso: number;
  status: 'pendente' | 'enviando' | 'concluido' | 'erro';
  erro?: string;
}

export const LIMITE_TAMANHO_BYTES = 50 * 1024 * 1024; // 50 MB

export const EXTENSOES_BLOQUEADAS = new Set([
  'exe',
  'bat',
  'cmd',
  'msi',
  'ps1',
  'sh',
  'js',
  'html',
  'htm',
  'svg'
]);

export function extrairExtensao(nomeArquivo: string): string {
  const partes = nomeArquivo.split('.');
  if (partes.length <= 1) return '';
  return partes.pop()?.toLowerCase().trim() || '';
}

export function validarArquivo(file: File): { valido: boolean; erro?: string } {
  if (file.size > LIMITE_TAMANHO_BYTES) {
    return {
      valido: false,
      erro: `Arquivo excede o limite máximo permitido de 50 MB (${formatarTamanho(file.size)}).`
    };
  }

  const ext = extrairExtensao(file.name);
  if (EXTENSOES_BLOQUEADAS.has(ext)) {
    return {
      valido: false,
      erro: `Arquivos com extensão .${ext} não são permitidos por motivos de segurança.`
    };
  }

  return { valido: true };
}

export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const valor = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${valor} ${sizes[i]}`;
}

export function sanitizarNomeOriginal(nome: string): string {
  // Remove caracteres potencialmente problemáticos para cabeçalhos HTTP e nomes de arquivo
  return nome.replace(/["\r\n\t]/g, '').trim();
}

export function gerarCaminhoStorage(nomeOriginal: string): string {
  const ext = extrairExtensao(nomeOriginal);
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
  return ext ? `${uuid}.${ext}` : uuid;
}
