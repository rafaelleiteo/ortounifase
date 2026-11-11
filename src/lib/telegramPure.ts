import { formatarDataBR, formatarDataISO, parseDataLocal } from './alinhadoresTypes';
import { verificarNomeExistenteOuParecido, PacienteParaVerificacaoNome } from './ortopedicosPure';

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramSendMessagePayload {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
      text?: string;
    };
    data?: string;
  };
}

export type PassoCadastro =
  | 'aguardando_acao'
  | 'cadastro_nome'
  | 'cadastro_conflito_nome'
  | 'cadastro_turma'
  | 'cadastro_previsto'
  | 'cadastro_obs'
  | 'cadastro_confirmacao'
  | 'confirmar_solicitacao';

export interface TelegramDadosCadastro {
  tipo?: 'alinhador' | 'ortopedico';
  nome?: string;
  turma_id?: string;
  turma_nome?: string;
  previsto?: string | number | null;
  observacao?: string | null;
  conflitos?: Array<{ id: string; nome: string; turma?: string }>;
  pedido_id_confirmacao?: string;
  pedido_nome_confirmacao?: string;
  [key: string]: any;
}

export interface TelegramEstadoConversa {
  chat_id: number | string;
  passo: PassoCadastro;
  dados: TelegramDadosCadastro;
  updated_at: string;
}

/**
 * Valida o header X-Telegram-Bot-Api-Secret-Token enviado pelo Telegram no webhook.
 */
export function validarSecretToken(
  headerToken: string | null | undefined,
  secretEsperado: string | null | undefined
): boolean {
  if (!secretEsperado || secretEsperado.trim() === '') {
    return false;
  }
  if (!headerToken) {
    return false;
  }
  return headerToken.trim() === secretEsperado.trim();
}

/**
 * Verifica se o chat_id tem autorizacao para interagir com o bot.
 * Regra:
 * 1. Se TELEGRAM_ALLOWED_CHAT_ID nao estiver definido (modo inicial):
 *    - Se mensagem for /meuid, permite responder com o ID.
 *    - Qualquer outra mensagem e ignorada em silencio.
 * 2. Se TELEGRAM_ALLOWED_CHAT_ID estiver definido:
 *    - Somente o chat_id igual ao configurado e autorizado.
 *    - Todos os demais chats sao ignorados em silencio.
 */
export function verificarAutorizacaoChat(
  chatId: number | string,
  allowedChatId: string | null | undefined,
  text?: string
): { autorizado: boolean; modoConfiguracao: boolean; responderMeuId: boolean } {
  const allowed = allowedChatId ? allowedChatId.trim() : '';

  if (!allowed) {
    const isMeuId = !!text && text.trim().toLowerCase().startsWith('/meuid');
    return {
      autorizado: isMeuId,
      modoConfiguracao: true,
      responderMeuId: isMeuId
    };
  }

  const autorizado = String(chatId).trim() === allowed;
  return {
    autorizado,
    modoConfiguracao: false,
    responderMeuId: false
  };
}

/**
 * Verifica se o estado ativo da conversa expirou (limite de 30 minutos).
 */
export function verificarEstadoExpirado(
  updatedAt: string | Date,
  agora: string | Date = new Date(),
  limiteMinutos: number = 30
): boolean {
  const tUpdate = typeof updatedAt === 'string' ? new Date(updatedAt).getTime() : updatedAt.getTime();
  const tAgora = typeof agora === 'string' ? new Date(agora).getTime() : agora.getTime();
  const diffMs = tAgora - tUpdate;
  return diffMs > limiteMinutos * 60 * 1000;
}

/**
 * Valida o nome do paciente digitado pelo usuario (3 a 120 caracteres).
 */
