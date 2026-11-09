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

export interface ResultadoSubstituicao {
  arquivo: ArquivoAdmin;
  avisoRemocaoAntigo?: string | null;
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

export const EXTENSOES_ABRIVEIS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'mp3',
  'mp4',
  'webm'
]);

/**
 * Retorna true se o arquivo pertencer a lista restrita de formatos seguros
 * que podem ser renderizados diretamente na aba do navegador.
 * Nao inclui txt, csv, html, htm, svg, xml nem js.
 */
export function podeAbrirNoNavegador(nomeOriginal: string): boolean {
  if (!nomeOriginal) return false;
  const ext = extrairExtensao(nomeOriginal).toLowerCase();
  return EXTENSOES_ABRIVEIS.has(ext);
}

/**
 * Infere o tipo MIME seguro para as extensoes abriveis suportadas.
 */
export function inferirContentType(extensao: string): string | undefined {
  const ext = extensao.toLowerCase().trim();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'mp3':
      return 'audio/mpeg';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return undefined;
  }
}

export function sanitizarNomeOriginal(nome: string): string {
  // Remove caracteres potencialmente problematicos para cabecalhos HTTP e nomes de arquivo
  return nome.replace(/["\r\n\t]/g, '').trim();
}

/**
 * Sanitiza o nome original do arquivo para armazenamento seguro no Storage:
 * - Normaliza NFD e remove acentos
 * - Troca qualquer caractere fora de [A-Za-z0-9._-] por "_"
 * - Colapsa "_" e "." repetidos e remove "_" e "." das pontas
 * - Base com no maximo 80 caracteres
 * - Extensao em minusculas so com [a-z0-9], ate 10 caracteres
 * - Se a base ficar vazia usa "arquivo"
 * - Nunca permite "/" nem ".." no resultado
 */
export function sanitizarNomeArquivo(nomeOriginal: string): string {
  if (!nomeOriginal || typeof nomeOriginal !== 'string') {
    return 'arquivo';
  }

  // 1. Normalizar NFD e remover acentos
  const semAcento = nomeOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2. Trocar qualquer caractere fora de [A-Za-z0-9._-] por "_"
  const limpo = semAcento.replace(/[^A-Za-z0-9._-]/g, '_');

  // 3. Colapsar repeticoes de "_" e "." e remover das pontas
  const colapsado = limpo
    .replace(/_+/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^[._]+|[._]+$/g, '');

  // 4. Separar base e extensao
  const ultimoPonto = colapsado.lastIndexOf('.');
  let rawBase = colapsado;
  let rawExt = '';

  if (ultimoPonto > 0) {
    rawBase = colapsado.slice(0, ultimoPonto);
    rawExt = colapsado.slice(ultimoPonto + 1);
  } else if (ultimoPonto === 0) {
    rawBase = '';
    rawExt = colapsado.slice(1);
  }

  // 5. Extensao em minusculas so com [a-z0-9], ate 10 caracteres
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);

  // 6. Base com no maximo 80 caracteres, limpando pontas novamente
  let base = rawBase
    .replace(/_+/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80)
    .replace(/^[._]+|[._]+$/g, '');

  // 7. Se a base ficar vazia, usar "arquivo"
  if (!base) {
    base = 'arquivo';
  }

  // 8. Montar nome seguro sem "/" nem ".."
  const resultado = ext ? `${base}.${ext}` : base;
  return resultado.replace(/[/\\]/g, '_').replace(/\.{2,}/g, '.');
}

/**
 * Gera caminho no Storage no formato seguro: uuid/nomeSeguro.ext
 */
export function gerarCaminhoStorage(nomeOriginal: string): string {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
  const nomeSeguro = sanitizarNomeArquivo(nomeOriginal);
  return `${uuid}/${nomeSeguro}`;
}

