import { supabase } from './supabase';
import {
  SolicitacaoAgendamento,
  CriarSolicitacaoParams,
  EditarSolicitacaoParams,
  FiltroSolicitacoes,
  TurmaItem
} from './solicitacoesTypes';

/**
 * Consulta todas as turmas cadastradas no banco de dados.
 * Nao utiliza IDs fixos.
 */
export async function listarTurmas(): Promise<TurmaItem[]> {
  const { data, error } = await supabase
    .from('turmas')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('Erro ao listar turmas:', error);
    throw new Error(`Erro ao consultar turmas: ${error.message}`);
  }

  return (data || []) as TurmaItem[];
}

/**
 * Lista as solicitacoes de agendamento aplicando filtros de turma, situacao e busca por nome.
 * Todo erro do Supabase e propagado para a interface.
 */
export async function listarSolicitacoes(
  filtros?: FiltroSolicitacoes
): Promise<SolicitacaoAgendamento[]> {
  let query = supabase
    .from('solicitacoes_agendamento')
    .select('*, turmas(id, nome)');

  // 1. Filtro de turma
  if (filtros?.turma_id && filtros.turma_id !== 'todas') {
    if (filtros.turma_id === 'nenhuma') {
      query = query.is('turma_id', null);
    } else {
      query = query.eq('turma_id', filtros.turma_id);
    }
  }

  // 2. Filtro de situacao e ordenacao
  const situacao = filtros?.situacao || 'pendentes';
  if (situacao === 'pendentes') {
    query = query
      .eq('resolvido', false)
      .order('created_at', { ascending: true });
  } else if (situacao === 'resolvidos') {
    query = query
      .eq('resolvido', true)
      .order('resolvido_em', { ascending: false });
  } else {
    // 'todos': pendentes primeiro (mais antigos no topo), depois resolvidos (mais recentes primeiro)
    query = query
      .order('resolvido', { ascending: true })
      .order('created_at', { ascending: true });
  }

  // 3. Filtro de busca por nome
  if (filtros?.buscaNome && filtros.buscaNome.trim()) {
    query = query.ilike('paciente', `%${filtros.buscaNome.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao consultar solicitacoes de agendamento:', error);
    throw new Error(`Erro ao consultar solicitacoes: ${error.message}`);
  }

  return (data || []) as SolicitacaoAgendamento[];
}

/**
 * Cria uma nova solicitacao de agendamento.
 */
export async function criarSolicitacao(
  dados: CriarSolicitacaoParams
): Promise<SolicitacaoAgendamento> {
  const nomeLimpo = dados.paciente ? dados.paciente.trim() : '';
  if (!nomeLimpo) {
    throw new Error('O nome do paciente é obrigatório.');
  }

  const payload = {
    paciente: nomeLimpo,
    turma_id: dados.turma_id || null,
    observacao: dados.observacao?.trim() || null
  };

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .insert([payload])
    .select('*, turmas(id, nome)')
    .single();

  if (error) {
    console.error('Erro ao criar solicitacao de agendamento:', error);
    throw new Error(`Erro ao cadastrar solicitacao: ${error.message}`);
  }

  return data as SolicitacaoAgendamento;
}

/**
 * Edita paciente, turma e observacao de uma solicitacao existente.
 */
export async function editarSolicitacao(
  id: string,
  dados: EditarSolicitacaoParams
): Promise<SolicitacaoAgendamento> {
  const nomeLimpo = dados.paciente ? dados.paciente.trim() : '';
  if (!nomeLimpo) {
    throw new Error('O nome do paciente é obrigatório.');
  }

  const payload = {
    paciente: nomeLimpo,
    turma_id: dados.turma_id || null,
    observacao: dados.observacao?.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .update(payload)
    .eq('id', id)
    .select('*, turmas(id, nome)')
    .single();

  if (error) {
    console.error('Erro ao atualizar solicitacao de agendamento:', error);
    throw new Error(`Erro ao salvar alteracoes da solicitacao: ${error.message}`);
  }

  return data as SolicitacaoAgendamento;
}

/**
 * Marca uma solicitacao como resolvida ou reabre como pendente.
 */
export async function marcarResolvido(
  id: string,
  resolvido: boolean
): Promise<SolicitacaoAgendamento> {
  const agora = new Date().toISOString();
  const payload = resolvido
    ? {
        resolvido: true,
        resolvido_em: agora,
        updated_at: agora
      }
    : {
        resolvido: false,
        resolvido_em: null,
        updated_at: agora
      };

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .update(payload)
    .eq('id', id)
    .select('*, turmas(id, nome)')
    .single();

  if (error) {
    console.error('Erro ao alterar situacao da solicitacao:', error);
    throw new Error(`Erro ao atualizar status da solicitacao: ${error.message}`);
  }

  return data as SolicitacaoAgendamento;
}

/**
 * Exclui uma solicitacao de agendamento.
 */
export async function excluirSolicitacao(id: string): Promise<void> {
  const { error } = await supabase
    .from('solicitacoes_agendamento')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir solicitacao de agendamento:', error);
    throw new Error(`Erro ao remover solicitacao: ${error.message}`);
  }
}
