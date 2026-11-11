import {
  parseDataLocal,
  formatarDataBR,
  formatarDataISO,
  formatarListaNomes,
  StatusPedido,
  TipoTratamento,
  agruparBlocos,
  proximoBloco
} from './alinhadoresTypes';
import { normalizarTextoComparacao } from './agendaTypes';
import { nomesParecidos } from './solicitacoesImportacao';

export const ANTECEDENCIA_ORTOPEDICO_PADRAO = 20;

export const TEMPLATE_MENSAGEM_ORTOPEDICO_PADRAO =
  'Olá, passando para solicitar os aparelhos ortopédicos para os pacientes abaixo:\n\n{lista}\n\nAgradecemos a confirmação do recebimento do pedido.';

export interface PedidoOrtopedicoParaMensagem {
  paciente_nome: string;
  data_retorno: string | Date;
  aparelho?: string | null;
}


/**
 * Calcula a data limite para solicitar o aparelho ortopedico:
 * data_retorno menos antecedenciaDias (padrao 20 dias).
 * NUNCA utiliza new Date('AAAA-MM-DD') nem toISOString.
 */
export function calcularPrazoLimiteOrtopedico(
  dataRetorno: string | Date,
  antecedenciaDias: number = ANTECEDENCIA_ORTOPEDICO_PADRAO
): Date {
  const d = typeof dataRetorno === 'string'
    ? parseDataLocal(dataRetorno)
    : new Date(dataRetorno.getFullYear(), dataRetorno.getMonth(), dataRetorno.getDate(), 0, 0, 0, 0);

  d.setDate(d.getDate() - antecedenciaDias);
  return d;
}

/**
 * Determina o status de um pedido ortopedico:
 * - 'solicitado': se solicitado_em existe (depois de solicitado, nao gera novo alerta);
 * - 'expirado': se NAO solicitado e data_retorno <= hoje;
 * - 'atrasado': se hoje > prazo limite (diff < 0);
 * - 'vencendo': se faltam de 0 a 5 dias para o prazo limite;
 * - 'pendente': se faltam mais de 5 dias para o prazo limite.
 */
export function calcularStatusPedidoOrtopedico(
  pedido: { solicitado_em?: string | null; data_retorno: string | Date },
  hoje: string | Date = new Date(),
  antecedenciaDias: number = ANTECEDENCIA_ORTOPEDICO_PADRAO
): StatusPedido {
  if (pedido.solicitado_em) {
    return 'solicitado';
  }

  const h = typeof hoje === 'string'
    ? parseDataLocal(hoje)
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);

  const retornoDate = typeof pedido.data_retorno === 'string'
    ? parseDataLocal(pedido.data_retorno)
    : new Date(pedido.data_retorno.getFullYear(), pedido.data_retorno.getMonth(), pedido.data_retorno.getDate(), 0, 0, 0, 0);

  if (retornoDate.getTime() <= h.getTime()) {
    return 'expirado';
  }

  const prazo = calcularPrazoLimiteOrtopedico(pedido.data_retorno, antecedenciaDias);

  const diffMs = prazo.getTime() - h.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return 'atrasado';
  }

  if (diffDias <= 5) {
    return 'vencendo';
  }

  return 'pendente';
}

/**
 * Gera mensagem formatada pronta para enviar ao laboratorio de ortopedia.
 * - Suporta os marcadores {lista} e {pacientes}.
 * - Cada linha de {lista} exibe: "- Nome: Aparelho, retorno previsto em dd/mm/aaaa".
 * - Se o template nao contiver nenhum marcador, anexa a {lista} ao final.
 * - Sem travessao.
 */
export function gerarMensagemLaboratorioOrtopedico(
  pedidos: PedidoOrtopedicoParaMensagem[],
  template?: string
): string {
  if (!pedidos || pedidos.length === 0) {
    return 'Olá, não há pedidos de aparelhos ortopédicos para solicitar no momento.\n\nAgradecemos a confirmação do recebimento do pedido.';
  }

  const ordenados = [...pedidos].sort((a, b) => {
    const da = typeof a.data_retorno === 'string' ? a.data_retorno : formatarDataISO(a.data_retorno);
    const db = typeof b.data_retorno === 'string' ? b.data_retorno : formatarDataISO(b.data_retorno);
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return a.paciente_nome.localeCompare(b.paciente_nome, 'pt-BR');
  });

  const linhas = ordenados.map((p) => {
    const dataBR = formatarDataBR(p.data_retorno);
    const aparelhoNome = p.aparelho && p.aparelho.trim() ? p.aparelho.trim() : 'Aparelho Ortopédico';
    return `- ${p.paciente_nome}: ${aparelhoNome}, retorno previsto em ${dataBR}`;
  });

  const textoLista = linhas.join('\n');
  const nomes = ordenados.map((p) => p.paciente_nome);
  const textoPacientes = formatarListaNomes(nomes);

  const tmpl = template && template.trim() ? template : TEMPLATE_MENSAGEM_ORTOPEDICO_PADRAO;
  const temLista = tmpl.includes('{lista}');
  const temPacientes = tmpl.includes('{pacientes}');

  let resultado = tmpl;

  if (temLista) {
    resultado = resultado.split('{lista}').join(textoLista);
  }
  if (temPacientes) {
    resultado = resultado.split('{pacientes}').join(textoPacientes);
  }
  if (!temLista && !temPacientes) {
    resultado = `${resultado.trim()}\n\n${textoLista}`;
  }

  return resultado;
}

