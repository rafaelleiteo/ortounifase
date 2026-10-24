/**
 * Tipos e Funções Puras do Módulo de Alinhadores
 * 
 * Regras de Negócio:
 * - ANTECEDENCIA_PEDIDO_DIAS = 20 dias (padrão configurável)
 * - Datas manipuladas exclusivamente no fuso local (sem new Date('AAAA-MM-DD') em UTC)
 * - Status do pedido: solicitado, expirado, atrasado, vencendo ou pendente
 * - Geração de mensagem formatada para a empresa com template editável ({lista} e {pacientes}) sem travessão
 */

export const ANTECEDENCIA_PEDIDO_DIAS = 20;

export const TEMPLATE_MENSAGEM_PADRAO =
  'Olá, passando para informar que solicitamos alinhadores para os pacientes abaixo:\n\n{lista}\n\nAgradecemos a confirmação do recebimento do pedido.';

// ------------------------------------------------------------------------------
// INTERFACES E TIPOS DE DADOS
// ------------------------------------------------------------------------------

export interface Turma {
  id: string;
  nome: string;
}

export interface AlinhadorConfig {
  id: boolean;
  antecedencia_dias: number;
  quantidade_por_pedido: number;
  template_mensagem: string;
  updated_at?: string;
}

export interface AlinhadorCalendario {
  id: string;
  turma_id: string;
  data: string; // 'AAAA-MM-DD'
  created_at?: string;
}

export interface AlinhadorPaciente {
  id: string;
  nome: string;
  turma_id: string;
  total_alinhadores: number | null;
  observacao: string | null;
  ativo: boolean;
  created_at?: string;
}

export interface AlinhadorPedido {
  id: string;
  paciente_id: string;
  data_retorno: string; // 'AAAA-MM-DD'
  alinhador_de: number | null;
  alinhador_ate: number | null;
  solicitado_em: string | null; // ISO timestamptz
  lote_id: string | null;
  mensagem_enviada_em?: string | null; // ISO timestamptz
  created_at?: string;
}

export type StatusPedido = 'solicitado' | 'expirado' | 'atrasado' | 'vencendo' | 'pendente';

export interface PedidoComPaciente extends AlinhadorPedido {
  paciente?: Pick<AlinhadorPaciente, 'id' | 'nome' | 'turma_id' | 'total_alinhadores' | 'ativo'> | null;
}

export interface PedidoParaMensagem {
  paciente_nome: string;
  data_retorno: string | Date;
  alinhador_de?: number | null;
  alinhador_ate?: number | null;
}

export interface ResultadoSolicitacao {
  pedidos: Array<AlinhadorPedido & { paciente_nome: string }>;
  ignorados: number;
}

// ------------------------------------------------------------------------------
// FUNÇÕES PURAS DE DATAS E CÁLCULOS
// ------------------------------------------------------------------------------

/**
 * Converte string 'AAAA-MM-DD' em objeto Date local às 00:00:00.
 * NUNCA usa new Date('AAAA-MM-DD') para evitar deslocamento de fuso UTC no Brasil.
 */
