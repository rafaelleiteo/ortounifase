import { supabase } from './supabase';
import {
  AlinhadorCalendario,
  AlinhadorPaciente,
  AlinhadorPedido,
  PedidoComPaciente,
  StatusPedido,
  calcularStatusPedido
} from './alinhadoresTypes';

/**
 * Utilitário para geração de UUID v4 universal (Browser / Node)
 */
function gerarUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==============================================================================
// 1. PACIENTES DE ALINHADORES
// ==============================================================================

/**
 * Lista pacientes de alinhadores, opcionalmente filtrados por turma e status ativo.
 */
export async function listarPacientes(
  turmaId?: string,
  apenasAtivos: boolean = true
): Promise<AlinhadorPaciente[]> {
  let query = supabase
    .from('alinhadores_pacientes')
    .select('*')
    .order('nome', { ascending: true });

  if (turmaId) {
    query = query.eq('turma_id', turmaId);
  }

  if (apenasAtivos) {
    query = query.eq('ativo', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao listar pacientes de alinhadores:', error);
    throw new Error(`Erro ao listar pacientes de alinhadores: ${error.message}`);
  }

  return (data || []) as AlinhadorPaciente[];
}

/**
 * Cadastra um novo paciente de alinhadores.
 */
export async function criarPaciente(
  paciente: Omit<AlinhadorPaciente, 'id' | 'created_at'>
): Promise<AlinhadorPaciente> {
  const { data, error } = await supabase
    .from('alinhadores_pacientes')
    .insert([paciente])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar paciente de alinhadores:', error);
    throw new Error(`Erro ao criar paciente de alinhadores: ${error.message}`);
  }

  return data as AlinhadorPaciente;
}

/**
 * Edita dados de um paciente de alinhadores.
 */
export async function editarPaciente(
  id: string,
  dados: Partial<Omit<AlinhadorPaciente, 'id' | 'created_at'>>
): Promise<AlinhadorPaciente> {
  const { data, error } = await supabase
    .from('alinhadores_pacientes')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Erro ao editar paciente ${id}:`, error);
    throw new Error(`Erro ao editar paciente: ${error.message}`);
  }

  return data as AlinhadorPaciente;
}

/**
 * Desativa um paciente de alinhadores (soft delete marcando ativo = false).
 */
export async function desativarPaciente(id: string): Promise<AlinhadorPaciente> {
  return editarPaciente(id, { ativo: false });
}

// ==============================================================================
// 2. CALENDÁRIO DE ATENDIMENTOS DE ALINHADORES POR TURMA
// ==============================================================================

/**
 * Lista as datas de atendimento de uma turma ordenadas cronologicamente.
 */
export async function listarDatasCalendario(turmaId: string): Promise<AlinhadorCalendario[]> {
  const { data, error } = await supabase
    .from('alinhadores_calendario')
    .select('*')
    .eq('turma_id', turmaId)
    .order('data', { ascending: true });

  if (error) {
    console.error(`Erro ao listar calendário da turma ${turmaId}:`, error);
    throw new Error(`Erro ao listar calendário da turma: ${error.message}`);
  }

  return (data || []) as AlinhadorCalendario[];
}

/**
 * Adiciona uma nova data de atendimento no calendário da turma.
 */
export async function adicionarDataCalendario(
  turmaId: string,
  data: string
): Promise<AlinhadorCalendario> {
  const { data: item, error } = await supabase
    .from('alinhadores_calendario')
    .insert([{ turma_id: turmaId, data }])
    .select()
    .single();

  if (error) {
    console.error(`Erro ao adicionar data no calendário da turma ${turmaId}:`, error);
    throw new Error(`Erro ao adicionar data no calendário: ${error.message}`);
  }

  return item as AlinhadorCalendario;
}

/**
 * Remove uma data de atendimento do calendário.
 */
export async function removerDataCalendario(id: string): Promise<void> {
  const { error } = await supabase
    .from('alinhadores_calendario')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Erro ao remover data do calendário ${id}:`, error);
    throw new Error(`Erro ao remover data do calendário: ${error.message}`);
  }
}

// ==============================================================================
// 3. PEDIDOS DE ALINHADORES
// ==============================================================================

/**
 * Lista pedidos de alinhadores com dados do paciente associado.
 */