/**
 * Ao digitar o nome do paciente, avisa sem bloquear quando existir nome igual ou parecido.
 * Reutiliza nomesParecidos e normalizarTextoComparacao.
 */
export type PacienteParaVerificacaoNome =
  | string
  | {
      id?: string;
      nome: string;
      turma_nome?: string;
    };

export interface ResultadoVerificacaoNome {
  existeIgual: boolean;
  existeParecido: boolean;
  existeExato?: boolean;
  temParecido?: boolean;
  nomeParecido?: string | null;
  mensagemAviso: string | null;
  pacienteConflitante?: {
    nome: string;
    turma?: string;
  };
}

/**
 * Ao digitar o nome do paciente, avisa sem bloquear quando existir nome igual ou parecido.
 * Reutiliza nomesParecidos e normalizarTextoComparacao.
 */
export function verificarNomeExistenteOuParecido(
  nomeDigitado: string,
  pacientesExistentes: PacienteParaVerificacaoNome[],
  pacienteIdAtual?: string
): ResultadoVerificacaoNome {
  if (!nomeDigitado || !nomeDigitado.trim()) {
    return {
      existeIgual: false,
      existeParecido: false,
      existeExato: false,
      temParecido: false,
      nomeParecido: null,
      mensagemAviso: null
    };
  }

  const nomeNorm = normalizarTextoComparacao(nomeDigitado);
  if (!nomeNorm) {
    return {
      existeIgual: false,
      existeParecido: false,
      existeExato: false,
      temParecido: false,
      nomeParecido: null,
      mensagemAviso: null
    };
  }

  for (const item of pacientesExistentes) {
    const p = typeof item === 'string' ? { id: undefined, nome: item, turma_nome: undefined } : item;
    if (pacienteIdAtual && p.id && p.id === pacienteIdAtual) {
      continue;
    }
    const nomeExistenteNorm = normalizarTextoComparacao(p.nome);
    const identificadorTurma = p.turma_nome ? ` (Turma ${p.turma_nome})` : '';

    if (nomeExistenteNorm === nomeNorm) {
      return {
        existeIgual: true,
        existeParecido: false,
        existeExato: true,
        temParecido: true,
        nomeParecido: p.nome,
        mensagemAviso: `Aviso: Ja existe um paciente cadastrado com este nome exato: "${p.nome}"${identificadorTurma}.`,
        pacienteConflitante: { nome: p.nome, turma: p.turma_nome }
      };
    }

    if (nomesParecidos(nomeDigitado, p.nome)) {
      return {
        existeIgual: false,
        existeParecido: true,
        existeExato: false,
        temParecido: true,
        nomeParecido: p.nome,
        mensagemAviso: `Aviso: Nome muito parecido com "${p.nome}"${identificadorTurma} ja cadastrado.`,
        pacienteConflitante: { nome: p.nome, turma: p.turma_nome }
      };
    }
  }

  return {
    existeIgual: false,
    existeParecido: false,
    existeExato: false,
    temParecido: false,
    nomeParecido: null,
    mensagemAviso: null
  };
}

/**
 * Filtra lista de pedidos por tipo (todos, alinhador, ortopedico).
 */
export function filtrarPedidosPorTipo<
  T extends { tipo?: TipoTratamento; paciente?: { tipo?: TipoTratamento } | null }
>(pedidos: T[], tipoFiltro: 'todos' | 'alinhador' | 'ortopedico'): T[] {
  if (tipoFiltro === 'todos') {
    return pedidos;
  }
  return pedidos.filter((p) => {
    const t = p.tipo || p.paciente?.tipo || 'alinhador';
    return t === tipoFiltro;
  });
}

/**
 * Filtra lista de pacientes por tipo (todos, alinhador, ortopedico).
 */
export function filtrarPacientesPorTipo<T extends { tipo?: TipoTratamento }>(
  pacientes: T[],
  tipoFiltro: 'todos' | 'alinhador' | 'ortopedico' = 'todos'
): T[] {
  if (!tipoFiltro || tipoFiltro === 'todos') {
    return pacientes;
  }
  return pacientes.filter((p) => {
    const t = p.tipo || 'alinhador';
    return t === tipoFiltro;
  });
}

/**
 * Monta o objeto de um novo pedido ortopedico gerado para um paciente
 * (ao criar o paciente ou ao cadastrar outro aparelho para o mesmo paciente).
 */
