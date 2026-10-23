import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  CalendarPlus,
  Power,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  CalendarDays,
  FileText
} from 'lucide-react';
import {
  Turma,
  AlinhadorPaciente,
  AlinhadorCalendario,
  formatarDataBR,
  formatarDataISO
} from '@/lib/alinhadoresTypes';
import {
  listarPacientes,
  criarPaciente,
  editarPaciente,
  listarDatasCalendario,
  listarPedidos,
  criarPedidosEmLote,
  sincronizarProximosPedidos
} from '@/lib/alinhadoresService';

interface AlinhadoresPacientesTabProps {
  turmas: Turma[];
  turmaSelecionadaId: string;
  onSelecionarTurma: (turmaId: string) => void;
  onIrParaCalendario: () => void;
}

export const AlinhadoresPacientesTab: React.FC<AlinhadoresPacientesTabProps> = ({
  turmas,
  turmaSelecionadaId,
  onSelecionarTurma,
  onIrParaCalendario
}) => {
  const [pacientes, setPacientes] = useState<AlinhadorPaciente[]>([]);
  const [pacientesComRetornoFuturo, setPacientesComRetornoFuturo] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Filtros
  const [buscaNome, setBuscaNome] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);

  // Modal Novo / Editar Paciente
  const [modalPacienteAberto, setModalPacienteAberto] = useState(false);
  const [pacienteEmEdicao, setPacienteEmEdicao] = useState<AlinhadorPaciente | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formTurmaId, setFormTurmaId] = useState(turmaSelecionadaId);
  const [formTotalAlinhadores, setFormTotalAlinhadores] = useState<string>('');
  const [formObservacao, setFormObservacao] = useState('');
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);

  // Modal Adicionar Retornos
  const [pacienteParaRetornos, setPacienteParaRetornos] = useState<AlinhadorPaciente | null>(null);
  const [datasCalendario, setDatasCalendario] = useState<AlinhadorCalendario[]>([]);
  const [carregandoCalendario, setCarregandoCalendario] = useState(false);
  const [datasSelecionadas, setDatasSelecionadas] = useState<string[]>([]);
  const [retornoAlinhadorDe, setRetornoAlinhadorDe] = useState<string>('');
  const [retornoAlinhadorAte, setRetornoAlinhadorAte] = useState<string>('');
  const [salvandoRetornos, setSalvandoRetornos] = useState(false);

  const hojeISO = formatarDataISO(new Date());

  // Limpar mensagens após 5s
  useEffect(() => {
    if (sucesso) {
      const timer = setTimeout(() => setSucesso(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [sucesso]);

  // Carregar pacientes e pedidos para saber retornos futuros
  const carregarDados = async () => {
    if (!turmaSelecionadaId) return;
    try {
      setCarregando(true);
      setErro(null);

      const [listaPacientes, listaPedidos] = await Promise.all([
        listarPacientes(turmaSelecionadaId, !mostrarInativos),
        listarPedidos({ turmaId: turmaSelecionadaId })
      ]);

      setPacientes(listaPacientes);

      // Mapear pacientes que têm ao menos um retorno futuro (data_retorno >= hoje)
      const comFuturo = new Set<string>();
      for (const p of listaPedidos) {
        if (p.data_retorno >= hojeISO) {
          comFuturo.add(p.paciente_id);
        }
      }
      setPacientesComRetornoFuturo(comFuturo);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar dados dos pacientes.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [turmaSelecionadaId, mostrarInativos]);

  // Pacientes filtrados por busca
  const pacientesFiltrados = useMemo(() => {
    let res = pacientes;
    if (buscaNome.trim()) {
      const q = buscaNome.toLowerCase().trim();
      res = res.filter((p) => p.nome.toLowerCase().includes(q));
    }
    return res;
  }, [pacientes, buscaNome]);

  // Abrir modal para novo paciente
  const abrirModalNovo = () => {
    setPacienteEmEdicao(null);
    setFormNome('');
    setFormTurmaId(turmaSelecionadaId);
    setFormTotalAlinhadores('');
    setFormObservacao('');
    setModalPacienteAberto(true);
  };

  // Abrir modal para editar paciente
  const abrirModalEditar = (paciente: AlinhadorPaciente) => {
    setPacienteEmEdicao(paciente);
    setFormNome(paciente.nome);
    setFormTurmaId(paciente.turma_id);
    setFormTotalAlinhadores(paciente.total_alinhadores !== null ? String(paciente.total_alinhadores) : '');
    setFormObservacao(paciente.observacao || '');
    setModalPacienteAberto(true);
  };

  // Salvar paciente (criar ou editar)
  const handleSalvarPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = formNome.trim();

    if (!nomeLimpo) {
      setErro('O nome do paciente é obrigatório.');
      return;
    }

    if (!formTurmaId) {
      setErro('Selecione uma turma válida.');
      return;
    }

    // Validação de unicidade por turma (case-insensitive)
    const nomeNormalizado = nomeLimpo.toLowerCase();
    const existeDuplicado = pacientes.some(
      (p) =>
        p.id !== pacienteEmEdicao?.id &&
        p.turma_id === formTurmaId &&
        p.nome.trim().toLowerCase() === nomeNormalizado
    );

    if (existeDuplicado) {
      setErro(`Já existe um paciente cadastrado com o nome "${nomeLimpo}" nesta turma.`);
      return;
    }

    const totalAlinhadoresNum = formTotalAlinhadores.trim() !== '' ? parseInt(formTotalAlinhadores, 10) : null;
    if (totalAlinhadoresNum !== null && (isNaN(totalAlinhadoresNum) || totalAlinhadoresNum < 1)) {
      setErro('O total de alinhadores deve ser um número inteiro positivo.');
      return;
    }

    try {
      setSalvandoPaciente(true);
      setErro(null);

      if (pacienteEmEdicao) {
        await editarPaciente(pacienteEmEdicao.id, {
          nome: nomeLimpo,
          turma_id: formTurmaId,
          total_alinhadores: totalAlinhadoresNum,
          observacao: formObservacao.trim() || null
        });
        setSucesso(`Paciente "${nomeLimpo}" atualizado com sucesso!`);
      } else {
        await criarPaciente({
          nome: nomeLimpo,
          turma_id: formTurmaId,
          total_alinhadores: totalAlinhadoresNum,
          observacao: formObservacao.trim() || null,
          ativo: true
        });
        await sincronizarProximosPedidos();
        setSucesso(`Paciente "${nomeLimpo}" cadastrado com sucesso!`);
      }

      setModalPacienteAberto(false);
      await carregarDados();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar paciente.');
    } finally {
      setSalvandoPaciente(false);
    }
  };

  // Alternar ativo/inativo
  const handleToggleAtivo = async (paciente: AlinhadorPaciente) => {
    const acao = paciente.ativo ? 'desativar' : 'reativar';
    const confirmou = window.confirm(`Deseja realmente ${acao} o paciente "${paciente.nome}"?`);
    if (!confirmou) return;

    try {
      setErro(null);
      await editarPaciente(paciente.id, { ativo: !paciente.ativo });
      setSucesso(`Paciente "${paciente.nome}" ${paciente.ativo ? 'desativado' : 'reativado'} com sucesso.`);
      await carregarDados();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || `Erro ao alterar status do paciente.`);
    }
  };

  // Abrir modal Adicionar Retornos
  const handleAbrirAdicionarRetornos = async (paciente: AlinhadorPaciente) => {
    setPacienteParaRetornos(paciente);
    setDatasSelecionadas([]);
    setRetornoAlinhadorDe('');
    setRetornoAlinhadorAte('');
    try {
      setCarregandoCalendario(true);
      const lista = await listarDatasCalendario(paciente.turma_id);
      // Filtrar apenas datas futuras ou de hoje
      const futuras = lista.filter((c) => c.data >= hojeISO);
      setDatasCalendario(futuras);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar datas do calendário.');
    } finally {
      setCarregandoCalendario(false);
    }
  };

  // Toggle seleção de data no modal de retornos
  const handleToggleDataSelecionada = (dataStr: string) => {
    setDatasSelecionadas((prev) =>
      prev.includes(dataStr) ? prev.filter((d) => d !== dataStr) : [...prev, dataStr]
    );
  };

  const handleSelecionarTodasDatas = () => {
    if (datasSelecionadas.length === datasCalendario.length) {
      setDatasSelecionadas([]);
    } else {
      setDatasSelecionadas(datasCalendario.map((d) => d.data));
    }
  };

  // Salvar retornos selecionados
  const handleSalvarRetornos = async () => {
    if (!pacienteParaRetornos || datasSelecionadas.length === 0) return;

    let deNum: number | null = null;
    let ateNum: number | null = null;

    if (retornoAlinhadorDe.trim() !== '') {
      deNum = parseInt(retornoAlinhadorDe, 10);
      if (isNaN(deNum) || deNum < 1) {
        setErro('O número inicial do alinhador deve ser um inteiro maior ou igual a 1.');
        return;
      }
    }

    if (retornoAlinhadorAte.trim() !== '') {
      ateNum = parseInt(retornoAlinhadorAte, 10);
      if (isNaN(ateNum) || ateNum < 1) {
        setErro('O número final do alinhador deve ser um inteiro maior ou igual a 1.');
        return;
      }
    }

    if (deNum !== null && ateNum !== null && ateNum < deNum) {
      setErro('O alinhador final deve ser maior ou igual ao alinhador inicial.');
      return;
    }

    try {
      setSalvandoRetornos(true);
      setErro(null);

      const res = await criarPedidosEmLote(
        pacienteParaRetornos.id,
        datasSelecionadas,
        deNum,
        ateNum
      );

      setPacienteParaRetornos(null);
      setSucesso(
        `${res.criados} retorno(s) cadastrado(s) com sucesso.${
          res.ignorados > 0 ? ` (${res.ignorados} já estavam cadastrados e foram mantidos)` : ''
        }`
      );
      await carregarDados();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao cadastrar retornos.');
    } finally {
      setSalvandoRetornos(false);
    }
  };

  const turmaAtual = turmas.find((t) => t.id === turmaSelecionadaId);

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Ação */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Seletor de Turma */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 shrink-0">Turma:</label>
            <select
              value={turmaSelecionadaId}
              onChange={(e) => onSelecionarTurma(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Busca por Nome */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              placeholder="Buscar paciente por nome..."
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Toggle Inativos */}
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Mostrar inativos</span>
          </label>
        </div>

        {/* Botão Novo Paciente */}
        <button
          type="button"
          onClick={abrirModalNovo}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Paciente</span>
        </button>
      </div>

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

      {/* Tabela de Pacientes */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pacientes ({pacientesFiltrados.length})
            </h4>
            <p className="text-[11px] text-slate-500">
              Acompanhamento de alinhadores da turma {turmaAtual?.nome}
            </p>
          </div>
          {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {carregando && pacientes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
            <span>Carregando pacientes...</span>
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Nenhum paciente localizado.</p>
            <p className="text-[11px] text-slate-400">
              {buscaNome ? 'Tente ajustar os termos da busca.' : 'Clique em "Novo Paciente" para cadastrar.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Turma</th>
                  <th className="py-3 px-4 text-center">Total Previsto</th>
                  <th className="py-3 px-4">Status Retornos</th>
                  <th className="py-3 px-4">Observações</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pacientesFiltrados.map((paciente) => {
                  const temRetornoFuturo = pacientesComRetornoFuturo.has(paciente.id);
                  const precisaAlertaSemRetorno = paciente.ativo && !temRetornoFuturo;

                  return (
                    <tr
                      key={paciente.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !paciente.ativo ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Nome */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{paciente.nome}</div>
                      </td>

                      {/* Turma */}
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {turmas.find((t) => t.id === paciente.turma_id)?.nome || '-'}
                      </td>

                      {/* Total alinhadores */}
                      <td className="py-3 px-4 text-center font-mono">
                        {paciente.total_alinhadores !== null ? paciente.total_alinhadores : '-'}
                      </td>

                      {/* Status de Retorno com Alerta Proeminente */}
                      <td className="py-3 px-4">
                        {precisaAlertaSemRetorno ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Sem retorno cadastrado: não haverá lembrete</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Retorno futuro agendado</span>
                          </div>
                        )}
                      </td>

                      {/* Observações */}
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate text-[11px]" title={paciente.observacao || ''}>
                        {paciente.observacao || '-'}
                      </td>

                      {/* Status Ativo / Inativo */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            paciente.ativo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {paciente.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Adicionar Retornos */}
                          <button
                            type="button"
                            onClick={() => handleAbrirAdicionarRetornos(paciente)}
                            className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Adicionar datas de retorno"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Retornos</span>
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(paciente)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar paciente"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Ativo */}
                          <button
                            type="button"
                            onClick={() => handleToggleAtivo(paciente)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              paciente.ativo
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={paciente.ativo ? 'Desativar paciente' : 'Reativar paciente'}
                          >
                            <Power className="w-3.5 h-3.5" />
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

      {/* Modal: Novo / Editar Paciente */}
      {modalPacienteAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {pacienteEmEdicao ? 'Editar Paciente' : 'Novo Paciente de Alinhadores'}
              </h3>
            </div>

            <form onSubmit={handleSalvarPaciente} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Nome do paciente"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Turma */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Turma <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formTurmaId}
                  onChange={(e) => setFormTurmaId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Total previsto de alinhadores */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Previsto de Alinhadores (opcional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formTotalAlinhadores}
                  onChange={(e) => setFormTotalAlinhadores(e.target.value)}
                  placeholder="Ex: 14"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  rows={3}
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  placeholder="Informações adicionais do tratamento..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalPacienteAberto(false)}
                  disabled={salvandoPaciente}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoPaciente}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {salvandoPaciente && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{pacienteEmEdicao ? 'Salvar Alterações' : 'Cadastrar Paciente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Retornos ao Paciente */}
      {pacienteParaRetornos && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Adicionar Retornos ao Paciente
                </h3>
                <p className="text-xs text-brand-600 font-semibold mt-0.5">
                  {pacienteParaRetornos.nome} (Turma: {turmas.find((t) => t.id === pacienteParaRetornos.turma_id)?.nome})
                </p>
              </div>
            </div>

            {carregandoCalendario ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span>Buscando datas do calendário...</span>
              </div>
            ) : datasCalendario.length === 0 ? (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Nenhuma data futura encontrada</span>
                </div>
                <p>
                  Não há datas de atendimento futuro cadastradas no calendário desta turma.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPacienteParaRetornos(null);
                    onIrParaCalendario();
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Cadastrar datas na aba Calendário</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Seleção de Datas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Selecione as Datas de Retorno:
                    </label>
                    <button
                      type="button"
                      onClick={handleSelecionarTodasDatas}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 cursor-pointer"
                    >
                      {datasSelecionadas.length === datasCalendario.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1 bg-slate-50/50">
                    {datasCalendario.map((item) => {
                      const selecionado = datasSelecionadas.includes(item.data);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                            selecionado ? 'bg-brand-50/70 text-brand-900' : 'hover:bg-slate-100/70 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => handleToggleDataSelecionada(item.data)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="text-xs font-semibold">
                              {formatarDataBR(item.data)}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {item.data}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Campos Opcionais de Alinhadores De / Ate */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <FileText className="w-3.5 h-3.5 text-brand-600" />
                    <span>Intervalo de Alinhadores (Opcional)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Se preenchido, os números abaixo serão aplicados a todos os retornos selecionados. Caso contrário, você poderá informar individualmente na tabela de pedidos.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Alinhador Inicial (De):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={retornoAlinhadorDe}
                        onChange={(e) => setRetornoAlinhadorDe(e.target.value)}
                        placeholder="Ex: 3"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Alinhador Final (Até):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={retornoAlinhadorAte}
                        onChange={(e) => setRetornoAlinhadorAte(e.target.value)}
                        placeholder="Ex: 4"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPacienteParaRetornos(null)}
                disabled={salvandoRetornos}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarRetornos}
                disabled={salvandoRetornos || datasSelecionadas.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              >
                {salvandoRetornos && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Salvar {datasSelecionadas.length} Retorno(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
