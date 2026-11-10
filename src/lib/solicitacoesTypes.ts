/**
 * Tipos e Funcoes Puras do Modulo de Solicitacoes de Agendamento
 */

export interface TurmaItem {
  id: string;
  nome: string;
}

export type AguardandoDe = 'recepcao' | 'paciente' | 'dentista';
export type EstadoSolicitacao = 'pendente' | 'aguardando' | 'resolvido';

export interface SolicitacaoAgendamento {
  id: string;
  paciente: string;
  turma_id: string | null;
  observacao: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  aguardando_em?: string | null;
  aguardando_de?: AguardandoDe | string | null;
  aguardando_obs?: string | null;
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

export type SituacaoFiltro = 'aberto' | 'pendentes' | 'aguardando' | 'resolvidos' | 'todos';

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
 * Deriva o estado de uma solicitacao:
 * - resolvido tem prioridade: resolvido = true vence
 * - depois aguardando_em preenchido: estado 'aguardando'
 * - senao 'pendente'
 */
export function derivarEstadoSolicitacao(
  s?: { resolvido?: boolean | null; aguardando_em?: string | null } | null
): EstadoSolicitacao {
  if (!s) return 'pendente';
  if (s.resolvido) return 'resolvido';
  if (s.aguardando_em && String(s.aguardando_em).trim()) return 'aguardando';
  return 'pendente';
}

/**
 * Retorna o rotulo de exibicao formatado com acentos para a entidade aguardada.
 */
export function rotuloAguardandoDe(valor?: string | null): string {
  if (!valor) return '';
  const v = valor.trim().toLowerCase();
  if (v === 'recepcao' || v === 'recepção') return 'Recepção';
  if (v === 'paciente') return 'Paciente';
  if (v === 'dentista') return 'Dentista';
  return valor;
}

/**
 * Calcula a diferenca de dias no calendario local em que a solicitacao esta aguardando confirmacao.
 * Usa estritamente o calculo de calendario local de calcularDiasDecorridos.
 */
export function diasAguardando(
  s: { aguardando_em?: string | null },
  hoje?: string | Date
): number {
  if (!s.aguardando_em) return 0;
  return calcularDiasDecorridos(s.aguardando_em, hoje);
}

/**
 * Retorna true quando a solicitacao esta aguardando ha limiteDias ou mais (padrao: 3 dias).
 */
export function alertaAguardando(
  s: { aguardando_em?: string | null },
  hoje?: string | Date,
  limiteDias: number = 3
): boolean {
  if (!s.aguardando_em) return false;
  return diasAguardando(s, hoje) >= limiteDias;
}

export interface ValidarAguardandoResultado {
  valido: boolean;
  erro: string | null;
  de: AguardandoDe | null;
  obs: string | null;
}

/**
 * Valida a entidade ('recepcao' | 'paciente' | 'dentista') e a observacao (maximo 500 caracteres).
 * Apara espacos; caso a observacao esteja vazia ou contenha apenas espacos, converte para null.
 */
export function validarAguardando(
  de?: unknown,
  obs?: unknown
): ValidarAguardandoResultado {
  const deNormalizado = typeof de === 'string' ? de.trim().toLowerCase() : '';
  if (
    deNormalizado !== 'recepcao' &&
    deNormalizado !== 'paciente' &&
    deNormalizado !== 'dentista'
  ) {
    return {
      valido: false,
      erro: "Origem inválida. Escolha entre 'recepcao', 'paciente' ou 'dentista'.",
      de: null,
      obs: null
    };
  }

  let obsLimpa: string | null = null;
  if (typeof obs === 'string') {
    const aparada = obs.trim();
    obsLimpa = aparada.length > 0 ? aparada : null;
  }

  if (obsLimpa && obsLimpa.length > 500) {
    return {
      valido: false,
      erro: 'A observação da proposta não pode exceder 500 caracteres.',
      de: deNormalizado as AguardandoDe,
      obs: obsLimpa
    };
  }

  return {
    valido: true,
    erro: null,
    de: deNormalizado as AguardandoDe,
    obs: obsLimpa
  };
}

/**
 * Monta o payload para colocar a solicitacao em estado aguardando confirmacao.
 * O parametro 'agora' e injetado para permitir testes deterministicos.
 */
export function montarPayloadAguardando(
  de: unknown,
  obs?: unknown,
  agora: Date | string = new Date()
): {
  aguardando_em: string;
  aguardando_de: AguardandoDe;
  aguardando_obs: string | null;
} {
  const validacao = validarAguardando(de, obs);
  if (!validacao.valido || !validacao.de) {
    throw new Error(validacao.erro || 'Dados inválidos para aguardar confirmação.');
  }

  const timestamp = typeof agora === 'string' ? agora : agora.toISOString();

  return {
    aguardando_em: timestamp,
    aguardando_de: validacao.de,
    aguardando_obs: validacao.obs
  };
}

/**
 * Monta o payload para voltar a solicitacao para o estado pendente,
 * limpando os tres campos de aguardando.
 */
export function montarPayloadVoltarPendente(): {
  aguardando_em: null;
  aguardando_de: null;
  aguardando_obs: null;
} {
  return {
    aguardando_em: null,
    aguardando_de: null,
    aguardando_obs: null
  };
}

/**
 * Monta o payload para resolver a solicitacao, mantendo os campos aguardando como historico.
 */
export function montarPayloadResolver(
  agora: Date | string = new Date()
): {
  resolvido: true;
  resolvido_em: string;
  updated_at: string;
} {
  const timestamp = typeof agora === 'string' ? agora : agora.toISOString();
  return {
    resolvido: true,
    resolvido_em: timestamp,
    updated_at: timestamp
  };
}

/**
 * Monta o payload para reabrir a solicitacao, voltando para pendente:
 * resolvido false, resolvido_em null e os tres campos aguardando limpos como null.
 */
export function montarPayloadReabrir(
  agora: Date | string = new Date()
): {
  resolvido: false;
  resolvido_em: null;
  aguardando_em: null;
  aguardando_de: null;
  aguardando_obs: null;
  updated_at: string;
} {
  const timestamp = typeof agora === 'string' ? agora : agora.toISOString();
  return {
    resolvido: false,
    resolvido_em: null,
    aguardando_em: null,
    aguardando_de: null,
    aguardando_obs: null,
    updated_at: timestamp
  };
}

/**
 * Ordena solicitacoes de agendamento de acordo com a situacao:
 * - Em 'aberto' e 'todos':
 *     1. Pendentes primeiro (created_at crescente: mais antigas no topo)
 *     2. Aguardando (as com alerta primeiro; depois mais antigas no topo: aguardando_em crescente)
 *     3. Resolvidos (resolvido_em decrescente: mais recentes no topo)
 * - Em 'pendentes': pendentes primeiro (created_at crescente)
 * - Em 'aguardando': aguardando primeiro (alerta primeiro, depois mais antigas no topo)
 * - Em 'resolvidos': resolvidos primeiro (resolvido_em decrescente)
 * Nao muta o array original.
 */
export function ordenarSolicitacoes(
  lista: SolicitacaoAgendamento[],
  situacao: SituacaoFiltro = 'aberto'
): SolicitacaoAgendamento[] {
  return [...lista].sort((a, b) => {
    const estadoA = derivarEstadoSolicitacao(a);
    const estadoB = derivarEstadoSolicitacao(b);

    const rankGrupo = (estado: EstadoSolicitacao): number => {
      if (situacao === 'pendentes') {
        return estado === 'pendente' ? 1 : estado === 'aguardando' ? 2 : 3;
      }
      if (situacao === 'aguardando') {
        return estado === 'aguardando' ? 1 : estado === 'pendente' ? 2 : 3;
      }
      if (situacao === 'resolvidos') {
        return estado === 'resolvido' ? 1 : estado === 'pendente' ? 2 : 3;
      }
      // 'aberto', 'todos' ou qualquer outra visao geral:
      // pendentes (1) -> aguardando (2) -> resolvidos (3)
      return estado === 'pendente' ? 1 : estado === 'aguardando' ? 2 : 3;
    };

    const rankA = rankGrupo(estadoA);
    const rankB = rankGrupo(estadoB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Se ambos estao no mesmo estado:
    if (estadoA === 'pendente') {
      // Mais antigas no topo: created_at crescente
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeA - timeB;
    }

    if (estadoA === 'aguardando') {
      // As com alerta primeiro; depois mais antigas no topo (aguardando_em crescente)
      const alertA = alertaAguardando(a);
      const alertB = alertaAguardando(b);
      if (alertA !== alertB) {
        return alertA ? -1 : 1;
      }
      const dataA = a.aguardando_em || a.created_at;
      const dataB = b.aguardando_em || b.created_at;
      const timeA = new Date(dataA).getTime();
      const timeB = new Date(dataB).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    if (estadoA === 'resolvido') {
      // Mais recentes no topo: resolvido_em decrescente
      const dataA = a.resolvido_em || a.updated_at;
      const dataB = b.resolvido_em || b.updated_at;
      const timeA = new Date(dataA).getTime();
      const timeB = new Date(dataB).getTime();
      return timeB - timeA;
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

