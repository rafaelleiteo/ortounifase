import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Filter,
  Copy,
  RotateCcw,
  Eye,
  Loader2,
  Trash2,
  Search,
  Check,
  FileText,
  X
} from 'lucide-react';
import {
  Turma,
  PedidoComPaciente,
  StatusPedido,
  formatarDataBR,
  calcularPrazoLimite,
  calcularStatusPedido,
  gerarMensagemEmpresa,
  PedidoParaMensagem
} from '@/lib/alinhadoresTypes';
import {
  listarPedidos,
  editarPedido,
  excluirPedido,
  marcarComoSolicitados,
  desfazerSolicitacao,
  buscarPedidosPorLote
} from '@/lib/alinhadoresService';

interface AlinhadoresPedidosTabProps {
  turmas: Turma[];
  turmaSelecionadaId: string;
  onSelecionarTurma: (turmaId: string) => void;
}

type FiltroStatus = 'nao_solicitados' | 'todos' | 'atrasado' | 'vencendo' | 'pendente' | 'solicitado';

export const AlinhadoresPedidosTab: React.FC<AlinhadoresPedidosTabProps> = ({
  turmas,
  turmaSelecionadaId,
  onSelecionarTurma
}) => {
  const [pedidos, setPedidos] = useState<PedidoComPaciente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Filtros
  const [filtroTurma, setFiltroTurma] = useState<string>(turmaSelecionadaId || 'todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('nao_solicitados');
  const [filtroMes, setFiltroMes] = useState<string>('todos');
  const [buscaPaciente, setBuscaPaciente] = useState<string>('');

  // Seleção para lote
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);

  // Modal Mensagem Gerada (após marcar como solicitados)
  const [modalMensagemAberta, setModalMensagemAberta] = useState(false);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);
  const [qtdIgnoradosLote, setQtdIgnoradosLote] = useState<number>(0);

  // Modal Ver Mensagem do Lote existente
  const [modalLoteExistenteAberto, setModalLoteExistenteAberto] = useState(false);
  const [textoLoteExistente, setTextoLoteExistente] = useState('');
  const [carregandoLoteExistente, setCarregandoLoteExistente] = useState(false);
  const [copiadoLoteFeedback, setCopiadoLoteFeedback] = useState(false);

  // Edição inline dos alinhadores (id -> { de, ate, salvando, salvo })
  const [valoresEdicao, setValoresEdicao] = useState<
    Record<string, { de: string; ate: string; salvando?: boolean; salvo?: boolean }>
  >({});

  // Sincronizar filtroTurma caso a prop mude
  useEffect(() => {
    if (turmaSelecionadaId) {
      setFiltroTurma(turmaSelecionadaId);
    }
  }, [turmaSelecionadaId]);

  // Carregar todos os pedidos
  const carregarPedidos = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarPedidos();
      setPedidos(lista);

      // Inicializa valores de edição inline
      const edicaoMap: Record<string, { de: string; ate: string }> = {};
      for (const p of lista) {
        edicaoMap[p.id] = {
          de: p.alinhador_de !== null && p.alinhador_de !== undefined ? String(p.alinhador_de) : '',
          ate: p.alinhador_ate !== null && p.alinhador_ate !== undefined ? String(p.alinhador_ate) : ''
        };
      }
      setValoresEdicao(edicaoMap);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar lista de pedidos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPedidos();
  }, []);

  // Limpa notificações após 5s
  useEffect(() => {
    if (sucesso) {
      const timer = setTimeout(() => setSucesso(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [sucesso]);

  // Contadores globais (ou filtrados pela turma se selecionada)
  const contadores = useMemo(() => {
    const escopo = filtroTurma === 'todas'
      ? pedidos
      : pedidos.filter((p) => p.paciente?.turma_id === filtroTurma);

    let atrasados = 0;
    let vencendo = 0;
    let pendentes = 0;
    let solicitados = 0;

    for (const p of escopo) {
      const st = calcularStatusPedido(p);
      if (st === 'atrasado') atrasados++;
      else if (st === 'vencendo') vencendo++;
      else if (st === 'pendente') pendentes++;
      else if (st === 'solicitado') solicitados++;
    }

    return { atrasados, vencendo, pendentes, solicitados };
  }, [pedidos, filtroTurma]);

  // Lista única de meses disponíveis para o filtro (YYYY-MM)
  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set<string>();
    for (const p of pedidos) {
      if (p.data_retorno && p.data_retorno.length >= 7) {
        setMeses.add(p.data_retorno.substring(0, 7));
      }
    }
    return Array.from(setMeses).sort();
  }, [pedidos]);

  // Formatar mês para exibição (ex: 2026-11 -> Nov/2026)
  const formatarMesLabel = (mesISO: string) => {
    const [ano, mes] = mesISO.split('-').map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    const nomeMes = dataRef.toLocaleString('pt-BR', { month: 'short' });
    return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${ano}`;
  };

  // Filtragem e ordenação padrão (prazo limite ascendente)
  const pedidosFiltrados = useMemo(() => {
    let res = [...pedidos];

    // Filtro por turma
    if (filtroTurma !== 'todas') {
      res = res.filter((p) => p.paciente?.turma_id === filtroTurma);
    }

    // Filtro por status
    if (filtroStatus === 'nao_solicitados') {
      res = res.filter((p) => !p.solicitado_em);
    } else if (filtroStatus !== 'todos') {
      res = res.filter((p) => calcularStatusPedido(p) === filtroStatus);
    }

    // Filtro por mês
    if (filtroMes !== 'todos') {
      res = res.filter((p) => p.data_retorno.startsWith(filtroMes));
    }

    // Filtro por busca de nome
    if (buscaPaciente.trim()) {
      const q = buscaPaciente.toLowerCase().trim();
      res = res.filter((p) => p.paciente?.nome.toLowerCase().includes(q));
    }

    // Ordenação padrão: Prazo limite ascendente (mais atrasados primeiro)
    res.sort((a, b) => {
      const prazoA = calcularPrazoLimite(a.data_retorno).getTime();
      const prazoB = calcularPrazoLimite(b.data_retorno).getTime();
      if (prazoA !== prazoB) {
        return prazoA - prazoB;
      }
      return a.data_retorno.localeCompare(b.data_retorno);
    });

    return res;
  }, [pedidos, filtroTurma, filtroStatus, filtroMes, buscaPaciente]);

  // Apenas pedidos não solicitados podem ser selecionados para envio
  const pedidosElegiveisParaSelecao = useMemo(() => {
    return pedidosFiltrados.filter((p) => !p.solicitado_em);
  }, [pedidosFiltrados]);

  // Toggle selecionar todos os elegíveis
  const handleToggleSelecionarTodos = () => {
    const elegiveisIds = pedidosElegiveisParaSelecao.map((p) => p.id);
    const todosJaSelecionados = elegiveisIds.length > 0 && elegiveisIds.every((id) => selecionados.includes(id));

    if (todosJaSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !elegiveisIds.includes(id)));
    } else {
      setSelecionados((prev) => Array.from(new Set([...prev, ...elegiveisIds])));
    }
  };

  const handleToggleLinha = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Salvar alteração inline de alinhadores (de / ate)
  const handleSalvarInline = async (pedidoId: string) => {
    const dados = valoresEdicao[pedidoId];
    if (!dados) return;

    let deNum: number | null = null;
    let ateNum: number | null = null;

    if (dados.de.trim() !== '') {
      deNum = parseInt(dados.de, 10);
      if (isNaN(deNum) || deNum < 1) {
        setErro('O número inicial do alinhador deve ser um inteiro maior ou igual a 1.');
        return;
      }
    }

    if (dados.ate.trim() !== '') {
      ateNum = parseInt(dados.ate, 10);
      if (isNaN(ateNum) || ateNum < 1) {
        setErro('O número final do alinhador deve ser um inteiro maior ou igual a 1.');
        return;
      }
    }

    if (deNum !== null && ateNum !== null && ateNum < deNum) {
      setErro('O alinhador final deve ser maior ou igual ao alinhador inicial.');
      return;
    }

    // Atualiza estado de salvando
    setValoresEdicao((prev) => ({
      ...prev,
      [pedidoId]: { ...prev[pedidoId], salvando: true }
    }));

    try {
      await editarPedido(pedidoId, {
        alinhador_de: deNum,
        alinhador_ate: ateNum
      });

      // Atualiza o pedido na lista local
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, alinhador_de: deNum, alinhador_ate: ateNum } : p))
      );

      // Feedback de salvo com check verde temporário
      setValoresEdicao((prev) => ({
        ...prev,
        [pedidoId]: { ...prev[pedidoId], salvando: false, salvo: true }
      }));
      setTimeout(() => {
        setValoresEdicao((prev) => ({
          ...prev,
          [pedidoId]: { ...prev[pedidoId], salvo: false }
        }));
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar alinhadores.');
      setValoresEdicao((prev) => ({
        ...prev,
        [pedidoId]: { ...prev[pedidoId], salvando: false }
      }));
    }
  };

  // Ação em Lote: Marcar selecionados como solicitados
  const handleMarcarComoSolicitados = async () => {
    if (selecionados.length === 0) return;

    const confirmou = window.confirm(
      `Deseja marcar ${selecionados.length} pedido(s) selecionado(s) como solicitado(s)?\n\nIsso registrará a solicitação e gerará a mensagem para a empresa fornecedora.`
    );
    if (!confirmou) return;

    try {
      setProcessandoLote(true);
      setErro(null);

      const resultado = await marcarComoSolicitados(selecionados);

      // Gera mensagem pronta com os pedidos atualizados
      const pedidosParaMsg: PedidoParaMensagem[] = resultado.pedidos.map((p) => ({
        paciente_nome: p.paciente_nome,
        data_retorno: p.data_retorno,
        alinhador_de: p.alinhador_de,
        alinhador_ate: p.alinhador_ate
      }));

      const textoGerado = gerarMensagemEmpresa(pedidosParaMsg);
      setTextoMensagem(textoGerado);
      setQtdIgnoradosLote(resultado.ignorados);
      setModalMensagemAberta(true);
      setSelecionados([]);

      await carregarPedidos();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao marcar pedidos como solicitados.');
    } finally {
      setProcessandoLote(false);
    }
  };

  // Desfazer solicitação de um pedido
  const handleDesfazerSolicitacao = async (pedido: PedidoComPaciente) => {
    const confirmou = window.confirm(
      `Deseja desfazer a marcação de solicitação do pedido de "${pedido.paciente?.nome}" para ${formatarDataBR(pedido.data_retorno)}?\n\nO pedido voltará para o status pendente.`
    );
    if (!confirmou) return;

    try {
      setErro(null);
      await desfazerSolicitacao(pedido.id);
      setSucesso(`Solicitação do pedido de ${pedido.paciente?.nome} desfeita com sucesso.`);
      await carregarPedidos();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao desfazer solicitação.');
    }
  };

  // Ver mensagem do lote existente
  const handleVerMensagemLote = async (loteId: string) => {
    try {
      setCarregandoLoteExistente(true);
      setModalLoteExistenteAberto(true);
      setTextoLoteExistente('');
      setCopiadoLoteFeedback(false);

      const pedidosLote = await buscarPedidosPorLote(loteId);
      const paraMsg: PedidoParaMensagem[] = pedidosLote.map((p) => ({
        paciente_nome: p.paciente_nome,
        data_retorno: p.data_retorno,
        alinhador_de: p.alinhador_de,
        alinhador_ate: p.alinhador_ate
      }));

      const texto = gerarMensagemEmpresa(paraMsg);
      setTextoLoteExistente(texto);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao recuperar mensagens do lote.');
    } finally {
      setCarregandoLoteExistente(false);
    }
  };

  // Excluir pedido
  const handleExcluirPedido = async (pedido: PedidoComPaciente) => {
    const confirmou = window.confirm(
      `Deseja realmente excluir este pedido de retorno de "${pedido.paciente?.nome}" em ${formatarDataBR(pedido.data_retorno)}?`
    );
    if (!confirmou) return;

    try {
      setErro(null);
      await excluirPedido(pedido.id);
      setSucesso('Pedido de retorno removido com sucesso.');
      await carregarPedidos();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao excluir pedido.');
    }
  };

  // Copiar mensagem para a área de transferência
  const handleCopiarMensagem = async (texto: string, setFeedback: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(texto);
      setFeedback(true);
      setTimeout(() => setFeedback(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  // Formatar data/hora ISO em formato amigável
  const formatarDataHora = (iso: string | null | undefined) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const dataStr = formatarDataBR(d);
      const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${dataStr} às ${horaStr}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Faixa de Resumo com Contadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Atrasados */}
        <button
          type="button"
          onClick={() => setFiltroStatus('atrasado')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'atrasado'
              ? 'bg-rose-100/70 border-rose-400 ring-2 ring-rose-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Atrasados</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 font-mono">
            {contadores.atrasados}
          </div>
          <p className="text-[11px] text-rose-600/80 mt-1">Prazo limite expirado</p>
        </button>

        {/* Vencendo */}
        <button
          type="button"
          onClick={() => setFiltroStatus('vencendo')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'vencendo'
              ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Vencendo</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
            {contadores.vencendo}
          </div>
          <p className="text-[11px] text-amber-600/80 mt-1">Faltam até 5 dias</p>
        </button>

        {/* Pendentes */}
        <button
          type="button"
          onClick={() => setFiltroStatus('pendente')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'pendente'
              ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pendentes</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-700 mt-2 font-mono">
            {contadores.pendentes}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">No prazo regular</p>
        </button>

        {/* Solicitados */}
        <button
          type="button"
          onClick={() => setFiltroStatus('solicitado')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'solicitado'
              ? 'bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Solicitados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
            {contadores.solicitados}
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">Encaminhados à empresa</p>
        </button>
      </div>

      {/* 2. Banner de Alerta se houver atrasados ou vencendo */}
      {(contadores.atrasados > 0 || contadores.vencendo > 0) && (
        <div className="p-4 bg-rose-50/90 border border-rose-300 rounded-xl flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900">
                Atenção aos prazos de solicitação de alinhadores
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Existem{' '}
                {contadores.atrasados > 0 && (
                  <strong>
                    {contadores.atrasados} pedido(s) atrasado(s)
                  </strong>
                )}
                {contadores.atrasados > 0 && contadores.vencendo > 0 && ' e '}
                {contadores.vencendo > 0 && (
                  <strong>
                    {contadores.vencendo} pedido(s) vencendo nos próximos dias
                  </strong>
                )}
                . Solicite os alinhadores com antecedência mínima de 20 dias da consulta de retorno.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFiltroStatus('nao_solicitados')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors"
          >
            Ver Não Solicitados
          </button>
        </div>
      )}

      {/* Mensagens de Sucesso e Erro */}
      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {/* 3. Barra de Filtros e Ações em Lote */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Controles de Filtro */}
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Turma */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Turma:</span>
            <select
              value={filtroTurma}
              onChange={(e) => {
                setFiltroTurma(e.target.value);
                if (e.target.value !== 'todas') {
                  onSelecionarTurma(e.target.value);
                }
              }}
              className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="todas">Todas as Turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
              className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="nao_solicitados">Não solicitados (Padrão)</option>
              <option value="todos">Todos os Pedidos</option>
              <option value="atrasado">Apenas Atrasados</option>
              <option value="vencendo">Apenas Vencendo</option>
              <option value="pendente">Apenas Pendentes</option>
              <option value="solicitado">Apenas Solicitados</option>
            </select>
          </div>

          {/* Mês de Retorno */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Mês de Retorno:</span>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="todos">Todos os Meses</option>
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {formatarMesLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Busca por Nome do Paciente */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaPaciente}
              onChange={(e) => setBuscaPaciente(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Botão de Ação em Lote */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleMarcarComoSolicitados}
            disabled={processandoLote || selecionados.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            {processandoLote ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PackageCheck className="w-4 h-4" />
            )}
            <span>
              Marcar selecionados como solicitados
              {selecionados.length > 0 ? ` (${selecionados.length})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Tabela de Pedidos */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pedidos de Alinhadores ({pedidosFiltrados.length})
            </h4>
            <p className="text-[11px] text-slate-500">
              Ordenação padrão por prazo limite de solicitação ascendente (mais urgentes primeiro)
            </p>
          </div>
          {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {carregando && pedidos.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
            <span>Carregando pedidos de alinhadores...</span>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <PackageCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Nenhum pedido encontrado para os filtros selecionados.</p>
            <p className="text-[11px] text-slate-400">
              Selecione outro status ou cadastre novos retornos na aba "Pacientes".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        pedidosElegiveisParaSelecao.length > 0 &&
                        pedidosElegiveisParaSelecao.every((p) => selecionados.includes(p.id))
                      }
                      onChange={handleToggleSelecionarTodos}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      title="Selecionar todos os não solicitados visíveis"
                    />
                  </th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-3">Turma</th>
                  <th className="py-3 px-3">Data do Retorno</th>
                  <th className="py-3 px-3">Prazo Limite</th>
                  <th className="py-3 px-4 text-center">Alinhadores (De - Até)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pedidosFiltrados.map((pedido) => {
                  const status = calcularStatusPedido(pedido);
                  const prazoLimite = calcularPrazoLimite(pedido.data_retorno);
                  const isSelecionado = selecionados.includes(pedido.id);
                  const edicao = valoresEdicao[pedido.id] || { de: '', ate: '' };
                  const jaSolicitado = !!pedido.solicitado_em;

                  let statusBadgeClass = '';
                  let statusLabel = '';

                  switch (status) {
                    case 'atrasado':
                      statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                      statusLabel = 'Atrasado';
                      break;
                    case 'vencendo':
                      statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      statusLabel = 'Vencendo';
                      break;
                    case 'pendente':
                      statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                      statusLabel = 'Pendente';
                      break;
                    case 'solicitado':
                      statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      statusLabel = 'Solicitado';
                      break;
                  }

                  return (
                    <tr
                      key={pedido.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelecionado ? 'bg-brand-50/40' : ''
                      } ${jaSolicitado ? 'bg-slate-50/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelecionado}
                          disabled={jaSolicitado}
                          onChange={() => handleToggleLinha(pedido.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Paciente */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {pedido.paciente?.nome || 'Paciente não identificado'}
                        </div>
                      </td>

                      {/* Turma */}
                      <td className="py-3 px-3 font-semibold text-slate-600">
                        {turmas.find((t) => t.id === pedido.paciente?.turma_id)?.nome || '-'}
                      </td>

                      {/* Data do Retorno */}
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {formatarDataBR(pedido.data_retorno)}
                      </td>

                      {/* Prazo Limite (Retorno - 20 dias) */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700">
                          {formatarDataBR(prazoLimite)}
                        </span>
                      </td>

                      {/* Alinhadores (De e Até) com Edição Inline */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={edicao.de}
                            disabled={jaSolicitado}
                            onChange={(e) =>
                              setValoresEdicao((prev) => ({
                                ...prev,
                                [pedido.id]: { ...prev[pedido.id], de: e.target.value }
                              }))
                            }
                            onBlur={() => handleSalvarInline(pedido.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSalvarInline(pedido.id)}
                            placeholder="De"
                            className="w-14 text-center text-xs py-1 px-1 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                            title="Alinhador inicial"
                          />
                          <span className="text-slate-400 font-bold">a</span>
                          <input
                            type="number"
                            min="1"
                            value={edicao.ate}
                            disabled={jaSolicitado}
                            onChange={(e) =>
                              setValoresEdicao((prev) => ({
                                ...prev,
                                [pedido.id]: { ...prev[pedido.id], ate: e.target.value }
                              }))
                            }
                            onBlur={() => handleSalvarInline(pedido.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSalvarInline(pedido.id)}
                            placeholder="Até"
                            className="w-14 text-center text-xs py-1 px-1 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                            title="Alinhador final"
                          />

                          {/* Indicador de Salvamento Inline */}
                          {edicao.salvando && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                          )}
                          {edicao.salvo && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* Ações / Detalhes */}
                      <td className="py-3 px-4 text-right">
                        {jaSolicitado ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Solicitado em {formatarDataHora(pedido.solicitado_em)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {pedido.lote_id && (
                                <button
                                  type="button"
                                  onClick={() => handleVerMensagemLote(pedido.lote_id!)}
                                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
                                  title="Visualizar mensagem gerada para este lote"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Ver mensagem do lote</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDesfazerSolicitacao(pedido)}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Desfazer solicitação deste pedido"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Desfazer</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExcluirPedido(pedido)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir este pedido de retorno"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Modal: Mensagem Gerada ao Marcar como Solicitados */}
      {modalMensagemAberta && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Pedidos Marcados como Solicitados!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMensagemAberta(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qtdIgnoradosLote > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Nota: <strong>{qtdIgnoradosLote}</strong> pedido(s) selecionado(s) já estavam marcados como solicitados e foram preservados sem alteração.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mensagem Pronta para Encaminhar à Empresa:
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Você pode revisar ou ajustar o texto abaixo antes de copiar para o seu aplicativo de mensagens.
              </p>
              <textarea
                rows={8}
                value={textoMensagem}
                onChange={(e) => setTextoMensagem(e.target.value)}
                className="w-full text-xs font-sans p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                {copiadoFeedback ? 'Copiado com sucesso para a área de transferência!' : 'Clique no botão ao lado para copiar'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalMensagemAberta(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={() => handleCopiarMensagem(textoMensagem, setCopiadoFeedback)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {copiadoFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiadoFeedback ? 'Copiado!' : 'Copiar Mensagem'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Visualizar Mensagem do Lote Existente */}
      {modalLoteExistenteAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Mensagem do Lote de Solicitação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLoteExistenteAberto(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {carregandoLoteExistente ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span>Carregando dados do lote...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Texto consolidado dos pacientes solicitados conjuntamente neste lote:
                </p>
                <textarea
                  rows={8}
                  readOnly
                  value={textoLoteExistente}
                  className="w-full text-xs font-sans p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalLoteExistenteAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => handleCopiarMensagem(textoLoteExistente, setCopiadoLoteFeedback)}
                disabled={carregandoLoteExistente || !textoLoteExistente}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                {copiadoLoteFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiadoLoteFeedback ? 'Copiado!' : 'Copiar Mensagem'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
