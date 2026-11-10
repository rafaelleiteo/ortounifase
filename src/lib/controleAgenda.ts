import {
  canonicalizarDia,
  mesmoDia,
  rotuloDia,
  compararDiasSemana,
  DiaSemanaCanonica
} from './agendaDias';
import {
  normalizarTextoComparacao,
  isItemBloqueio,
  formatarHorarioExibicao
} from './agendaTypes';
import { nomesParecidos } from './solicitacoesImportacao';

export type ControleOrigem = 'mensal' | 'fixa' | 'avulso';

export type ControleStatus = 'atendido' | 'faltou' | 'desmarcou' | 'nao_marcou' | null;

export interface ControleItem {
  id: string;
  controle_id?: string;
  origem: ControleOrigem;
  dia_semana: DiaSemanaCanonica | string;
  data_atendimento?: string | null;
  horario: string;
  paciente: string;
  aluno_nome?: string | null;
  aluno_id?: string | null;
  status?: ControleStatus;
  observacao?: string | null;
  ordem?: number;
}

export interface ControleMes {
  id: string;
  turma_id: string;
  mes_referencia: string;
  importado_em?: string | null;
  salvo_em?: string | null;
  salvo_por?: string | null;
  updated_at?: string | null;
}

export interface ContadoresControle {
  atendidos: number;
  faltaram: number;
  desmarcaram: number;
  naoMarcaram: number;
  pendentes: number;
  total: number;
}

export interface SalvarControlePayload {
  p_turma_id: string;
  p_mes: string;
  p_itens: Array<{
    origem: ControleOrigem;
    dia_semana: string;
    data_atendimento: string | null;
    horario: string;
    paciente: string;
    aluno_nome: string | null;
    aluno_id: string | null;
    status: ControleStatus;
    observacao: string | null;
    ordem: number;
  }>;
  p_importado_em?: string | null;
}

export const STATUS_VALIDOS: Array<Exclude<ControleStatus, null>> = [
  'atendido',
  'faltou',
  'desmarcou',
  'nao_marcou'
];

/**
 * Valida o status do paciente.
 * Retorna null se vazio ou indefinido; lanca erro se valor for invalido.
 */
export function validarStatus(status: unknown): ControleStatus {
  if (status === null || status === undefined || status === '') {
    return null;
  }
  if (typeof status === 'string' && STATUS_VALIDOS.includes(status as any)) {
    return status as ControleStatus;
  }
  throw new Error(`Status invalido: "${status}". Valores permitidos: atendido, faltou, desmarcou, nao_marcou`);
}

/**
 * Alterna o estado de atendimento.
 * Clicar novamente no mesmo estado desmarca (retorna null / pendente).
 */
export function alternarStatus(
  statusAtual: ControleStatus | undefined,
  novoStatus: ControleStatus
): ControleStatus {
  if (!novoStatus) return null;
  if (statusAtual === novoStatus) {
    return null;
  }
  return novoStatus;
}

/**
 * Valida a observacao (limite de 500 caracteres).
 */
export function validarObservacao(obs?: string | null): {
  valida: boolean;
  erro?: string;
  valor: string | null;
} {
  if (obs === null || obs === undefined) {
    return { valida: true, valor: null };
  }
  const limpo = obs.trim();
  if (!limpo) {
    return { valida: true, valor: null };
  }
  if (limpo.length > 500) {
    return {
      valida: false,
      erro: `Observacao excede o limite de 500 caracteres (${limpo.length}/500)`,
      valor: null
    };
  }
  return { valida: true, valor: limpo };
}

/**
 * Verifica se um paciente da agenda fixa ja existe na agenda mensal.
 * Reutiliza exatamente a regra de comparacao do Passo 0 (mesmo dia canonico e
 * correspondencia exata normalizada ou aproximada via nomesParecidos).
 */
export function pacienteExisteNaMensal(
  pacienteFixa: string,
  diaFixa: string,
  itensMensal: Array<{
    paciente?: string | null;
    dia_semana?: string | null;
    tipo_registro?: string | null;
    tipo_bloqueio?: any;
  }>
): boolean {
  if (!pacienteFixa || !diaFixa) return false;
  const diaFixaCanonico = canonicalizarDia(diaFixa);
  if (!diaFixaCanonico) return false;

  const nomeFixaNorm = normalizarTextoComparacao(pacienteFixa);
  if (!nomeFixaNorm) return false;

  return itensMensal.some((m) => {
    if (
      !m ||
      isItemBloqueio({
        paciente: m.paciente || undefined,
        tipo_registro: m.tipo_registro || undefined,
        tipo_bloqueio: m.tipo_bloqueio || undefined
      })
    ) {
      return false;
    }
    const pMensal = (m.paciente || '').trim();
    if (!pMensal) return false;

    if (!mesmoDia(m.dia_semana, diaFixaCanonico)) {
      return false;
    }

    const nomeMensalNorm = normalizarTextoComparacao(pMensal);
    if (nomeMensalNorm === nomeFixaNorm) {
      return true;
    }

    if (nomesParecidos(pMensal, pacienteFixa)) {
      return true;
    }

    return false;
  });
}

