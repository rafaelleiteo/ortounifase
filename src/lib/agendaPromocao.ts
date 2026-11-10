/**
 * Funcoes puras para promocao de paciente da agenda mensal para a agenda fixa.
 * Avalia candidatos existentes na agenda fixa, detecta diferencas de dia, horario
 * ou aluno, e planeja a acao adequada (CRIAR, ATUALIZAR, ESCOLHER ou NADA).
 */

import { nomesParecidos } from './solicitacoesImportacao';
import {
  AgendaFixaItem,
  AgendaMensalItem,
  canonicalizarDia,
  normalizarHorario,
  normalizarTextoComparacao,
  isItemBloqueio,
  mesmoDia
} from './agendaTypes';

export type AcaoPromocao = 'CRIAR' | 'ATUALIZAR' | 'ESCOLHER' | 'NADA';

export type TipoMatchPromocao = 'exato' | 'parecido';

export interface CandidatoPromocao {
  item: AgendaFixaItem;
  tipoMatch: TipoMatchPromocao;
}

export interface DetalhesDiferenca {
  diaMudou: boolean;
  horarioMudou: boolean;
  alunoMudou: boolean;
  diaAntes: string;
  diaDepois: string;
  horarioAntes: string;
  horarioDepois: string;
  alunoAntes: string;
  alunoDepois: string;
}

export interface DadosDepoisPromocao {
  paciente: string;
  dia_semana: string; // canonico
  horario: string; // HH:MM:SS
  aluno_id: string | null;
  aluno?: string | null;
}

export interface PlanoPromocao {
  acao: AcaoPromocao;
  candidatos: CandidatoPromocao[];
  itemEscolhido?: AgendaFixaItem;
  diferenca?: DetalhesDiferenca;
  depois: DadosDepoisPromocao;
  motivo: string;
}

export interface ItemLotePromocao {
  itemMensal: AgendaMensalItem | any;
  plano: PlanoPromocao;
  selecionado: boolean;
}

/**
 * Funcao pura para planejar a promocao de um item da agenda mensal para a fixa.
 */
export function planejarPromocao(params: {
  itemMensal: AgendaMensalItem | any;
  fixaItens: AgendaFixaItem[] | any[];
}): PlanoPromocao {
  const itemM = params.itemMensal;
  const pacienteMensal = (itemM?.paciente || '').trim();

  // 1. Bloqueios e itens invalidos nao sao promovidos
  if (!itemM || isItemBloqueio(itemM) || !pacienteMensal) {
    return {
      acao: 'NADA',
      candidatos: [],
      depois: {
        paciente: pacienteMensal,
        dia_semana: canonicalizarDia(itemM?.dia_semana || 'QUINTA') || 'QUINTA',
        horario: normalizarHorario(itemM?.horario || '08:00'),
        aluno_id: null,
        aluno: null
      },
      motivo: 'Item de bloqueio ou registro sem paciente nao pode ser promovido para a fixa'
    };
  }

  // 2. Monta os dados finais desejados (depois).
  // A observacao mensal NUNCA e copiada para a fixa.
  const diaCanonical = canonicalizarDia(itemM.dia_semana) || (itemM.dia_semana ? String(itemM.dia_semana).trim().toUpperCase() : 'QUINTA');
  const horarioNorm = normalizarHorario(itemM.horario);
  const alunoIdMensal = itemM.aluno_id || null;
  const alunoNomeMensal = alunoIdMensal
    ? (itemM.aluno || itemM.agenda_alunos?.nome || null)
    : (itemM.aluno || 'ATENDIMENTO EXTRA');

  const depois: DadosDepoisPromocao = {
    paciente: pacienteMensal,
    dia_semana: diaCanonical,
    horario: horarioNorm,
    aluno_id: alunoIdMensal,
    aluno: alunoNomeMensal
  };

  // 3. Filtra itens validos da agenda fixa (ignora bloqueios e linhas vazias)
  const validosFixa = (params.fixaItens || []).filter(
    (f) => f && !isItemBloqueio(f) && Boolean(f?.paciente?.trim())
  );

  // 4. Busca correspondencias exatas
  const nomeMensalNorm = normalizarTextoComparacao(pacienteMensal);
  const exatos = validosFixa.filter(
    (f) => normalizarTextoComparacao(f.paciente) === nomeMensalNorm
  );

  let candidatos: CandidatoPromocao[] = [];
  if (exatos.length > 0) {
    candidatos = exatos.map((item) => ({ item, tipoMatch: 'exato' }));
  } else {
    // Busca correspondencias parecidas se nao houver nenhuma exata
    const parecidos = validosFixa.filter((f) =>
      nomesParecidos(pacienteMensal, f.paciente)
    );
    candidatos = parecidos.map((item) => ({ item, tipoMatch: 'parecido' }));
  }

  // 5. Decisao sobre a acao
  if (candidatos.length === 0) {
    return {
      acao: 'CRIAR',
      candidatos: [],
      depois,
      motivo: 'Paciente nao encontrado na agenda fixa'
    };
  }

  if (candidatos.length > 1) {
    return {
      acao: 'ESCOLHER',
      candidatos,
      depois,
      motivo: 'Multiplos pacientes encontrados na agenda fixa'
    };
  }

  // Apenas 1 candidato
  const candidatoUnico = candidatos[0];
  if (candidatoUnico.tipoMatch === 'parecido') {
    return {
      acao: 'ESCOLHER',
      candidatos,
      itemEscolhido: candidatoUnico.item,
      depois,
      motivo: 'Paciente com grafia parecida encontrado na agenda fixa'
    };
  }

  // 1 candidato exato: compara dia, horario e aluno
  const fixaExistente = candidatoUnico.item;
  const diaMudou = !mesmoDia(fixaExistente.dia_semana, depois.dia_semana);
  const horarioMudou = normalizarHorario(fixaExistente.horario) !== depois.horario;

  const alunoFixaNome = fixaExistente.aluno_id
    ? (fixaExistente.aluno || fixaExistente.agenda_alunos?.nome || '')
    : (fixaExistente.aluno || 'ATENDIMENTO EXTRA');
  const alunoDepoisNome = depois.aluno_id
    ? (depois.aluno || '')
    : (depois.aluno || 'ATENDIMENTO EXTRA');

  let alunoMudou = false;
  if (Boolean(fixaExistente.aluno_id) !== Boolean(depois.aluno_id)) {
    alunoMudou = true;
  } else if (fixaExistente.aluno_id && depois.aluno_id) {
    alunoMudou = fixaExistente.aluno_id !== depois.aluno_id;
  } else {
    // Ambos sem aluno_id (ex: Atendimento Extra)
    alunoMudou = normalizarTextoComparacao(alunoFixaNome) !== normalizarTextoComparacao(alunoDepoisNome);
  }

  const mudou = diaMudou || horarioMudou || alunoMudou;
  if (!mudou) {
    return {
      acao: 'NADA',
      candidatos,
      itemEscolhido: fixaExistente,
      depois,
      motivo: 'Registro na agenda fixa ja esta identico ao da agenda mensal'
    };
  }

  const diferenca: DetalhesDiferenca = {
    diaMudou,
    horarioMudou,
    alunoMudou,
    diaAntes: fixaExistente.dia_semana,
    diaDepois: depois.dia_semana,
    horarioAntes: normalizarHorario(fixaExistente.horario),
    horarioDepois: depois.horario,
    alunoAntes: alunoFixaNome,
    alunoDepois: alunoDepoisNome
  };

  return {
    acao: 'ATUALIZAR',
    candidatos,
    itemEscolhido: fixaExistente,
    diferenca,
    depois,
    motivo: 'Registro na agenda fixa difere da agenda mensal'
  };
}