export async function listarPedidos(filtros?: {
  turmaId?: string;
  pacienteId?: string;
  status?: StatusPedido;
}): Promise<PedidoComPaciente[]> {
  let query = supabase
    .from('alinhadores_pedidos')
    .select(`
      *,
      paciente:alinhadores_pacientes (
        id,
        nome,
        turma_id,
        total_alinhadores,
        ativo
      )
    `)
    .order('data_retorno', { ascending: true });

  if (filtros?.pacienteId) {
    query = query.eq('paciente_id', filtros.pacienteId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao listar pedidos de alinhadores:', error);
    throw new Error(`Erro ao listar pedidos de alinhadores: ${error.message}`);
  }

  let lista = (data || []) as PedidoComPaciente[];

  // Filtragem em memória por turma do paciente (se fornecido)
  if (filtros?.turmaId) {
    lista = lista.filter((p) => p.paciente?.turma_id === filtros.turmaId);
  }

  // Filtragem em memória por status calculado (se fornecido)
  if (filtros?.status) {
    lista = lista.filter((p) => calcularStatusPedido(p) === filtros.status);
  }

  return lista;
}

/**
 * Cria um novo pedido de alinhadores.
 */
export async function criarPedido(
  pedido: Omit<AlinhadorPedido, 'id' | 'created_at' | 'solicitado_em' | 'lote_id'>
): Promise<AlinhadorPedido> {
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .insert([pedido])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar pedido de alinhadores:', error);
    throw new Error(`Erro ao criar pedido de alinhadores: ${error.message}`);
  }

  return data as AlinhadorPedido;
}

/**
 * Edita dados de um pedido existente.
 */
export async function editarPedido(
  id: string,
  dados: Partial<Omit<AlinhadorPedido, 'id' | 'created_at'>>
): Promise<AlinhadorPedido> {
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Erro ao editar pedido ${id}:`, error);
    throw new Error(`Erro ao editar pedido: ${error.message}`);
  }

  return data as AlinhadorPedido;
}

/**
 * Exclui um pedido de alinhadores.
 */
export async function excluirPedido(id: string): Promise<void> {
  const { error } = await supabase
    .from('alinhadores_pedidos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Erro ao excluir pedido ${id}:`, error);
    throw new Error(`Erro ao excluir pedido: ${error.message}`);
  }
}

/**
 * Marca uma lista de pedidos como solicitados:
 * Grava solicitado_em = agora e o MESMO lote_id (uuid novo) em todos.
 * Retorna os pedidos atualizados com o nome do paciente.
 */
export async function marcarComoSolicitados(
  ids: string[]
): Promise<Array<AlinhadorPedido & { paciente_nome: string }>> {
  if (!ids || ids.length === 0) {
    return [];
  }

  const loteId = gerarUUID();
  const solicitadoEm = new Date().toISOString();

  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .update({
      solicitado_em: solicitadoEm,
      lote_id: loteId
    })
    .in('id', ids)
    .select(`
      *,
      paciente:alinhadores_pacientes (
        nome
      )
    `);

  if (error) {
    console.error('Erro ao marcar pedidos como solicitados:', error);
    throw new Error(`Erro ao marcar pedidos como solicitados: ${error.message}`);
  }

  interface RowWithPaciente extends AlinhadorPedido {
    paciente?: { nome: string } | null;
  }

  return ((data || []) as RowWithPaciente[]).map((row) => ({
    id: row.id,
    paciente_id: row.paciente_id,
    data_retorno: row.data_retorno,
    alinhador_de: row.alinhador_de,
    alinhador_ate: row.alinhador_ate,
    solicitado_em: row.solicitado_em,
    lote_id: row.lote_id,
    created_at: row.created_at,
    paciente_nome: row.paciente?.nome || 'Paciente Desconhecido'
  }));
}

/**
 * Desfaz a solicitação de um pedido (limpa solicitado_em e lote_id).
 */
export async function desfazerSolicitacao(id: string): Promise<AlinhadorPedido> {
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .update({
      solicitado_em: null,
      lote_id: null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Erro ao desfazer solicitação do pedido ${id}:`, error);
    throw new Error(`Erro ao desfazer solicitação do pedido: ${error.message}`);
  }

  return data as AlinhadorPedido;
}