/**
 * Regra de remocao de item do controle:
 * Apenas pacientes com origem 'avulso' podem ser removidos.
 * Linhas importadas da Mensal ou Fixa nao podem ser removidas.
 */
export function podeRemoverItem(item: { origem: ControleOrigem }): boolean {
  return item.origem === 'avulso';
}

/**
 * Formata horario para formato padronizado de exibicao (HH:MM).
 */
export function formatarHorarioControle(h?: string | null): string {
  if (!h) return '00:00';
  return formatarHorarioExibicao(h);
}

/**
 * Ordena itens do controle por dia da semana e horario, preservando a ordem original
 * em caso de empate (pacientes repetidos no mesmo horario sao permitidos).
 */
export function ordenarControleItens(itens: ControleItem[]): ControleItem[] {
  return itens
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      // 1. Compara dia da semana
      const diffDia = compararDiasSemana(a.item.dia_semana, b.item.dia_semana);
      if (diffDia !== 0) return diffDia;

      // 2. Compara horario (HH:MM)
      const hA = formatarHorarioControle(a.item.horario);
      const hB = formatarHorarioControle(b.item.horario);
      if (hA < hB) return -1;
      if (hA > hB) return 1;

      // 3. Ordem estavel original
      return a.idx - b.idx;
    })
    .map((wrapper) => wrapper.item);
}

/**
 * Gera um identificador unico local temporario.
 */
function gerarIdTemporario(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'temp-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
}

/**
 * Monta a lista inicial para a tela a partir dos registros de agenda_mensal e agenda_fixa.
 * - Inclui todos os pacientes validos de agenda_mensal (origem 'mensal').
 * - Inclui os pacientes validos de agenda_fixa que nao constam na mensal daquele dia (origem 'fixa', badge "So na Fixa").
 * - Ordena por dia e horario, atribuindo a propriedade ordem (1-indexed).
 */
export interface ItemImportacaoEntrada {
  id?: string;
  paciente?: string | null;
  aluno?: string | null;
  aluno_id?: string | null;
  agenda_alunos?: { id?: any; nome?: string | null } | Array<{ id?: any; nome?: string | null }> | null;
  horario?: string | null;
  dia_semana?: string | null;
  tipo_registro?: string | null;
  tipo_bloqueio?: any;
  observacao?: string | null;
}

/**
 * Extrai o nome do aluno considerando retorno objeto ou array do join Supabase.
 */
function extrairNomeAluno(item: ItemImportacaoEntrada): string | null {
  if (item.aluno && item.aluno.trim()) return item.aluno.trim();
  if (Array.isArray(item.agenda_alunos)) {
    return item.agenda_alunos[0]?.nome || null;
  }
  return item.agenda_alunos?.nome || null;
}

/**
 * Monta a lista inicial para a tela a partir dos registros de agenda_mensal e agenda_fixa.
 * - Inclui todos os pacientes validos de agenda_mensal (origem 'mensal').
 * - Inclui os pacientes validos de agenda_fixa que nao constam na mensal daquele dia (origem 'fixa', badge "So na Fixa").
 * - Ordena por dia e horario, atribuindo a propriedade ordem (1-indexed).
 */
export function montarListaImportacao(
  itensMensal: ItemImportacaoEntrada[],
  itensFixa: ItemImportacaoEntrada[]
): ControleItem[] {
  const resultado: ControleItem[] = [];

  // 1. Processa itens da Mensal
  const validosMensal = (itensMensal || []).filter(
    (m) =>
      m &&
      !isItemBloqueio({
        paciente: m.paciente || undefined,
        tipo_registro: m.tipo_registro || undefined,
        tipo_bloqueio: m.tipo_bloqueio || undefined
      }) &&
      Boolean(m.paciente && m.paciente.trim())
  );

  for (const m of validosMensal) {
    const diaCanonico = canonicalizarDia(m.dia_semana) || 'QUINTA';
    const nomeAluno = extrairNomeAluno(m);
    resultado.push({
      id: gerarIdTemporario(),
      origem: 'mensal',
      dia_semana: diaCanonico,
      data_atendimento: null,
      horario: formatarHorarioControle(m.horario),
      paciente: (m.paciente || '').trim(),
      aluno_nome: nomeAluno,
      aluno_id: m.aluno_id || null,
      status: null,
      observacao: m.observacao || null
    });
  }

  // 2. Processa itens da Fixa que nao estao na Mensal
  const validosFixa = (itensFixa || []).filter(
    (f) =>
      f &&
      !isItemBloqueio({
        paciente: f.paciente || undefined,
        tipo_registro: f.tipo_registro || undefined,
        tipo_bloqueio: f.tipo_bloqueio || undefined
      }) &&
      Boolean(f.paciente && f.paciente.trim())
  );

  for (const f of validosFixa) {
    const diaCanonico = canonicalizarDia(f.dia_semana) || 'QUINTA';
    const estaNaMensal = pacienteExisteNaMensal(f.paciente || '', diaCanonico, validosMensal);

    if (!estaNaMensal) {
      const nomeAluno = extrairNomeAluno(f);
      resultado.push({
        id: gerarIdTemporario(),
        origem: 'fixa',
        dia_semana: diaCanonico,
        data_atendimento: null,
        horario: formatarHorarioControle(f.horario),
        paciente: (f.paciente || '').trim(),
        aluno_nome: nomeAluno,
        aluno_id: f.aluno_id || null,
        status: null,
        observacao: f.observacao || null
      });
    }
  }

  // 3. Ordena e atribui sequencia
  const ordenados = ordenarControleItens(resultado);
  return ordenados.map((item, index) => ({
    ...item,
    ordem: index + 1
  }));
}