/**
 * Funcao pura para montar o payload de atualizacao de um registro na agenda fixa.
 * O nome do paciente e a observacao NUNCA sao sobrescritos na atualizacao.
 * A Fixa e a referencia oficial de nomes da instituicao.
 */
export function montarPayloadAtualizacaoFixa(depois: DadosDepoisPromocao) {
  return {
    dia_semana: depois.dia_semana,
    horario: depois.horario,
    aluno_id: depois.aluno_id || null,
    aluno: depois.aluno_id ? (depois.aluno || null) : (depois.aluno || 'ATENDIMENTO EXTRA'),
    updated_at: new Date().toISOString()
  };
}

/**
 * Funcao pura para montar o payload de criacao de um novo registro na agenda fixa.
 * O nome do paciente e gravado devidamente aparado (trim), com observacao nula
 * e tipo de registro 'paciente'.
 */
export function montarPayloadCriacaoFixa(turmaId: string, depois: DadosDepoisPromocao) {
  return {
    turma_id: turmaId,
    paciente: depois.paciente.trim(),
    dia_semana: depois.dia_semana,
    horario: depois.horario,
    aluno_id: depois.aluno_id || null,
    aluno: depois.aluno_id ? (depois.aluno || null) : (depois.aluno || 'ATENDIMENTO EXTRA'),
    tipo_registro: 'paciente' as const,
    observacao: null
  };
}

/**
 * Funcao pura para determinar se uma linha do lote de promocao deve vir marcada por padrao.
 * Regras:
 * - Marcadas por padrao SOMENTE linhas com acao ATUALIZAR ou CRIAR por nome exato;
 * - Linhas ESCOLHER e NADA desmarcadas por padrao;
 * - Linhas cujo aluno da mensal e ATENDIMENTO EXTRA (aluno_id nulo) desmarcadas por padrao.
 */
export function deveMarcarLinhaLote(plano: PlanoPromocao, itemMensal?: any): boolean {
  // 1. Aluno da mensal e Atendimento Extra (aluno_id nulo) -> desmarcado por padrao
  const alunoId = plano.depois.aluno_id ?? itemMensal?.aluno_id ?? null;
  if (!alunoId) {
    return false;
  }

  // 2. ESCOLHER e NADA -> desmarcados por padrao
  if (plano.acao === 'ESCOLHER' || plano.acao === 'NADA') {
    return false;
  }

  // 3. ATUALIZAR por nome exato -> marcado por padrao
  if (plano.acao === 'ATUALIZAR') {
    const isExato = plano.candidatos.length === 1 && plano.candidatos[0].tipoMatch === 'exato';
    return isExato;
  }

  // 4. CRIAR por nome exato (sem candidatos na fixa) -> marcado por padrao
  if (plano.acao === 'CRIAR') {
    return plano.candidatos.length === 0;
  }

  return false;
}

/**
 * Funcao pura para planejar a promocao de um lote de itens da agenda mensal.
 */
export function planejarPromocaoLote(params: {
  itensMensais: (AgendaMensalItem | any)[];
  fixaItens: (AgendaFixaItem | any)[];
}): ItemLotePromocao[] {
  return (params.itensMensais || []).map((itemMensal) => {
    const plano = planejarPromocao({ itemMensal, fixaItens: params.fixaItens });
    const selecionado = deveMarcarLinhaLote(plano, itemMensal);
    return {
      itemMensal,
      plano,
      selecionado
    };
  });
}