export function planejarNovoPedidoOrtopedico(
  pacienteOuDados:
    | { id: string; nome?: string; turma_id?: string; aparelho_previsto?: string | null }
    | { pacienteId: string; dataRetorno: string; aparelho?: string | null; observacao?: string | null },
  proximaDataRetorno?: string,
  aparelhoCustomizado?: string | null
): {
  paciente_id: string;
  data_retorno: string;
  aparelho: string;
  tipo: 'ortopedico';
  observacao: string | null;
  solicitado_em: string | null;
  mensagem_enviada_em: string | null;
} {
  let pacienteId = '';
  let dataRetorno = '';
  let aparelho = '';
  let observacao: string | null = null;

  if ('dataRetorno' in pacienteOuDados) {
    pacienteId = pacienteOuDados.pacienteId;
    dataRetorno = pacienteOuDados.dataRetorno;
    aparelho = pacienteOuDados.aparelho || 'Aparelho Ortopedico';
    observacao = pacienteOuDados.observacao || null;
  } else {
    pacienteId = pacienteOuDados.id;
    dataRetorno = proximaDataRetorno || '';
    aparelho = (aparelhoCustomizado || pacienteOuDados.aparelho_previsto || 'Aparelho Ortopedico').trim();
  }

  if (!dataRetorno) {
    throw new Error('Data de retorno e obrigatoria para gerar o pedido ortopedico');
  }

  return {
    paciente_id: pacienteId,
    data_retorno: dataRetorno,
    aparelho: aparelho.trim(),
    tipo: 'ortopedico',
    observacao,
    solicitado_em: null,
    mensagem_enviada_em: null
  };
}

export interface ParametrosPlanoSincronizacaoOrtopedicos {
  pacientes: Array<{
    id: string;
    turma_id: string;
    ativo: boolean;
    tipo?: TipoTratamento;
    aparelho_previsto?: string | null;
  }>;
  datasPorTurma: Record<string, string[]>;
  pedidosExistentes: Array<{
    id: string;
    paciente_id: string;
    data_retorno: string;
    tipo?: TipoTratamento;
    aparelho?: string | null;
    solicitado_em?: string | null;
  }>;
  hoje: string | Date;
}

export interface PedidoOrtopedicoParaInserir {
  paciente_id: string;
  data_retorno: string;
  tipo: 'ortopedico';
  aparelho: string;
}

export interface PlanoSincronizacaoOrtopedicos {
  inserir: PedidoOrtopedicoParaInserir[];
}

/**
 * Planeja a sincronizacao de pedidos ortopedicos:
 * Regra: um pedido por paciente (nao mensal, sob demanda).
 * Prazo: data_retorno = primeira data do proximo bloco clinico da turma menos antecedencia_ortopedico_dias.
 * Depois de solicitado, nao alerta de novo e nao gera novo pedido automatico nos proximos meses.
 * Novo aparelho cadastrado gera novo pedido.
 */
export function planejarSincronizacaoOrtopedicos(
  params: ParametrosPlanoSincronizacaoOrtopedicos
): PlanoSincronizacaoOrtopedicos {
  const { pacientes, datasPorTurma, pedidosExistentes, hoje } = params;
  const hojeISO = typeof hoje === 'string' ? hoje.substring(0, 10) : formatarDataISO(hoje);

  // Mapear pacientes ortopedicos que ja possuem algum pedido existente
  // (mesmo que ja solicitado ou pendente, pois e 1 pedido por paciente, nao mensal)
  const pacientesComPedido = new Set<string>();
  for (const ped of pedidosExistentes) {
    const tipo = ped.tipo || 'alinhador';
    if (tipo === 'ortopedico') {
      pacientesComPedido.add(ped.paciente_id);
    }
  }

  // Identificar proximo bloco por turma
  const proximaBasePorTurma: Record<string, string> = {};
  for (const [turmaId, datas] of Object.entries(datasPorTurma)) {
    if (!datas || datas.length === 0) continue;
    const blocos = agruparBlocos(datas);
    const prox = proximoBloco(blocos, hojeISO);
    if (prox) {
      proximaBasePorTurma[turmaId] = prox.base;
    }
  }

  const inserir: PedidoOrtopedicoParaInserir[] = [];

  for (const paciente of pacientes) {
    const tipo = paciente.tipo || 'alinhador';
    if (tipo !== 'ortopedico') continue;
    if (!paciente.ativo) continue;

    // Regra: se o paciente ja possui pedido de ortopedico, nao cria outro no ciclo automatico
    if (pacientesComPedido.has(paciente.id)) continue;

    const proxBase = proximaBasePorTurma[paciente.turma_id];
    if (!proxBase) continue;

    const aparelho = (paciente.aparelho_previsto && paciente.aparelho_previsto.trim()) || 'Aparelho Ortopedico';

    inserir.push({
      paciente_id: paciente.id,
      data_retorno: proxBase,
      tipo: 'ortopedico',
      aparelho
    });

    pacientesComPedido.add(paciente.id);
  }

  return { inserir };
}