/**
 * Calcula os contadores do mes para o cabecalho.
 */
export function calcularContadoresControle(itens: ControleItem[]): ContadoresControle {
  let atendidos = 0;
  let faltaram = 0;
  let desmarcaram = 0;
  let naoMarcaram = 0;
  let pendentes = 0;

  for (const item of itens) {
    switch (item.status) {
      case 'atendido':
        atendidos += 1;
        break;
      case 'faltou':
        faltaram += 1;
        break;
      case 'desmarcou':
        desmarcaram += 1;
        break;
      case 'nao_marcou':
        naoMarcaram += 1;
        break;
      default:
        pendentes += 1;
        break;
    }
  }

  return {
    atendidos,
    faltaram,
    desmarcaram,
    naoMarcaram,
    pendentes,
    total: itens.length
  };
}

/**
 * Normaliza o formato do mes de referencia para 'YYYY-MM-01'.
 * Nao utiliza objeto Date nem toISOString.
 */
export function normalizarMesReferencia(mes: string): string {
  if (!mes || typeof mes !== 'string') {
    throw new Error('Mes de referencia invalido');
  }
  const limpo = mes.trim();
  const partes = limpo.split('-');
  if (partes.length >= 2) {
    const ano = partes[0].padStart(4, '0');
    const mesNum = partes[1].padStart(2, '0');
    return `${ano}-${mesNum}-01`;
  }
  throw new Error(`Formato de mes de referencia invalido: "${mes}". Esperado AAAA-MM ou AAAA-MM-DD`);
}

/**
 * Extrai ano e mes no formato 'YYYY-MM' a partir de string de mes de referencia.
 */
export function extrairAnoMes(mesReferencia: string): string {
  if (!mesReferencia) return '';
  const partes = mesReferencia.trim().split('-');
  if (partes.length >= 2) {
    return `${partes[0].padStart(4, '0')}-${partes[1].padStart(2, '0')}`;
  }
  return mesReferencia;
}

/**
 * Monta o payload para chamada da funcao SQL controle_agenda_salvar.
 */
export function montarPayloadSalvar(
  turmaId: string,
  mesReferencia: string,
  itens: ControleItem[],
  importadoEm?: string | null
): SalvarControlePayload {
  if (!turmaId || typeof turmaId !== 'string') {
    throw new Error('turmaId e obrigatorio para salvar o controle de agenda');
  }

  const mesNorm = normalizarMesReferencia(mesReferencia);

  const ordenados = ordenarControleItens(itens);

  const itensPayload = ordenados.map((item, index) => {
    const diaCanonico = canonicalizarDia(item.dia_semana);
    if (!diaCanonico) {
      throw new Error(`Dia da semana invalido no item ${item.paciente}: "${item.dia_semana}"`);
    }

    const obsVal = validarObservacao(item.observacao);
    if (!obsVal.valida) {
      throw new Error(obsVal.erro || 'Observacao invalida');
    }

    const statusVal = validarStatus(item.status);

    return {
      origem: item.origem,
      dia_semana: diaCanonico,
      data_atendimento: item.data_atendimento || null,
      horario: formatarHorarioControle(item.horario),
      paciente: item.paciente.trim(),
      aluno_nome: item.aluno_nome ? item.aluno_nome.trim() : null,
      aluno_id: item.aluno_id || null,
      status: statusVal,
      observacao: obsVal.valor,
      ordem: index + 1
    };
  });

  return {
    p_turma_id: turmaId,
    p_mes: mesNorm,
    p_itens: itensPayload,
    p_importado_em: importadoEm || null
  };
}
