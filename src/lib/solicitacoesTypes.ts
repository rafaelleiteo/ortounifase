/**
 * Tipos e Funcoes Puras do Modulo de Solicitacoes de Agendamento
 */

export interface TurmaItem {
  id: string;
  nome: string;
}

export interface SolicitacaoAgendamento {
  id: string;
  paciente: string;
  turma_id: string | null;
  observacao: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  turmas?: {
    id: string;
    nome: string;
  } | null;
}

export interface CriarSolicitacaoParams {
  paciente: string;
  turma_id?: string | null;
  observacao?: string | null;
}

export interface EditarSolicitacaoParams {
  paciente: string;
  turma_id?: string | null;
  observacao?: string | null;
}

export type SituacaoFiltro = 'pendentes' | 'resolvidos' | 'todos';

export interface FiltroSolicitacoes {
  turma_id?: string; // 'todas' | 'nenhuma' | uuid
  situacao?: SituacaoFiltro;
  buscaNome?: string;
}

export const LIMITE_CARACTERES_OBSERVACAO = 1000;

/**
 * Normaliza o nome do paciente para deteccao confiavel de duplicidade:
 * - Remove acentos via decomposicao Unicode NFD
 * - Converte para minusculas
 * - Colapsa espacos multiplos em um espaco simples
 */
export function normalizarNomePaciente(nome?: string | null): string {
  if (!nome || typeof nome !== 'string') return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extrai ano, mes e dia da data no calendario local.
 */
export function extrairPartesDataLocal(data: string | Date): { ano: number; mes: number; dia: number } {
  const d = typeof data === 'string' ? new Date(data) : data;
  return {
    ano: d.getFullYear(),
    mes: d.getMonth(),
    dia: d.getDate()
  };
}

/**
 * Calcula a diferenca em dias de calendario local entre a data de entrada e a data de referencia.
 * Nao utiliza strings 'AAAA-MM-DD' nem toISOString, operando estritamente sobre
 * ano, mes e dia locais para garantir precisao independente de fuso horario.
 */
export function calcularDiasDecorridos(
  dataEntrada: string | Date,
  dataReferencia?: string | Date
): number {
  const pEntrada = extrairPartesDataLocal(dataEntrada);
  const pRef = extrairPartesDataLocal(dataReferencia || new Date());

  const utcEntrada = Date.UTC(pEntrada.ano, pEntrada.mes, pEntrada.dia);
  const utcRef = Date.UTC(pRef.ano, pRef.mes, pRef.dia);

  const diffMs = utcRef - utcEntrada;
  const dias = Math.floor(diffMs / 86400000);
  return dias < 0 ? 0 : dias;
}

/**
 * Formata o texto legivel de dias decorridos.
 */
export function formatarDiasDecorridos(dias: number): string {
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  return `Há ${dias} dias`;
}

/**
 * Detecta se ja existe uma solicitacao pendente com o mesmo nome normalizado.
 */
export function detectarDuplicidade(
  nomeNovo: string,
  solicitacoesPendentes: Array<{ paciente: string }>
): boolean {
  const normNovo = normalizarNomePaciente(nomeNovo);
  if (!normNovo) return false;
  return solicitacoesPendentes.some(
    (item) => normalizarNomePaciente(item.paciente) === normNovo
  );
}

/**
 * Ordena solicitacoes de agendamento de acordo com a situacao:
 * - pendentes: ordenadas por created_at crescente (mais antigas no topo)
 * - resolvidos: ordenadas por resolvido_em decrescente (mais recentes no topo; se nulo, usa updated_at)
 * - todos: pendentes primeiro (created_at crescente) e resolvidos depois (resolvido_em decrescente)
 */
export function ordenarSolicitacoes(
  lista: SolicitacaoAgendamento[],
  situacao: SituacaoFiltro = 'pendentes'
): SolicitacaoAgendamento[] {
  return [...lista].sort((a, b) => {
    if (situacao === 'todos') {
      if (a.resolvido !== b.resolvido) {
        return a.resolvido ? 1 : -1;
      }
    }

    // Se ambos sao pendentes
    if (!a.resolvido && !b.resolvido) {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeA - timeB;
    }

    // Se ambos sao resolvidos
    if (a.resolvido && b.resolvido) {
      const dataA = a.resolvido_em || a.updated_at;
      const dataB = b.resolvido_em || b.updated_at;
      const timeA = new Date(dataA).getTime();
      const timeB = new Date(dataB).getTime();
      return timeB - timeA;
    }

    if (situacao === 'pendentes') {
      if (a.resolvido !== b.resolvido) return a.resolvido ? 1 : -1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    if (situacao === 'resolvidos') {
      if (a.resolvido !== b.resolvido) return a.resolvido ? -1 : 1;
      const dataA = a.resolvido_em || a.updated_at;
      const dataB = b.resolvido_em || b.updated_at;
      return new Date(dataB).getTime() - new Date(dataA).getTime();
    }

    return 0;
  });
}

/**
 * Formata o tempo de espera de uma solicitacao ja resolvida:
 * - 0 dias: "Resolvido no mesmo dia"
 * - 1 dia: "Esperou 1 dia"
 * - X dias: "Esperou X dias"
 */
export function formatarEsperaResolvida(
  created_at: string | Date,
  resolvido_em?: string | Date | null
): string {
  const ref = resolvido_em || undefined;
  const dias = calcularDiasDecorridos(created_at, ref);
  if (dias === 0) return 'Resolvido no mesmo dia';
  if (dias === 1) return 'Esperou 1 dia';
  return `Esperou ${dias} dias`;
}

/**
 * Escapa caracteres especiais de LIKE/ILIKE (%, _ e \) para evitar interpretacao como curingas.
 */
export function escaparTermoLike(termo?: string | null): string {
  if (!termo || typeof termo !== 'string') return '';
  return termo
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

