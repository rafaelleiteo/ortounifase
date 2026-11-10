import { supabase } from './supabase';
import {
  ControleItem,
  ControleMes,
  montarListaImportacao,
  montarPayloadSalvar,
  normalizarMesReferencia
} from './controleAgenda';

export interface CarregarControleResultado {
  cabecalho: ControleMes | null;
  itens: ControleItem[];
}

/**
 * Carrega os dados salvos do Controle de Agenda para uma turma e mes especificos.
 * Nunca engole erros do Supabase.
 */
export async function carregarControleAgenda(
  turmaId: string,
  mesReferencia: string
): Promise<CarregarControleResultado> {
  const mesNorm = normalizarMesReferencia(mesReferencia);

  const { data: cabecalhoData, error: errCabecalho } = await supabase
    .from('controle_agenda_mes')
    .select('id, turma_id, mes_referencia, importado_em, salvo_em, salvo_por, updated_at')
    .eq('turma_id', turmaId)
    .eq('mes_referencia', mesNorm)
    .maybeSingle();

  if (errCabecalho) {
    console.error('Erro ao buscar cabecalho do controle de agenda:', errCabecalho);
    throw new Error(`Falha ao carregar controle de agenda: ${errCabecalho.message}`);
  }

  if (!cabecalhoData) {
    return { cabecalho: null, itens: [] };
  }

  const { data: itensData, error: errItens } = await supabase
    .from('controle_agenda_itens')
    .select('id, controle_id, origem, dia_semana, data_atendimento, horario, paciente, aluno_nome, aluno_id, status, observacao, ordem')
    .eq('controle_id', cabecalhoData.id)
    .order('ordem', { ascending: true });

  if (errItens) {
    console.error('Erro ao carregar itens do controle de agenda:', errItens);
    throw new Error(`Falha ao carregar itens do controle de agenda: ${errItens.message}`);
  }

  return {
    cabecalho: cabecalhoData as ControleMes,
    itens: (itensData || []) as ControleItem[]
  };
}

/**
 * Carrega os registros de agenda_mensal e agenda_fixa do Supabase e monta
 * a lista em memoria com Mensal + So na Fixa. Nao grava nada no banco.
 * Nunca engole erros do Supabase.
 */
export async function carregarDadosParaImportacao(
  turmaId: string,
  mesReferencia: string
): Promise<ControleItem[]> {
  const mesNorm = normalizarMesReferencia(mesReferencia);

  const [resMensal, resFixa] = await Promise.all([
    supabase
      .from('agenda_mensal')
      .select('id, paciente, aluno, aluno_id, horario, dia_semana, tipo_registro, tipo_bloqueio, observacao, agenda_alunos(id, nome)')
      .eq('turma_id', turmaId)
      .eq('mes_referencia', mesNorm),
    supabase
      .from('agenda_fixa')
      .select('id, paciente, aluno, aluno_id, horario, dia_semana, tipo_registro, tipo_bloqueio, observacao, agenda_alunos(id, nome)')
      .eq('turma_id', turmaId)
  ]);

  if (resMensal.error) {
    console.error('Erro ao buscar agenda mensal para importacao:', resMensal.error);
    throw new Error(`Falha ao buscar agenda mensal: ${resMensal.error.message}`);
  }

  if (resFixa.error) {
    console.error('Erro ao buscar agenda fixa para importacao:', resFixa.error);
    throw new Error(`Falha ao buscar agenda fixa: ${resFixa.error.message}`);
  }

  return montarListaImportacao(resMensal.data || [], resFixa.data || []);
}

/**
 * Salva a lista de controle atraves da funcao SQL controle_agenda_salvar.
 * A operacao roda em transacao unica no banco (upsert do cabecalho, delecao dos itens antigos e insercao dos novos).
 * Nunca engole erros do Supabase.
 */
export async function salvarControleAgenda(
  turmaId: string,
  mesReferencia: string,
  itens: ControleItem[],
  importadoEm?: string | null
): Promise<string> {
  const payload = montarPayloadSalvar(turmaId, mesReferencia, itens, importadoEm);

  const { data, error } = await supabase.rpc('controle_agenda_salvar', {
    p_turma_id: payload.p_turma_id,
    p_mes: payload.p_mes,
    p_itens: payload.p_itens,
    p_importado_em: payload.p_importado_em
  });

  if (error) {
    console.error('Erro na funcao controle_agenda_salvar:', error);
    throw new Error(`Falha ao salvar controle de agenda: ${error.message}`);
  }

  if (!data) {
    throw new Error('Funcao controle_agenda_salvar executou mas nao retornou o ID do controle.');
  }

  return data as string;
}

/**
 * Exclui um registro de controle salvo e seus itens em cascata.
 * Detecta 0 linhas afetadas explicitamente.
 */
export async function excluirControleAgenda(controleId: string): Promise<void> {
  if (!controleId) {
    throw new Error('ID do controle e obrigatorio para exclusao');
  }

  const { data, error } = await supabase
    .from('controle_agenda_mes')
    .delete()
    .eq('id', controleId)
    .select('id');

  if (error) {
    console.error('Erro ao excluir controle de agenda:', error);
    throw new Error(`Falha ao excluir controle de agenda: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`Nenhum registro encontrado para exclusao com ID: ${controleId}`);
  }
}