export function validarNomePacienteTelegram(nome: string): {
  valido: boolean;
  nomeLimpo: string;
  erro?: string;
} {
  const nomeLimpo = (nome || '').trim();
  if (nomeLimpo.length < 3) {
    return {
      valido: false,
      nomeLimpo,
      erro: 'O nome do paciente deve conter pelo menos 3 caracteres.'
    };
  }
  if (nomeLimpo.length > 120) {
    return {
      valido: false,
      nomeLimpo,
      erro: 'O nome do paciente deve conter no maximo 120 caracteres.'
    };
  }
  return { valido: true, nomeLimpo };
}

/**
 * Valida o numero previsto de alinhadores (inteiro de 1 a 99).
 */
export function validarAlinhadoresPrevistos(val: string): {
  valido: boolean;
  numero: number | null;
  erro?: string;
} {
  const limpo = (val || '').trim();
  const num = parseInt(limpo, 10);
  if (isNaN(num) || num < 1 || num > 99) {
    return {
      valido: false,
      numero: null,
      erro: 'Informe um numero inteiro entre 1 e 99 para o total previsto de alinhadores.'
    };
  }
  return { valido: true, numero: num };
}

/**
 * Valida o aparelho ortopedico previsto (ate 100 caracteres).
 */
export function validarAparelhoPrevisto(val: string): {
  valido: boolean;
  texto: string | null;
  erro?: string;
} {
  const limpo = (val || '').trim();
  if (limpo.length > 100) {
    return {
      valido: false,
      texto: null,
      erro: 'O nome do aparelho previsto deve ter no maximo 100 caracteres.'
    };
  }
  return { valido: true, texto: limpo || null };
}

/**
 * Valida observacoes digitadas (ate 500 caracteres).
 */
export function validarObservacaoTelegram(val: string): {
  valido: boolean;
  texto: string | null;
  erro?: string;
} {
  const limpo = (val || '').trim();
  if (limpo.length > 500) {
    return {
      valido: false,
      texto: null,
      erro: 'A observacao deve ter no maximo 500 caracteres.'
    };
  }
  return { valido: true, texto: limpo || null };
}

/**
 * Monta o menu principal com teclado inline.
 */
export function gerarMenuPrincipalTelegram(): {
  texto: string;
  botoes: TelegramInlineKeyboardButton[][];
} {
  const texto =
    'OrtoUnifase - Alinhadores e Ortopedicos\n\n' +
    'Escolha uma das opcoes abaixo:';

  const botoes: TelegramInlineKeyboardButton[][] = [
    [
      { text: 'Novo paciente alinhador', callback_data: 'menu:novo_alinhador' },
      { text: 'Novo paciente ortopedico', callback_data: 'menu:novo_ortopedico' }
    ],
    [
      { text: 'Pedidos Pendentes', callback_data: 'menu:pendentes' }
    ]
  ];

  return { texto, botoes };
}

/**
 * Gera mensagem de texto para o resumo do cadastro e solicitacao de confirmacao.
 */
export function formatarResumoCadastro(dados: TelegramDadosCadastro): string {
  const tipoLabel = dados.tipo === 'ortopedico' ? 'Aparelho Ortopedico' : 'Alinhador';
  const previstoRotulo = dados.tipo === 'ortopedico' ? 'Aparelho Previsto' : 'Total Previsto';
  const previstoValor = dados.previsto !== undefined && dados.previsto !== null && String(dados.previsto).trim() !== ''
    ? String(dados.previsto)
    : 'Nao informado';
  const obsValor = dados.observacao ? dados.observacao : 'Nenhuma';

  return (
    'Confira os dados do novo paciente:\n\n' +
    '• Tipo: ' + tipoLabel + '\n' +
    '• Paciente: ' + dados.nome + '\n' +
    '• Turma: ' + (dados.turma_nome || dados.turma_id) + '\n' +
    '• ' + previstoRotulo + ': ' + previstoValor + '\n' +
    '• Observacao: ' + obsValor + '\n\n' +
    'Deseja confirmar o cadastro?'
  );
}

