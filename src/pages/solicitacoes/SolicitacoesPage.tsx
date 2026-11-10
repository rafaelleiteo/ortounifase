import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ClipboardList,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  X,
  Filter,
  Upload,
  Copy,
  FileText,
  Check
} from 'lucide-react';
import {
  SolicitacaoAgendamento,
  TurmaItem,
  SituacaoFiltro,
  LIMITE_CARACTERES_OBSERVACAO,
  calcularDiasDecorridos,
  formatarDiasDecorridos,
  formatarEsperaResolvida,
  detectarDuplicidade
} from '@/lib/solicitacoesTypes';
import {
  LinhaImportacaoAnalisada,
  ResumoImportacao,
  parsearJsonImportacao,
  analisarLoteImportacao,
  calcularResumoImportacao,
  montarPayloadsGravacao,
  gerarTextoModeloClaude
} from '@/lib/solicitacoesImportacao';
import {
  listarTurmas,
  listarSolicitacoes,
  listarPacientesPendentes,
  criarSolicitacao,
  editarSolicitacao,
  marcarResolvido,
  excluirSolicitacao,
  importarSolicitacoes
} from '@/lib/solicitacoesService';

export const SolicitacoesPage: React.FC = () => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAgendamento[]>([]);
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoFiltro>('pendentes');
  const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
  const [buscaNome, setBuscaNome] = useState<string>('');

  // Sequencia de requisicoes para evitar race condition
  const requestSeqRef = useRef<number>(0);

  // Modal de Criacao / Edicao
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [solicitacaoEditando, setSolicitacaoEditando] = useState<SolicitacaoAgendamento | null>(null);
  const [formNome, setFormNome] = useState<string>('');
  const [formTurmaId, setFormTurmaId] = useState<string>('');
  const [formObservacao, setFormObservacao] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Duplicidade independente de filtro
  const [pacientesPendentes, setPacientesPendentes] = useState<Array<{ paciente: string }>>([]);
  const [erroVerificarDuplicidade, setErroVerificarDuplicidade] = useState<boolean>(false);

  // Modal de Exclusao
  const [solicitacaoExcluindo, setSolicitacaoExcluindo] = useState<SolicitacaoAgendamento | null>(null);
  const [excluindo, setExcluindo] = useState<boolean>(false);

  // Estado de acao individual por linha (resolvendo/reabrindo)
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const [sucesso, setSucesso] = useState<string | null>(null);

  // Modal de Importacao em Lote
  const [modalImportacaoAberto, setModalImportacaoAberto] = useState<boolean>(false);
  const [textoJson, setTextoJson] = useState<string>('');
  const [arquivoJsonNome, setArquivoJsonNome] = useState<string | null>(null);
  const [linhasAnalisadas, setLinhasAnalisadas] = useState<LinhaImportacaoAnalisada[]>([]);
  const [resumoImportacao, setResumoImportacao] = useState<ResumoImportacao | null>(null);
  const [analisando, setAnalisando] = useState<boolean>(false);
  const [importando, setImportando] = useState<boolean>(false);
  const [erroImportacaoModal, setErroImportacaoModal] = useState<string | null>(null);
  const [avisoDuplicidadeModal, setAvisoDuplicidadeModal] = useState<string | null>(null);
  const [copiadoClaude, setCopiadoClaude] = useState<boolean>(false);
  const [mostrarCaixaModelo, setMostrarCaixaModelo] = useState<boolean>(false);
  const [textoModeloClaude, setTextoModeloClaude] = useState<string>('');
  const importandoRef = useRef<boolean>(false);
  const inputFileRef = useRef<HTMLInputElement>(null);


  // Carregar turmas no inicio
  useEffect(() => {
    let montado = true;
    const carregarTurmasIniciais = async () => {
      try {
        const lista = await listarTurmas();
        if (montado) {
          setTurmas(lista);
        }
      } catch (err: any) {
        if (montado) {
          console.error('Falha ao carregar turmas:', err);
          setErro(err.message || 'Falha ao consultar turmas no banco.');
        }
      }
    };
    carregarTurmasIniciais();
    return () => {
      montado = false;
    };
  }, []);

  // Carregar solicitacoes com debounce na busca
  const carregarDados = async (termoBusca?: string) => {
    const seq = ++requestSeqRef.current;
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarSolicitacoes({
        situacao: situacaoFiltro,
        turma_id: turmaFiltro,
        buscaNome: termoBusca !== undefined ? termoBusca : buscaNome
      });
      if (seq === requestSeqRef.current) {
        setSolicitacoes(lista);
      }
    } catch (err: any) {
      if (seq === requestSeqRef.current) {
        console.error('Erro ao listar solicitacoes:', err);
        setErro(err.message || 'Erro ao consultar solicitacoes.');
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setCarregando(false);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados(buscaNome);
    }, 300);
    return () => clearTimeout(timer);
  }, [situacaoFiltro, turmaFiltro, buscaNome]);

  // Handlers da Importacao em Lote
  const handleAbrirImportacao = () => {
    setTextoJson('');
    setArquivoJsonNome(null);
    setLinhasAnalisadas([]);
    setResumoImportacao(null);
    setErroImportacaoModal(null);
    setAvisoDuplicidadeModal(null);
    setMostrarCaixaModelo(false);
    setCopiadoClaude(false);
    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
    setModalImportacaoAberto(true);
  };

  const handleArquivoJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setErroImportacaoModal('O arquivo selecionado excede o limite máximo de 1 MB.');
      return;
    }

    setArquivoJsonNome(file.name);
    setErroImportacaoModal(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudo = String(event.target?.result || '');
      setTextoJson(conteudo);
    };
    reader.onerror = () => {
      setErroImportacaoModal('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  const handleAnalisarJson = async () => {
    if (!textoJson.trim()) {
      setErroImportacaoModal('Cole o JSON ou selecione um arquivo para analisar.');
      return;
    }

    setAnalisando(true);
    setErroImportacaoModal(null);
    setAvisoDuplicidadeModal(null);

    let pendentesAtuais: Array<{ paciente: string }> = [];
    try {
      pendentesAtuais = await listarPacientesPendentes();
    } catch (err) {
      console.warn('Falha ao consultar pacientes pendentes durante analise de lote:', err);
      setAvisoDuplicidadeModal('Não foi possível verificar duplicidade com a lista atual.');
    }

    try {
      const itensCrus = parsearJsonImportacao(textoJson);
      const linhas = analisarLoteImportacao(itensCrus, turmas, pendentesAtuais);
      setLinhasAnalisadas(linhas);
      setResumoImportacao(calcularResumoImportacao(linhas));
    } catch (err: any) {
      setErroImportacaoModal(err.message || 'Erro ao processar o formato do JSON.');
      setLinhasAnalisadas([]);
      setResumoImportacao(null);
    } finally {
      setAnalisando(false);
    }
  };

  const handleToggleLinha = (indice: number) => {
    setLinhasAnalisadas((prev) =>
      prev.map((l) => (l.indice === indice && l.status !== 'erro' ? { ...l, selecionada: !l.selecionada } : l))
    );
  };

  const handleToggleTodas = (marcar: boolean) => {
    setLinhasAnalisadas((prev) =>
      prev.map((l) => (l.status !== 'erro' ? { ...l, selecionada: marcar } : l))
    );
  };

  const handleCopiarModeloClaude = async () => {
    const texto = gerarTextoModeloClaude(turmas);
    setTextoModeloClaude(texto);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
        setCopiadoClaude(true);
        setTimeout(() => setCopiadoClaude(false), 3000);
      } else {
        setMostrarCaixaModelo(true);
      }
    } catch {
      setMostrarCaixaModelo(true);
    }
  };

  const handleExecutarImportacao = async () => {
    if (importandoRef.current) return;

    const payloads = montarPayloadsGravacao(linhasAnalisadas);
    if (payloads.length === 0) {
      setErroImportacaoModal('Nenhuma solicitação selecionada para importação.');
      return;
    }

    importandoRef.current = true;
    setImportando(true);
    setErroImportacaoModal(null);

    try {
      const qtdGravada = await importarSolicitacoes(payloads);
      setModalImportacaoAberto(false);
      setSucesso(`${qtdGravada} solicitações importadas com sucesso`);
      setSituacaoFiltro('pendentes');
      await carregarDados();
    } catch (err: any) {
      setErroImportacaoModal(err.message || 'Erro ao gravar solicitações no banco.');
    } finally {
      importandoRef.current = false;
      setImportando(false);
    }
  };

  // Abertura do modal para criacao
  const handleAbrirCriacao = async () => {
    setSolicitacaoEditando(null);
    setFormNome('');
    setFormTurmaId('');
    setFormObservacao('');
    setErroModal(null);
    setErroVerificarDuplicidade(false);
    setModalAberto(true);
    try {
      const lista = await listarPacientesPendentes();
      setPacientesPendentes(lista);
    } catch (err) {
      console.error('Falha ao consultar pacientes pendentes para duplicidade:', err);
      setErroVerificarDuplicidade(true);
    }
  };

  // Abertura do modal para edicao
  const handleAbrirEdicao = (item: SolicitacaoAgendamento) => {
    setSolicitacaoEditando(item);
    setFormNome(item.paciente);
    setFormTurmaId(item.turma_id || '');
    setFormObservacao(item.observacao || '');
    setErroModal(null);
    setModalAberto(true);
  };

  // Salvar criacao ou edicao
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setErroModal('O nome do paciente é obrigatório.');
      return;
    }

    try {
      setSalvando(true);
      setErroModal(null);

      if (solicitacaoEditando) {
        await editarSolicitacao(solicitacaoEditando.id, {
          paciente: formNome.trim(),
          turma_id: formTurmaId || null,
          observacao: formObservacao.trim() || null
        });
      } else {
        await criarSolicitacao({
          paciente: formNome.trim(),
          turma_id: formTurmaId || null,
          observacao: formObservacao.trim() || null
        });
      }

      setModalAberto(false);
      await carregarDados();
    } catch (err: any) {
      setErroModal(err.message || 'Erro ao salvar solicitação.');
    } finally {
      setSalvando(false);
    }
  };

  // Alternar resolucao
  const handleAlternarResolucao = async (item: SolicitacaoAgendamento) => {
    try {
      setProcessandoId(item.id);
      setErro(null);
      await marcarResolvido(item.id, !item.resolvido);
      await carregarDados();
    } catch (err: any) {
      setErro(err.message || 'Erro ao alterar situação da solicitação.');
    } finally {
      setProcessandoId(null);
    }
  };

  // Excluir solicitacao
  const handleConfirmarExclusao = async () => {
    if (!solicitacaoExcluindo) return;
    try {
      setExcluindo(true);
      setErro(null);
      await excluirSolicitacao(solicitacaoExcluindo.id);
      setSolicitacaoExcluindo(null);
      await carregarDados();
    } catch (err: any) {
      setErro(err.message || 'Erro ao remover solicitação.');
    } finally {
      setExcluindo(false);
    }
  };

  // Verificacao de duplicidade de nome em tempo real no modal de criacao
  const existeDuplicadaPendente =
    !solicitacaoEditando &&
    !erroVerificarDuplicidade &&
    formNome.trim().length > 0 &&
    detectarDuplicidade(formNome, pacientesPendentes);

  return (
    <DashboardLayout
      pageTitle="Solicitações de Agendamento"
      pageSubtitle="Fila de espera e triagem de pacientes para inclusão nas agendas das turmas"
    >
      <div className="space-y-6">
        {/* Barra Superior de Acoes e Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Situacao Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSituacaoFiltro('pendentes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  situacaoFiltro === 'pendentes'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setSituacaoFiltro('resolvidos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  situacaoFiltro === 'resolvidos'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resolvidos
              </button>
              <button
                type="button"
                onClick={() => setSituacaoFiltro('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  situacaoFiltro === 'todos'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Botoes de Acao: Importar e Nova Solicitacao */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAbrirImportacao}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Importar lista de solicitações via JSON"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Importar</span>
              </button>

              <button
                type="button"
                onClick={handleAbrirCriacao}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Solicitação</span>
              </button>
            </div>
          </div>

          {/* Linha de Filtros: Busca e Turma */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
            {/* Campo de Busca por Nome */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaNome}
                onChange={(e) => setBuscaNome(e.target.value)}
                placeholder="Buscar por nome do paciente..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>

            {/* Filtro por Turma / Agenda */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={turmaFiltro}
                onChange={(e) => setTurmaFiltro(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="todas">Todas as agendas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    Turma {t.nome}
                  </option>
                ))}
                <option value="nenhuma">Sem agenda definida (Nenhuma)</option>
              </select>
            </div>

            {/* Contador / Resumo */}
            <div className="flex items-center justify-end text-xs text-slate-500 sm:col-span-2 md:col-span-1">
              <span>
                Total: <strong>{solicitacoes.length}</strong> registro(s)
              </span>
            </div>
          </div>
        </div>

        {/* Banner de Sucesso */}
        {sucesso && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{sucesso}</span>
            </div>
            <button
              type="button"
              onClick={() => setSucesso(null)}
              className="text-emerald-500 hover:text-emerald-800 text-sm font-bold px-1 rounded cursor-pointer"
              title="Fechar aviso"
            >
              ×
            </button>
          </div>
        )}

        {/* Banner de Erro Geral */}
        {erro && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-rose-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erro}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setErro(null);
                carregarDados();
              }}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Tabela de Solicitacoes */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {carregando ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs font-medium">Carregando solicitações de agendamento...</p>
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ClipboardList className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Nenhuma solicitação encontrada</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {buscaNome
                  ? `Nenhuma solicitação corresponde ao termo "${buscaNome}".`
                  : situacaoFiltro === 'pendentes'
                  ? 'Não há solicitações pendentes no momento. Fila zerada!'
                  : 'Nenhum registro encontrado para os filtros selecionados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Agenda Pretendida</th>
                    <th className="py-3 px-4">Observação</th>
                    <th className="py-3 px-4">Entrada</th>
                    <th className="py-3 px-4">Tempo de Espera</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                  {solicitacoes.map((item) => {
                    const diasEspera = item.resolvido
                      ? calcularDiasDecorridos(item.created_at, item.resolvido_em || item.updated_at)
                      : calcularDiasDecorridos(item.created_at);
                    const textoEspera = item.resolvido
                      ? formatarEsperaResolvida(item.created_at, item.resolvido_em || item.updated_at)
                      : formatarDiasDecorridos(diasEspera);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Nome do Paciente */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate max-w-xs">{item.paciente}</span>
                          </div>
                        </td>

                        {/* Agenda / Turma */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.turmas?.nome ? (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                              {item.turmas.nome}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Nenhuma
                            </span>
                          )}
                        </td>

                        {/* Observacao (ate 2 linhas com tooltip nativo) */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {item.observacao ? (
                            <p
                              title={item.observacao}
                              className="text-xs text-slate-600 line-clamp-2 cursor-help"
                            >
                              {item.observacao}
                            </p>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sem observação</span>
                          )}
                        </td>

                        {/* Data de Entrada */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {new Date(item.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Tempo de Espera */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.resolvido
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : diasEspera > 14
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : diasEspera === 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {textoEspera}
                          </span>
                        </td>

                        {/* Situacao */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.resolvido ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Resolvido
                              </span>
                              {item.resolvido_em && (
                                <p className="text-[10px] text-slate-400">
                                  {new Date(item.resolvido_em).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Acoes */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* Botao Resolver ou Reabrir */}
                            <button
                              type="button"
                              onClick={() => handleAlternarResolucao(item)}
                              disabled={processandoId === item.id}
                              title={item.resolvido ? 'Reabrir solicitação' : 'Marcar como resolvido'}
                              className={`p-1.5 rounded transition-colors cursor-pointer ${
                                item.resolvido
                                  ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {processandoId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                              ) : item.resolvido ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                            </button>

                            {/* Botao Editar */}
                            <button
                              type="button"
                              onClick={() => handleAbrirEdicao(item)}
                              title="Editar solicitação"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Botao Excluir */}
                            <button
                              type="button"
                              onClick={() => setSolicitacaoExcluindo(item)}
                              title="Excluir solicitação"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criacao e Edicao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-50 text-brand-700 rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {solicitacaoEditando ? 'Editar Solicitação' : 'Nova Solicitação de Agendamento'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {solicitacaoEditando ? 'Atualize as informações do paciente' : 'Cadastre um paciente na fila de triagem'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso Amarelo de Duplicidade */}
            {existeDuplicadaPendente && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Já existe uma solicitação pendente com este nome.</span>
              </div>
            )}

            {/* Aviso quando a verificacao de duplicidade falha */}
            {erroVerificarDuplicidade && !solicitacaoEditando && (
              <p className="text-[11px] text-slate-400">
                Não foi possível verificar duplicidade agora.
              </p>
            )}

            {/* Erro do Formulario */}
            {erroModal && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {erroModal}
              </div>
            )}

            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Paciente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Agenda Pretendida
                </label>
                <select
                  value={formTurmaId}
                  onChange={(e) => setFormTurmaId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Nenhuma agenda definida (A definir)</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      Turma {t.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecione uma turma específica ou deixe em branco caso a agenda ainda não esteja definida.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Observação / Triagem</label>
                  <span className="text-[11px] text-slate-400">
                    {formObservacao.length}/{LIMITE_CARACTERES_OBSERVACAO}
                  </span>
                </div>
                <textarea
                  value={formObservacao}
                  onChange={(e) =>
                    setFormObservacao(e.target.value.slice(0, LIMITE_CARACTERES_OBSERVACAO))
                  }
                  rows={3}
                  maxLength={LIMITE_CARACTERES_OBSERVACAO}
                  placeholder="Anotações sobre queixa principal, contato telefônico, urgência..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando || !formNome.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{solicitacaoEditando ? 'Salvar Alterações' : 'Cadastrar Solicitação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importacao em Lote */}
      {modalImportacaoAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Cabecalho do Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Importar Solicitações em Lote
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Importe múltiplas solicitações de uma só vez a partir de uma lista JSON
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalImportacaoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteudo com Rolagem */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Barra do Modelo para Claude */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="text-[11px]">
                    Precisa converter uma lista de pacientes? Copie as instruções prontas para o Claude:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopiarModeloClaude}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 transition-colors"
                >
                  {copiadoClaude ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Modelo copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar modelo para o Claude</span>
                    </>
                  )}
                </button>
              </div>

              {/* Caixa alternativa caso clipboard nao esteja acessivel */}
              {mostrarCaixaModelo && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900">
                      Copie o texto abaixo manualmente:
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarCaixaModelo(false)}
                      className="text-amber-700 hover:text-amber-900 text-xs font-bold px-1"
                    >
                      Fechar
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={textoModeloClaude}
                    rows={6}
                    className="w-full text-[11px] font-mono p-2 border border-amber-200 rounded-lg bg-white resize-none"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              )}

              {/* Entrada de JSON: Textarea e Arquivo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Conteúdo JSON
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Máximo de 200 solicitações por importação
                  </span>
                </div>

                <textarea
                  value={textoJson}
                  onChange={(e) => setTextoJson(e.target.value)}
                  placeholder={`[
  { "paciente": "Maria da Silva", "agenda": "ESP1", "observacao": "Prefere tarde" },
  { "paciente": "Joao Souza", "agenda": null, "observacao": null }
]`}
                  rows={6}
                  className="w-full font-mono text-[11px] px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white resize-y"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>{arquivoJsonNome ? 'Trocar arquivo .json' : 'Carregar arquivo .json'}</span>
                      <input
                        ref={inputFileRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleArquivoJsonChange}
                        className="hidden"
                      />
                    </label>
                    {arquivoJsonNome && (
                      <span className="text-[11px] text-slate-500 truncate max-w-xs">
                        {arquivoJsonNome}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAnalisarJson}
                    disabled={analisando || !textoJson.trim()}
                    className="w-full sm:w-auto px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {analisando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{analisando ? 'Analisando...' : 'Analisar e Pré-visualizar'}</span>
                  </button>
                </div>
              </div>

              {/* Avisos e Erros do Modal de Importacao */}
              {erroImportacaoModal && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Atenção ao processar o lote</p>
                    <p>{erroImportacaoModal}</p>
                  </div>
                </div>
              )}

              {avisoDuplicidadeModal && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{avisoDuplicidadeModal}</span>
                </div>
              )}

              {/* Tabela de Previa de Linhas */}
              {linhasAnalisadas.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Resumo Quantitativo */}
                  {resumoImportacao && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold">
                          {resumoImportacao.prontas} prontas
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-bold">
                          {resumoImportacao.duplicadas} duplicadas
                        </span>
                        {resumoImportacao.erros > 0 && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-md font-bold">
                            {resumoImportacao.erros} com erro
                          </span>
                        )}
                        <span className="text-slate-400">
                          Total: {resumoImportacao.total}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleToggleTodas(true)}
                          className="text-brand-600 hover:underline font-semibold cursor-pointer"
                        >
                          Marcar todas válidas
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleToggleTodas(false)}
                          className="text-slate-500 hover:underline font-semibold cursor-pointer"
                        >
                          Desmarcar todas
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Previa */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                linhasAnalisadas.filter((l) => l.status !== 'erro').length > 0 &&
                                linhasAnalisadas.filter((l) => l.status !== 'erro').every((l) => l.selecionada)
                              }
                              onChange={(e) => handleToggleTodas(e.target.checked)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                          </th>
                          <th className="py-2.5 px-2 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Paciente</th>
                          <th className="py-2.5 px-3">Agenda</th>
                          <th className="py-2.5 px-3">Observação</th>
                          <th className="py-2.5 px-3">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {linhasAnalisadas.map((linha) => {
                          const isErro = linha.status === 'erro';
                          const isDup = linha.status === 'duplicada_banco' || linha.status === 'duplicada_lote';

                          return (
                            <tr
                              key={linha.indice}
                              className={`transition-colors ${
                                isErro
                                  ? 'bg-rose-50/40 text-rose-900'
                                  : linha.selecionada
                                  ? 'bg-white hover:bg-slate-50/80'
                                  : 'bg-slate-50/50 text-slate-400'
                              }`}
                            >
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={isErro}
                                  checked={linha.selecionada}
                                  onChange={() => handleToggleLinha(linha.indice)}
                                  className="rounded text-brand-600 focus:ring-brand-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-2 px-2 text-center text-slate-400 font-mono">
                                {linha.indice}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {linha.paciente || <span className="text-rose-500 italic">(vazio)</span>}
                              </td>
                              <td className="py-2 px-3">
                                <span className={linha.turma_id ? 'font-medium text-slate-700' : 'text-slate-400 italic'}>
                                  {linha.turmaNome}
                                </span>
                              </td>
                              <td className="py-2 px-3 max-w-xs">
                                {linha.observacao ? (
                                  <span className="line-clamp-2" title={linha.observacao}>
                                    {linha.observacao}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {linha.status === 'ok' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Pronta
                                  </span>
                                )}
                                {linha.status === 'aviso' && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                    title={linha.motivoStatus}
                                  >
                                    Aviso de agenda
                                  </span>
                                )}
                                {linha.status === 'duplicada_banco' && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300"
                                    title={linha.motivoStatus}
                                  >
                                    Já existe no sistema
                                  </span>
                                )}
                                {linha.status === 'duplicada_lote' && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    title={linha.motivoStatus}
                                  >
                                    Repetida no lote
                                  </span>
                                )}
                                {linha.status === 'erro' && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                                    title={linha.motivoStatus}
                                  >
                                    Erro: {linha.motivoStatus}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Rodape do Modal */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-500">
                {linhasAnalisadas.length > 0 && (
                  <>
                    <strong>
                      {linhasAnalisadas.filter((l) => l.selecionada && l.status !== 'erro').length}
                    </strong>{' '}
                    solicitação(ões) selecionada(s) para gravação
                  </>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalImportacaoAberto(false)}
                  disabled={importando}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutarImportacao}
                  disabled={
                    importando ||
                    linhasAnalisadas.filter((l) => l.selecionada && l.status !== 'erro').length === 0
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {importando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    Importar{' '}
                    {linhasAnalisadas.filter((l) => l.selecionada && l.status !== 'erro').length > 0
                      ? `${linhasAnalisadas.filter((l) => l.selecionada && l.status !== 'erro').length} selecionada(s)`
                      : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmacao de Exclusao */}
      {solicitacaoExcluindo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Excluir Solicitação</h3>
            </div>
            <p className="text-xs text-slate-600">
              Tem certeza de que deseja excluir permanentemente a solicitação de{' '}
              <strong>"{solicitacaoExcluindo.paciente}"</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSolicitacaoExcluindo(null)}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {excluindo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SolicitacoesPage;
