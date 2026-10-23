import { supabase } from './supabase';
import {
  AlinhadorCalendario,
  AlinhadorPaciente,
  AlinhadorPedido,
  PedidoComPaciente,
  ResultadoSolicitacao,
  StatusPedido,
  Turma,
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
 * - Garante que pedidos que já têm solicitado_em NÃO sejam sobrescritos (atualiza apenas com solicitado_em nulo).
 * - Grava solicitado_em = agora e o MESMO lote_id (uuid novo) em todos os pedidos pendentes.
 * - Retorna os pedidos atualizados com o nome do paciente e a quantidade de ignorados.
 */
export async function marcarComoSolicitados(
  ids: string[]
): Promise<ResultadoSolicitacao> {
  if (!ids || ids.length === 0) {
    return { pedidos: [], ignorados: 0 };
  }

  // 1. Identifica quais pedidos dos IDs informados ainda não foram solicitados (solicitado_em IS NULL)
  const { data: pedidosExistentes, error: queryError } = await supabase
    .from('alinhadores_pedidos')
    .select('id, solicitado_em')
    .in('id', ids);

  if (queryError) {
    console.error('Erro ao verificar pedidos para solicitação:', queryError);
    throw new Error(`Erro ao verificar pedidos: ${queryError.message}`);
  }

  const idsParaAtualizar = (pedidosExistentes || [])
    .filter((p) => p.solicitado_em === null)
    .map((p) => p.id);

  const ignorados = ids.length - idsParaAtualizar.length;

  if (idsParaAtualizar.length === 0) {
    return { pedidos: [], ignorados };
  }

  const loteId = gerarUUID();
  const solicitadoEm = new Date().toISOString();

  // 2. Atualiza estritamente os pedidos com solicitado_em nulo
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .update({
      solicitado_em: solicitadoEm,
      lote_id: loteId
    })
    .in('id', idsParaAtualizar)
    .is('solicitado_em', null)
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

  const pedidos = ((data || []) as RowWithPaciente[]).map((row) => ({
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

  return {
    pedidos,
    ignorados
  };
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

// ==============================================================================
// 4. FUNÇÕES AUXILIARES DA INTERFACE
// ==============================================================================

/**
 * Lista as turmas cadastradas no sistema ordenadas por nome.
 */
export async function listarTurmas(): Promise<Turma[]> {
  const { data, error } = await supabase
    .from('turmas')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao listar turmas:', error);
    throw new Error(`Erro ao listar turmas: ${error.message}`);
  }

  return (data || []) as Turma[];
}

/**
 * Busca todos os pedidos pertencentes a um lote de solicitação.
 */
export async function buscarPedidosPorLote(
  loteId: string
): Promise<Array<AlinhadorPedido & { paciente_nome: string }>> {
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .select(`
      *,
      paciente:alinhadores_pacientes (
        nome
      )
    `)
    .eq('lote_id', loteId)
    .order('data_retorno', { ascending: true });

  if (error) {
    console.error(`Erro ao buscar pedidos do lote ${loteId}:`, error);
    throw new Error(`Erro ao buscar pedidos do lote: ${error.message}`);
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
 * Adiciona múltiplas datas no calendário de uma turma em lote, ignorando duplicatas existentes.
 */
export async function adicionarDatasCalendarioEmLote(
  turmaId: string,
  datas: string[]
): Promise<{ adicionadas: number; ignoradas: number }> {
  if (!datas || datas.length === 0) {
    return { adicionadas: 0, ignoradas: 0 };
  }

  // 1. Obter datas existentes da turma
  const { data: existentes, error: queryError } = await supabase
    .from('alinhadores_calendario')
    .select('data')
    .eq('turma_id', turmaId);

  if (queryError) {
    console.error(`Erro ao verificar calendário da turma ${turmaId}:`, queryError);
    throw new Error(`Erro ao verificar calendário: ${queryError.message}`);
  }

  const setExistentes = new Set((existentes || []).map((e) => e.data));
  const unicasNovas = Array.from(new Set(datas)).filter((d) => !setExistentes.has(d));
  const ignoradas = datas.length - unicasNovas.length;

  if (unicasNovas.length === 0) {
    return { adicionadas: 0, ignoradas };
  }

  const registros = unicasNovas.map((data) => ({ turma_id: turmaId, data }));
  const { error: insertError } = await supabase
    .from('alinhadores_calendario')
    .insert(registros);

  if (insertError) {
    console.error('Erro ao inserir datas no calendário em lote:', insertError);
    throw new Error(`Erro ao adicionar datas no calendário: ${insertError.message}`);
  }

  return { adicionadas: unicasNovas.length, ignoradas };
}

/**
 * Conta quantos pedidos de pacientes da turma estão vinculados a uma determinada data de retorno.
 */
export async function verificarPedidosVinculadosData(
  turmaId: string,
  dataStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from('alinhadores_pedidos')
    .select(`
      id,
      paciente:alinhadores_pacientes!inner (
        turma_id
      )
    `)
    .eq('data_retorno', dataStr)
    .eq('paciente.turma_id', turmaId);

  if (error) {
    console.error('Erro ao verificar pedidos vinculados à data:', error);
    return 0;
  }

  return data ? data.length : 0;
}

/**
 * Cria múltiplos pedidos de retorno para um paciente em lote, ignorando datas já cadastradas.
 */
export async function criarPedidosEmLote(
  pacienteId: string,
  datas: string[],
  alinhadorDe?: number | null,
  alinhadorAte?: number | null
): Promise<{ criados: number; ignorados: number }> {
  if (!datas || datas.length === 0) {
    return { criados: 0, ignorados: 0 };
  }

  // 1. Obter retornos existentes deste paciente
  const { data: existentes, error: queryError } = await supabase
    .from('alinhadores_pedidos')
    .select('data_retorno')
    .eq('paciente_id', pacienteId);

  if (queryError) {
    console.error(`Erro ao verificar retornos existentes do paciente ${pacienteId}:`, queryError);
    throw new Error(`Erro ao verificar retornos existentes: ${queryError.message}`);
  }

  const setExistentes = new Set((existentes || []).map((e) => e.data_retorno));
  const novasDatas = Array.from(new Set(datas)).filter((d) => !setExistentes.has(d));
  const ignorados = datas.length - novasDatas.length;

  if (novasDatas.length === 0) {
    return { criados: 0, ignorados };
  }

  const registros = novasDatas.map((dataRetorno) => ({
    paciente_id: pacienteId,
    data_retorno: dataRetorno,
    alinhador_de: alinhadorDe !== undefined ? alinhadorDe : null,
    alinhador_ate: alinhadorAte !== undefined ? alinhadorAte : null
  }));

  const { error: insertError } = await supabase
    .from('alinhadores_pedidos')
    .insert(registros);

  if (insertError) {
    console.error('Erro ao inserir pedidos em lote:', insertError);
    throw new Error(`Erro ao cadastrar retornos: ${insertError.message}`);
  }

  return { criados: novasDatas.length, ignorados };
}