export interface ItemPendenteView {
  id: string;
  paciente_nome: string;
  turma_nome?: string;
  tipo: string;
  aparelho?: string | null;
  alinhador_de?: number | null;
  alinhador_ate?: number | null;
  status: 'atrasado' | 'vencendo' | string;
  prazo_formatado: string;
}

/**
 * Formata a lista de pedidos pendentes (vencendo ou atrasados), agrupados por tipo.
 */
export function formatarListaPendentes(pedidos: ItemPendenteView[]): string {
  const relevantes = pedidos.filter((p) => p.status === 'atrasado' || p.status === 'vencendo');
  if (relevantes.length === 0) {
    return 'Nenhum pedido de alinhador ou aparelho ortopedico esta pendente de solicitacao no momento.';
  }

  const alinhadores = relevantes.filter((p) => (p.tipo || 'alinhador') === 'alinhador');
  const ortopedicos = relevantes.filter((p) => p.tipo === 'ortopedico');

  const linhas: string[] = ['Pedidos Pendentes de Solicitacao:\n'];

  if (alinhadores.length > 0) {
    linhas.push('ALINHADORES:');
    for (const p of alinhadores) {
      const stLabel = p.status === 'atrasado' ? '[ATRASADO]' : '[VENCENDO]';
      const turma = p.turma_nome ? ' (' + p.turma_nome + ')' : '';
      linhas.push('• ' + stLabel + ' ' + p.paciente_nome + turma + ' - Prazo: ' + p.prazo_formatado);
    }
    linhas.push('');
  }

  if (ortopedicos.length > 0) {
    linhas.push('APARELHOS ORTOPEDICOS:');
    for (const p of ortopedicos) {
      const stLabel = p.status === 'atrasado' ? '[ATRASADO]' : '[VENCENDO]';
      const turma = p.turma_nome ? ' (' + p.turma_nome + ')' : '';
      const aparelho = p.aparelho ? ': ' + p.aparelho : '';
      linhas.push('• ' + stLabel + ' ' + p.paciente_nome + aparelho + turma + ' - Prazo: ' + p.prazo_formatado);
    }
  }

  return linhas.join('\n').trim();
}

export interface ItemAvisoDiario {
  id: string;
  paciente_nome: string;
  turma_nome?: string;
  tipo: string;
  aparelho?: string | null;
  status: 'atrasado' | 'vencendo';
  prazo_formatado: string;
}

/**
 * Monta o payload do aviso diario das 8h:
 * - So envia se houver pedidos vencendo ou atrasados (retorna null se lista vazia);
 * - Agrupa em Atrasados e Vencendo;
 * - Mostra tipo, nome, turma e prazo;
 * - Limite de ate 10 itens com sufixo 'e mais N, veja na plataforma';
 * - Gera botao 'Pedido feito: Nome' para cada um dos ate 10 itens.
 */