export function parseDataLocal(dataStr: string): Date {
  const limpa = dataStr.substring(0, 10);
  const [ano, mes, dia] = limpa.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

/**
 * Converte Date para string ISO 'AAAA-MM-DD' usando ano, mês e dia locais.
 */
export function formatarDataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata data no formato brasileiro 'dd/mm/aaaa'.
 */
export function formatarDataBR(data: string | Date): string {
  if (typeof data === 'string') {
    const limpa = data.substring(0, 10);
    const partes = limpa.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      const [ano, mes, dia] = partes;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
    data = parseDataLocal(data);
  }
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Calcula o prazo limite para solicitar os alinhadores:
 * Data do retorno menos antecedenciaDias (padrão 20 dias).
 */
export function calcularPrazoLimite(
  dataRetorno: string | Date,
  antecedenciaDias: number = ANTECEDENCIA_PEDIDO_DIAS
): Date {
  const d = typeof dataRetorno === 'string'
    ? parseDataLocal(dataRetorno)
    : new Date(dataRetorno.getFullYear(), dataRetorno.getMonth(), dataRetorno.getDate(), 0, 0, 0, 0);

  d.setDate(d.getDate() - antecedenciaDias);
  return d;
}

/**
 * Determina o status de um pedido com base na data do retorno, se já foi solicitado e antecedência:
 * - 'solicitado': se solicitado_em existe;
 * - 'expirado': se NÃO solicitado e data_retorno <= hoje;
 * - 'atrasado': se hoje > prazo limite (diff < 0);
 * - 'vencendo': se faltam de 0 a 5 dias para o prazo limite (inclusive hoje == prazo);
 * - 'pendente': se faltam mais de 5 dias para o prazo limite.
 */
export function calcularStatusPedido(
  pedido: { solicitado_em?: string | null; data_retorno: string | Date },
  hoje: string | Date = new Date(),
  antecedenciaDias: number = ANTECEDENCIA_PEDIDO_DIAS
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

  // Se a data de retorno já passou ou é hoje e não foi solicitado, o pedido está expirado
  if (retornoDate.getTime() <= h.getTime()) {
    return 'expirado';
  }

  const prazo = calcularPrazoLimite(pedido.data_retorno, antecedenciaDias);

  // Diferença em dias: prazo - hoje
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
 * Formata lista de nomes para uso em mensagens:
 * - 1 paciente: "Ana Silva"
 * - 2 pacientes: "Ana Silva e Bruno Costa"
 * - 3+ pacientes: "Ana Silva, Bruno Costa e Carlos Dias"
 */
export function formatarListaNomes(nomes: string[]): string {
  if (!nomes || nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Gera mensagem formatada pronta para enviar à empresa fornecedora de alinhadores.
 * - Suporta marcadores no template:
 *   - {lista}: uma linha por paciente ("- Nome: alinhadores 3 a 4, retorno previsto em dd/mm/aaaa")
 *   - {pacientes}: apenas os nomes ("Ana Silva, Bruno Costa e Carlos Dias")
 * - Se o template não contiver nenhum marcador, anexa a {lista} ao final.
 * - Ordenação: por data de retorno ascendente.
 * - Sem travessão.
 */
export function gerarMensagemEmpresa(
  pedidos: PedidoParaMensagem[],
  template?: string
): string {
  if (!pedidos || pedidos.length === 0) {
    return 'Olá, não há pedidos de alinhadores para solicitar no momento.\n\nAgradecemos a confirmação do recebimento do pedido.';
  }

  // Ordenar por data de retorno ascendente
  const ordenados = [...pedidos].sort((a, b) => {
    const da = typeof a.data_retorno === 'string' ? a.data_retorno : formatarDataISO(a.data_retorno);
    const db = typeof b.data_retorno === 'string' ? b.data_retorno : formatarDataISO(b.data_retorno);
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return a.paciente_nome.localeCompare(b.paciente_nome, 'pt-BR');
  });

  const linhas = ordenados.map((p) => {
    const dataBR = formatarDataBR(p.data_retorno);
    const temDe = p.alinhador_de !== null && p.alinhador_de !== undefined;
    const temAte = p.alinhador_ate !== null && p.alinhador_ate !== undefined;

    let trechoAlinhador = '';
    if (temDe && temAte) {
      if (p.alinhador_de === p.alinhador_ate) {
        trechoAlinhador = `alinhador ${p.alinhador_de}, `;
      } else {
        trechoAlinhador = `alinhadores ${p.alinhador_de} a ${p.alinhador_ate}, `;
      }
    } else if (temDe) {
      trechoAlinhador = `alinhador ${p.alinhador_de}, `;
    } else if (temAte) {
      trechoAlinhador = `alinhador ${p.alinhador_ate}, `;
    }

    return `- ${p.paciente_nome}: ${trechoAlinhador}retorno previsto em ${dataBR}`;
  });

  const textoLista = linhas.join('\n');
  const nomes = ordenados.map((p) => p.paciente_nome);
  const textoPacientes = formatarListaNomes(nomes);

  const tmpl = template && template.trim() ? template : TEMPLATE_MENSAGEM_PADRAO;
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
 * Representa um bloco de dias consecutivos de clinica de uma turma.
 * - base: primeira data do bloco ('AAAA-MM-DD')
 * - fim: ultima data do bloco ('AAAA-MM-DD')
 * - dias: lista de todas as datas do bloco em ordem crescente
 */
export interface BlocoClinica {
  base: string;
  fim: string;
  dias: string[];
}

/**
 * Agrupa as datas de uma turma em blocos de dias consecutivos (diferenca de exatamente 1 dia).
 * - Ignora duplicatas.
 * - Ordena as datas antes de agrupar.
 * - Retorna array de BlocoClinica, cada um com base = primeira data do bloco.
 * - NUNCA usa new Date('AAAA-MM-DD') nem toISOString para evitar deslocamento de fuso.
 */
export function agruparBlocos(datas: string[]): BlocoClinica[] {
  if (!datas || datas.length === 0) return [];

  // Remover duplicatas e ordenar
  const unicas = Array.from(new Set(datas.map((d) => d.substring(0, 10))));
  unicas.sort();

  const blocos: BlocoClinica[] = [];
  let blocoAtual: string[] = [unicas[0]];

  for (let i = 1; i < unicas.length; i++) {
    const anterior = parseDataLocal(unicas[i - 1]);
    const atual = parseDataLocal(unicas[i]);
    // Diferenca em dias
    const diffMs = atual.getTime() - anterior.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 1) {
      // Dia consecutivo: continua o bloco atual
      blocoAtual.push(unicas[i]);
    } else {
      // Nao consecutivo: fecha o bloco atual e abre um novo
      blocos.push({
        base: blocoAtual[0],
        fim: blocoAtual[blocoAtual.length - 1],
        dias: [...blocoAtual],
      });
      blocoAtual = [unicas[i]];
    }
  }

  // Fechar o ultimo bloco
  blocos.push({
    base: blocoAtual[0],
    fim: blocoAtual[blocoAtual.length - 1],
    dias: [...blocoAtual],
  });

  return blocos;
}

/**
 * Retorna o primeiro bloco cuja base seja estritamente maior que hoje.
 * - hoje: string 'AAAA-MM-DD' ou Date.
 * - Retorna null se nao houver bloco futuro.
 * - Se hoje coincidir com a base de um bloco, esse bloco NAO e retornado (deve ser o seguinte).
 * - Se hoje estiver dentro de um bloco (nao na base), o proximo bloco e o seguinte.
 */
export function proximoBloco(blocos: BlocoClinica[], hoje: string | Date): BlocoClinica | null {
  if (!blocos || blocos.length === 0) return null;

  const h = typeof hoje === 'string'
    ? parseDataLocal(hoje)
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);

  for (const bloco of blocos) {
    const base = parseDataLocal(bloco.base);
    if (base.getTime() > h.getTime()) {
      return bloco;
    }
  }

  return null;
}

/**
 * Interface de entrada para o plano de sincronização (função pura).
 */
export interface ParametrosPlanoSincronizacao {
  pacientes: Array<{ id: string; turma_id: string; ativo: boolean }>;
  datasPorTurma: Record<string, string[]>;
  pedidosExistentes: Array<{
    id: string;
    paciente_id: string;
    data_retorno: string;
    solicitado_em: string | null;
  }>;
  hoje: string | Date;
}

/**
 * Resultado do plano puro de sincronização:
 * - inserir: lista de novos pedidos a serem criados
 * - apagarIds: IDs de pedidos obsoletos a serem excluídos
 */
export interface PlanoSincronizacao {
  inserir: Array<{ paciente_id: string; data_retorno: string }>;
  apagarIds: string[];
}

/**
 * Função PURA que decide as inserções e remoções de sincronização de próximos retornos.
 * Regras estritas:
 * 1. Para cada paciente ATIVO cuja turma tenha um próximo bloco clínico (base > hoje),
 *    garante um pedido com data_retorno = base do próximo bloco, caso ainda não exista.
 * 2. Se a turma não tiver nenhuma data no calendário ou não tiver bloco futuro,
 *    NÃO apaga nenhum pedido dessa turma e NÃO gera inserções.
 * 3. Apaga SOMENTE pedidos que atendem a TODAS as condições:
 *    - Pertencem a uma turma que POSSUI pelo menos um bloco futuro cadastrado
 *    - solicitado_em é NULL (nunca apaga pedidos solicitados)
 *    - data_retorno é estritamente maior que hoje (data_retorno > hoje, nunca apaga pedidos passados/hoje)
 *    - data_retorno NÃO é a base de nenhum bloco atual daquela turma
 * 4. Idempotência: rodar duas vezes sobre o mesmo estado gera plano vazio { inserir: [], apagarIds: [] }.
 */
export function planejarSincronizacao(
  params: ParametrosPlanoSincronizacao
): PlanoSincronizacao {
  const { pacientes, datasPorTurma, pedidosExistentes, hoje } = params;

  const hojeISO = typeof hoje === 'string' ? hoje.substring(0, 10) : formatarDataISO(hoje);

  // Mapear turmas de cada paciente
  const turmaPorPaciente: Record<string, string> = {};
  for (const p of pacientes) {
    turmaPorPaciente[p.id] = p.turma_id;
  }

  // Identificar blocos por turma e determinar turmas com bloco futuro
  const proximaBasePorTurma: Record<string, string> = {};
  const basesValidasPorTurma: Record<string, Set<string>> = {};
  const turmasComBlocoFuturo = new Set<string>();

  for (const [turmaId, datas] of Object.entries(datasPorTurma)) {
    if (!datas || datas.length === 0) continue;
    const blocos = agruparBlocos(datas);
    basesValidasPorTurma[turmaId] = new Set(blocos.map((b) => b.base));

    const prox = proximoBloco(blocos, hojeISO);
    if (prox) {
      proximaBasePorTurma[turmaId] = prox.base;
      turmasComBlocoFuturo.add(turmaId);
    }
  }

  // 1. Determinar pedidos a inserir (apenas pacientes ativos cuja turma tenha próximo bloco)
  const pedidosExistentesSet = new Set(
    pedidosExistentes.map((p) => `${p.paciente_id}:${p.data_retorno}`)
  );

  const inserir: Array<{ paciente_id: string; data_retorno: string }> = [];

  for (const paciente of pacientes) {
    if (!paciente.ativo) continue;
    const proxBase = proximaBasePorTurma[paciente.turma_id];
    if (!proxBase) continue;

    const chave = `${paciente.id}:${proxBase}`;
    if (!pedidosExistentesSet.has(chave)) {
      inserir.push({
        paciente_id: paciente.id,
        data_retorno: proxBase
      });
      pedidosExistentesSet.add(chave); // Evita duplicata se houver paciente repetido na lista
    }
  }

  // 2. Determinar pedidos a apagar
  const apagarIds: string[] = [];

  for (const ped of pedidosExistentes) {
    // Regra: nunca apagar pedidos solicitados
    if (ped.solicitado_em !== null && ped.solicitado_em !== undefined) {
      continue;
    }

    // Regra: nunca apagar pedidos com data_retorno <= hoje
    if (ped.data_retorno <= hojeISO) {
      continue;
    }

    const turmaId = turmaPorPaciente[ped.paciente_id];
    // Se paciente desconhecido ou turma sem bloco futuro cadastrado, NÃO apagar
    if (!turmaId || !turmasComBlocoFuturo.has(turmaId)) {
      continue;
    }

    const basesValidas = basesValidasPorTurma[turmaId] || new Set();
    // Apaga apenas se a data de retorno NÃO for a base de nenhum bloco atual da turma
    if (!basesValidas.has(ped.data_retorno)) {
      apagarIds.push(ped.id);
    }
  }

  return { inserir, apagarIds };
}
