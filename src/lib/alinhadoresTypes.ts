/**
 * Tipos e Funções Puras do Módulo de Alinhadores
 * 
 * Regras de Negócio:
 * - ANTECEDENCIA_PEDIDO_DIAS = 20 dias antes da consulta de retorno
 * - Datas manipuladas exclusivamente no fuso local (sem new Date('AAAA-MM-DD') em UTC)
 * - Status do pedido: solicitado, atrasado, vencendo (0 a 5 dias antes do prazo) ou pendente
 * - Geração de mensagem formatada para a empresa sem travessão
 */

export const ANTECEDENCIA_PEDIDO_DIAS = 20;

// ------------------------------------------------------------------------------
// INTERFACES E TIPOS DE DADOS
// ------------------------------------------------------------------------------

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
  created_at?: string;
}

export type StatusPedido = 'solicitado' | 'atrasado' | 'vencendo' | 'pendente';

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
 * Data do retorno menos ANTECEDENCIA_PEDIDO_DIAS (20 dias).
 */
export function calcularPrazoLimite(dataRetorno: string | Date): Date {
  const d = typeof dataRetorno === 'string'
    ? parseDataLocal(dataRetorno)
    : new Date(dataRetorno.getFullYear(), dataRetorno.getMonth(), dataRetorno.getDate(), 0, 0, 0, 0);

  d.setDate(d.getDate() - ANTECEDENCIA_PEDIDO_DIAS);
  return d;
}

/**
 * Determina o status de um pedido com base na data do retorno e se já foi solicitado:
 * - 'solicitado' se solicitado_em existe;
 * - 'atrasado' se hoje > prazo;
 * - 'vencendo' se faltam de 0 a 5 dias para o prazo (inclusive hoje == prazo);
 * - 'pendente' se faltam mais de 5 dias para o prazo.
 */
export function calcularStatusPedido(
  pedido: { solicitado_em?: string | null; data_retorno: string | Date },
  hoje: string | Date = new Date()
): StatusPedido {
  if (pedido.solicitado_em) {
    return 'solicitado';
  }

  const prazo = calcularPrazoLimite(pedido.data_retorno);
  const h = typeof hoje === 'string'
    ? parseDataLocal(hoje)
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);

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
 * Gera mensagem formatada pronta para enviar à empresa fornecedora de alinhadores.
 * - Formato: "Prezados, solicitamos alinhadores para os pacientes abaixo:"
 * - Linhas: "- Nome do paciente: alinhadores 3 a 4, retorno previsto em dd/mm/aaaa"
 * - Se alinhador_de e alinhador_ate forem nulos: "- Nome: retorno previsto em dd/mm/aaaa"
 * - Se for um só: "- Nome: alinhador 3, retorno previsto em dd/mm/aaaa"
 * - Encerramento: "Agradecemos a confirmação do recebimento do pedido."
 * - Ordenação: por data de retorno.
 * - Sem travessão.
 */
export function gerarMensagemEmpresa(pedidos: PedidoParaMensagem[]): string {
  if (!pedidos || pedidos.length === 0) {
    return 'Prezados, não há pedidos de alinhadores para solicitar no momento.\n\nAgradecemos a confirmação do recebimento do pedido.';
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

  return [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    linhas.join('\n'),
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');
}