export function montarAvisoDiarioTelegram(
  itens: ItemAvisoDiario[],
  limiteMax: number = 10
): { texto: string; botoes: TelegramInlineKeyboardButton[][] } | null {
  const relevantes = itens.filter((i) => i.status === 'atrasado' || i.status === 'vencendo');
  if (relevantes.length === 0) {
    return null;
  }

  // Ordena atrasados primeiro, depois vencendo
  const ordenados = [...relevantes].sort((a, b) => {
    if (a.status === 'atrasado' && b.status !== 'atrasado') return -1;
    if (a.status !== 'atrasado' && b.status === 'atrasado') return 1;
    return a.paciente_nome.localeCompare(b.paciente_nome, 'pt-BR');
  });

  const selecionados = ordenados.slice(0, limiteMax);
  const excedente = ordenados.length - selecionados.length;

  const atrasados = selecionados.filter((i) => i.status === 'atrasado');
  const vencendo = selecionados.filter((i) => i.status === 'vencendo');

  const linhas: string[] = ['Aviso Diario de Pedidos - OrtoUnifase\n'];

  if (atrasados.length > 0) {
    linhas.push('ATRASADOS:');
    for (const item of atrasados) {
      const tipoLabel = item.tipo === 'ortopedico' ? 'Ortopedico' : 'Alinhador';
      const turma = item.turma_nome ? ' (' + item.turma_nome + ')' : '';
      const detalhe = item.tipo === 'ortopedico' && item.aparelho ? ' - ' + item.aparelho : '';
      linhas.push('• [' + tipoLabel + '] ' + item.paciente_nome + detalhe + turma + ' - Prazo: ' + item.prazo_formatado);
    }
    linhas.push('');
  }

  if (vencendo.length > 0) {
    linhas.push('VENCENDO:');
    for (const item of vencendo) {
      const tipoLabel = item.tipo === 'ortopedico' ? 'Ortopedico' : 'Alinhador';
      const turma = item.turma_nome ? ' (' + item.turma_nome + ')' : '';
      const detalhe = item.tipo === 'ortopedico' && item.aparelho ? ' - ' + item.aparelho : '';
      linhas.push('• [' + tipoLabel + '] ' + item.paciente_nome + detalhe + turma + ' - Prazo: ' + item.prazo_formatado);
    }
  }

  if (excedente > 0) {
    linhas.push('\n... e mais ' + excedente + ', veja na plataforma.');
  }

  const botoes: TelegramInlineKeyboardButton[][] = selecionados.map((item) => {
    const primeiroNome = item.paciente_nome.trim().split(' ')[0] || item.paciente_nome;
    return [
      {
        text: 'Pedido feito: ' + primeiroNome,
        callback_data: 'ped_feito:' + item.id
      }
    ];
  });

  return { texto: linhas.join('\n').trim(), botoes };
}

/**
 * Verifica se o aviso diario ja foi enviado na data atual (fuso local).
 */
export function verificarJaEnviouAvisoHoje(
  dataUltimoEnvio: string | null | undefined,
  hojeISO: string
): boolean {
  if (!dataUltimoEnvio) return false;
  const dataDia = dataUltimoEnvio.substring(0, 10);
  const hojeDia = hojeISO.substring(0, 10);
  return dataDia === hojeDia;
}
/**
 * Verifica duplicidade ou similaridade de nomes para o fluxo do Telegram.
 * Retorna ate 3 pacientes mais similares encontrados.
 */
export function verificarNomeSimilarTelegram(
  nomeNovo: string,
  pacientesExistentes: PacienteParaVerificacaoNome[]
): {
  temConflito: boolean;
  tipoConflito: 'exato' | 'similar' | null;
  conflitos: PacienteParaVerificacaoNome[];
} {
  const conflitos: PacienteParaVerificacaoNome[] = [];
  let temExato = false;

  for (const item of pacientesExistentes) {
    const res = verificarNomeExistenteOuParecido(nomeNovo, [item]);
    if (res.existeIgual || res.existeParecido) {
      if (res.existeIgual) temExato = true;
      conflitos.push(item);
      if (conflitos.length >= 3) break;
    }
  }

  if (conflitos.length === 0) {
    return { temConflito: false, tipoConflito: null, conflitos: [] };
  }

  return {
    temConflito: true,
    tipoConflito: temExato ? 'exato' : 'similar',
    conflitos
  };
}

/**
 * Trata decisao de conflito de nome no cadastro:
 * - 'criar_mesmo_assim': avanca para 'cadastro_turma'
 * - 'cancelar': cancela o fluxo e volta para 'aguardando_acao'
 */
