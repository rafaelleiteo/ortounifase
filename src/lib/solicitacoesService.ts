import { supabase } from './supabase';
import {
  SolicitacaoAgendamento,
  CriarSolicitacaoParams,
  EditarSolicitacaoParams,
  FiltroSolicitacoes,
  TurmaItem,
  AguardandoDe,
  derivarEstadoSolicitacao,
  montarPayloadAguardando,
  montarPayloadVoltarPendente,
  montarPayloadResolver,
  montarPayloadReabrir,
  ordenarSolicitacoes,
  escaparTermoLike
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
 * Consulta a lista de pacientes com solicitacoes pendentes para deteccao de duplicidade.
 * Como o estado aguardando mantem resolvido = false, ele e automaticamente incluido.
 * O erro do Supabase e propagado.
 */
export async function listarPacientesPendentes(): Promise<Array<{ paciente: string }>> {
  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .select('paciente')
    .eq('resolvido', false);

  if (error) {
    console.error('Erro ao listar pacientes pendentes:', error);
    throw new Error(`Erro ao consultar pacientes pendentes: ${error.message}`);
  }

  return (data || []) as Array<{ paciente: string }>;
}

export interface ContadoresSolicitacoes {
  pendentes: number;
  aguardando: number;
  resolvidos: number;
  emAberto: number;
  total: number;
}

/**
 * Consulta os contadores de solicitacoes nos tres estados (pendentes, aguardando, resolvidos).
 * Todo erro do Supabase e propagado para a interface.
 */
export async function obterContadoresSolicitacoes(
  turmaId?: string
): Promise<ContadoresSolicitacoes> {
  let query = supabase.from('solicitacoes_agendamento').select('*');

  if (turmaId && turmaId !== 'todas') {
    if (turmaId === 'nenhuma') {
      query = query.is('turma_id', null);
    } else {
      query = query.eq('turma_id', turmaId);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao consultar contadores de solicitacoes:', error);
    throw new Error(`Erro ao consultar contadores de solicitacoes: ${error.message}`);
  }

  let pendentes = 0;
  let aguardando = 0;
  let resolvidos = 0;

  for (const item of (data || [])) {
    const estado = derivarEstadoSolicitacao(item);
    if (estado === 'pendente') pendentes++;
    else if (estado === 'aguardando') aguardando++;
    else if (estado === 'resolvido') resolvidos++;
  }

  return {
    pendentes,
    aguardando,
    resolvidos,
    emAberto: pendentes + aguardando,
    total: (data || []).length
  };
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

  // 2. Filtro de situacao a nivel de banco
  const situacao = filtros?.situacao || 'aberto';
  if (situacao === 'pendentes' || situacao === 'aguardando' || situacao === 'aberto') {
    query = query.eq('resolvido', false);
  } else if (situacao === 'resolvidos') {
    query = query.eq('resolvido', true);
  }

  // 3. Filtro de busca por nome com escape de caracteres curinga
  if (filtros?.buscaNome && filtros.buscaNome.trim()) {
    const termoEscapado = escaparTermoLike(filtros.buscaNome.trim());
    query = query.ilike('paciente', `%${termoEscapado}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao consultar solicitacoes de agendamento:', error);
    throw new Error(`Erro ao consultar solicitacoes: ${error.message}`);
  }

  const lista = (data || []) as SolicitacaoAgendamento[];

  // 4. Refinamento de situacao em memoria
  let listaFiltrada = lista;
  if (situacao === 'pendentes') {
    listaFiltrada = lista.filter((s) => derivarEstadoSolicitacao(s) === 'pendente');
  } else if (situacao === 'aguardando') {
    listaFiltrada = lista.filter((s) => derivarEstadoSolicitacao(s) === 'aguardando');
  } else if (situacao === 'aberto') {
    listaFiltrada = lista.filter((s) => derivarEstadoSolicitacao(s) !== 'resolvido');
  } else if (situacao === 'resolvidos') {
    listaFiltrada = lista.filter((s) => derivarEstadoSolicitacao(s) === 'resolvido');
  }

  return ordenarSolicitacoes(listaFiltrada, situacao);
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
 * Confere que exatamente 1 linha foi alterada.
 */
export async function editarSolicitacao(
  id: string,
  dados: EditarSolicitacaoParams
): Promise<void> {
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
    .select('id');

  if (error) {
    console.error('Erro ao atualizar solicitacao de agendamento:', error);
    throw new Error(`Erro ao salvar alteracoes da solicitacao: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Nenhuma linha foi alterada. A solicitacao pode ter sido removida ou voce nao tem permissao.');
  }
}

/**
 * Coloca a solicitacao no estado intermediario "aguardando confirmacao".
 * Valida a entidade e observacao, gravando com .select('id') e checagem de 1 linha.
 */
export async function marcarAguardando(
  id: string,
  de: AguardandoDe,
  obs?: string | null
): Promise<void> {
  const agora = new Date();
  const payload = {
    ...montarPayloadAguardando(de, obs, agora),
    resolvido: false,
    resolvido_em: null,
    updated_at: agora.toISOString()
  };

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Erro ao marcar solicitacao como aguardando:', error);
    throw new Error(`Erro ao marcar solicitacao como aguardando: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Nenhuma linha foi alterada. A solicitacao pode ter sido removida ou voce nao tem permissao.');
  }
}

/**
 * Volta a solicitacao do estado aguardando para o estado pendente.
 * Limpa os tres campos aguardando, com conferencia de 1 linha alterada.
 */
export async function voltarParaPendente(id: string): Promise<void> {
  const agora = new Date().toISOString();
  const payload = {
    ...montarPayloadVoltarPendente(),
    resolvido: false,
    resolvido_em: null,
    updated_at: agora
  };

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Erro ao voltar solicitacao para pendente:', error);
    throw new Error(`Erro ao voltar solicitacao para pendente: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Nenhuma linha foi alterada. A solicitacao pode ter sido removida ou voce nao tem permissao.');
  }
}

/**
 * Marca uma solicitacao como resolvida ou reabre como pendente.
 * Quando resolve: mantem os campos aguardando como historico.
 * Quando reabre: volta para pendente, zerando os campos aguardando.
 */
export async function marcarResolvido(
  id: string,
  resolvido: boolean
): Promise<void> {
  const payload = resolvido
    ? montarPayloadResolver()
    : montarPayloadReabrir();

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Erro ao alterar situacao da solicitacao:', error);
    throw new Error(`Erro ao atualizar status da solicitacao: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Nenhuma linha foi alterada. A solicitacao pode ter sido removida ou voce nao tem permissao.');
  }
}

/**
 * Exclui uma solicitacao de agendamento.
 */
export async function excluirSolicitacao(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Erro ao excluir solicitacao de agendamento:', error);
    throw new Error(`Erro ao remover solicitacao: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Nada foi excluido. A solicitacao pode ja ter sido removida ou voce nao tem permissao.');
  }
}

/**
 * Importa solicitacoes de agendamento em lote com um unico insert atomico.
 */
export async function importarSolicitacoes(
  linhas: Array<{ paciente: string; turma_id: string | null; observacao?: string | null }>
): Promise<number> {
  if (!linhas || linhas.length === 0) {
    throw new Error('Nenhuma solicitacao valida selecionada para importacao.');
  }

  const payloads = linhas.map((l) => ({
    paciente: l.paciente.trim(),
    turma_id: l.turma_id || null,
    observacao: l.observacao && l.observacao.trim() ? l.observacao.trim() : null
  }));

  const { data, error } = await supabase
    .from('solicitacoes_agendamento')
    .insert(payloads)
    .select('id');

  if (error) {
    console.error('Erro ao importar solicitacoes em lote:', error);
    throw new Error(`Erro ao gravar lote de solicitacoes: ${error.message}`);
  }

  if (!data || data.length !== payloads.length) {
    throw new Error(
      `Divergencia na gravacao em lote: ${payloads.length} enviadas, mas apenas ${data?.length || 0} registradas.`
    );
  }

  return data.length;
}