export function processarDecisaoConflito(
  acao: 'criar_mesmo_assim' | 'cancelar',
  estadoAtual: TelegramEstadoConversa
): {
  proximoPasso: PassoCadastro;
  estadoAtualizado: TelegramEstadoConversa;
  mensagem: string;
} {
  if (acao === 'cancelar') {
    return {
      proximoPasso: 'aguardando_acao',
      estadoAtualizado: {
        ...estadoAtual,
        passo: 'aguardando_acao',
        dados: {},
        updated_at: new Date().toISOString()
      },
      mensagem: 'Cadastro cancelado.'
    };
  }

  return {
    proximoPasso: 'cadastro_turma',
    estadoAtualizado: {
      ...estadoAtual,
      passo: 'cadastro_turma',
      updated_at: new Date().toISOString()
    },
    mensagem: 'Selecione a turma do paciente:'
  };
}

/**
 * Processa a entrada da quantidade ou aparelho previsto:
 * Permite pular com 'pular' ou '/pular'.
 */
export function processarInputPrevisto(
  valor: string,
  tipo: 'alinhador' | 'ortopedico'
): {
  valido: boolean;
  pulou: boolean;
  valorFinal: number | string | null;
  erro?: string;
  proximoPasso: PassoCadastro;
} {
  const limpo = (valor || '').trim();
  if (limpo.toLowerCase() === 'pular' || limpo.toLowerCase() === '/pular') {
    return {
      valido: true,
      pulou: true,
      valorFinal: null,
      proximoPasso: 'cadastro_obs'
    };
  }

  if (tipo === 'alinhador') {
    const res = validarAlinhadoresPrevistos(limpo);
    if (!res.valido) {
      return {
        valido: false,
        pulou: false,
        valorFinal: null,
        erro: res.erro,
        proximoPasso: 'cadastro_previsto'
      };
    }
    return {
      valido: true,
      pulou: false,
      valorFinal: res.numero,
      proximoPasso: 'cadastro_obs'
    };
  } else {
    const res = validarAparelhoPrevisto(limpo);
    if (!res.valido) {
      return {
        valido: false,
        pulou: false,
        valorFinal: null,
        erro: res.erro,
        proximoPasso: 'cadastro_previsto'
      };
    }
    return {
      valido: true,
      pulou: false,
      valorFinal: res.texto,
      proximoPasso: 'cadastro_obs'
    };
  }
}

/**
 * Processa a entrada de observacao:
 * Permite pular com 'pular' ou '/pular'.
 */
export function processarInputObservacao(
  valor: string
): {
  valido: boolean;
  pulou: boolean;
  observacaoFinal: string | null;
  erro?: string;
  proximoPasso: PassoCadastro;
} {
  const limpo = (valor || '').trim();
  if (limpo.toLowerCase() === 'pular' || limpo.toLowerCase() === '/pular') {
    return {
      valido: true,
      pulou: true,
      observacaoFinal: null,
      proximoPasso: 'cadastro_confirmacao'
    };
  }

  const res = validarObservacaoTelegram(limpo);
  if (!res.valido) {
    return {
      valido: false,
      pulou: false,
      observacaoFinal: null,
      erro: res.erro,
      proximoPasso: 'cadastro_obs'
    };
  }

  return {
    valido: true,
    pulou: false,
    observacaoFinal: res.texto,
    proximoPasso: 'cadastro_confirmacao'
  };
}

/**
 * Valida se os dados acumulados estao prontos para gravacao no banco.
 */
export function validarDadosParaGravacao(dados: TelegramDadosCadastro): {
  valido: boolean;
  erro?: string;
} {
  if (!dados.nome || dados.nome.trim().length < 3) {
    return { valido: false, erro: 'Nome do paciente invalido ou ausente.' };
  }
  if (!dados.turma_id || dados.turma_id.trim() === '') {
    return { valido: false, erro: 'Turma nao selecionada.' };
  }
  if (!dados.tipo || (dados.tipo !== 'alinhador' && dados.tipo !== 'ortopedico')) {
    return { valido: false, erro: 'Tipo de paciente invalido.' };
  }
  return { valido: true };
}
