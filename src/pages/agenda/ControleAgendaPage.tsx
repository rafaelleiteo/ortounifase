import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  CalendarCheck2,
  Download,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  CalendarX,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Clock,
  User,
  Users,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ControleItem,
  ControleMes,
  ControleStatus,
  ControleOrigem,
  alternarStatus,
  validarObservacao,
  podeRemoverItem,
  ordenarControleItens,
  calcularContadoresControle,
  formatarHorarioControle,
  normalizarMesReferencia,
  extrairAnoMes
} from '@/lib/controleAgenda';
import {
  carregarControleAgenda,
  carregarDadosParaImportacao,
  salvarControleAgenda
} from '@/lib/controleAgendaService';
import {
  canonicalizarDia,
  rotuloDia,
  compararDiasSemana,
  DiaSemanaCanonica
} from '@/lib/agendaDias';

interface TurmaOpcao {
  id: string;
  nome: string;
}

interface AlunoOpcao {
  id: string;
  nome: string;
}

const getMesAtualPadrao = (): string => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

export const ControleAgendaPage: React.FC = () => {
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>('');
  const [mesReferencia, setMesReferencia] = useState<string>(getMesAtualPadrao());
  const [alunosTurma, setAlunosTurma] = useState<AlunoOpcao[]>([]);

  const [cabecalho, setCabecalho] = useState<ControleMes | null>(null);
  const [itens, setItens] = useState<ControleItem[]>([]);
  const [dataImportacao, setDataImportacao] = useState<string | null>(null);

  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [importando, setImportando] = useState<boolean>(false);
  const [temAlteracoesNaoSalvas, setTemAlteracoesNaoSalvas] = useState<boolean>(false);

  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Modal para adicionar paciente avulso
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState<boolean>(false);
  const [diaParaAdicionar, setDiaParaAdicionar] = useState<string>('QUINTA');
  const [novoHorario, setNovoHorario] = useState<string>('08:00');
  const [novoPaciente, setNovoPaciente] = useState<string>('');
  const [novoAluno, setNovoAluno] = useState<string>('');

  // 1. Carrega lista de turmas ao montar
  useEffect(() => {
    async function carregarTurmas() {
      try {
        setCarregando(true);
        const { data, error } = await supabase
          .from('turmas')
          .select('id, nome')
          .order('nome');

        if (error) throw error;

        if (data && data.length > 0) {
          setTurmas(data);
          setTurmaSelecionadaId(data[0].id);
        }
      } catch (err: any) {
        console.error('Erro ao carregar turmas:', err);
        setErro(err?.message || 'Falha ao carregar lista de turmas');
      } finally {
        setCarregando(false);
      }
    }
    carregarTurmas();
  }, []);

  // 2. Carrega alunos da turma selecionada
  useEffect(() => {
    if (!turmaSelecionadaId) return;
    async function carregarAlunos() {
      try {
        const { data, error } = await supabase
          .from('agenda_alunos')
          .select('id, nome')
          .eq('turma_id', turmaSelecionadaId)
          .eq('ativo', true)
          .order('nome');

        if (error) throw error;
        setAlunosTurma(data || []);
      } catch (err: any) {
        console.warn('Aviso ao carregar alunos da turma:', err);
      }
    }
    carregarAlunos();
  }, [turmaSelecionadaId]);

  // 3. Carrega controle da turma e mes selecionados
  const carregarDadosControle = useCallback(async (turmaId: string, mes: string) => {
    if (!turmaId || !mes) return;
    try {
      setCarregando(true);
      setErro(null);
      const resultado = await carregarControleAgenda(turmaId, mes);
      setCabecalho(resultado.cabecalho);
      setItens(resultado.itens);
      setDataImportacao(resultado.cabecalho?.importado_em || null);
      setTemAlteracoesNaoSalvas(false);
    } catch (err: any) {
      console.error('Erro ao carregar controle de agenda:', err);
      setErro(err?.message || 'Falha ao consultar controle de agenda');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (turmaSelecionadaId && mesReferencia) {
      carregarDadosControle(turmaSelecionadaId, mesReferencia);
    }
  }, [turmaSelecionadaId, mesReferencia, carregarDadosControle]);

  // 4. Bloqueio de saida com alteracoes nao salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (temAlteracoesNaoSalvas) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [temAlteracoesNaoSalvas]);

  // Troca de turma ou mes com confirmacao se houver alteracoes pendentes
  const handleMudarTurma = (novoTurmaId: string) => {
    if (temAlteracoesNaoSalvas) {
      const confirmou = window.confirm(
        'Existem alteracoes nao salvas nesta turma. Deseja descartar as alteracoes e mudar de turma?'
      );
      if (!confirmou) return;
    }
    setTurmaSelecionadaId(novoTurmaId);
  };

  const handleMudarMes = (novoMes: string) => {
    if (temAlteracoesNaoSalvas) {
      const confirmou = window.confirm(
        'Existem alteracoes nao salvas neste mes. Deseja descartar as alteracoes e mudar de mes?'
      );
      if (!confirmou) return;
    }
    setMesReferencia(novoMes);
  };

  // 5. Acao: Importar da Agenda Mensal
  const handleImportar = async () => {
    if (itens.length > 0 || cabecalho !== null) {
      const confirmou = window.confirm(
        'Reimportar substitui a lista atual, incluindo todas as marcacoes e observacoes. Continuar?'
      );
      if (!confirmou) return;
    }

    try {
      setImportando(true);
      setErro(null);
      const listaImportada = await carregarDadosParaImportacao(turmaSelecionadaId, mesReferencia);

      if (listaImportada.length === 0) {
        setErro('Nenhum registro encontrado na agenda mensal ou fixa para a turma e mes selecionados.');
        return;
      }

      setItens(listaImportada);
      setDataImportacao(null);
      setTemAlteracoesNaoSalvas(true);
      setSucesso(`Lista importada com sucesso em memoria! ${listaImportada.length} pacientes carregados. Clique em Salvar para persistir.`);
    } catch (err: any) {
      console.error('Erro na importacao:', err);
      setErro(err?.message || 'Falha ao importar registros da agenda');
    } finally {
      setImportando(false);
    }
  };

  // 6. Acao: Salvar
  const handleSalvar = async () => {
    if (!turmaSelecionadaId || !mesReferencia) return;
    try {
      setSalvando(true);
      setErro(null);
      setSucesso(null);

      const novoId = await salvarControleAgenda(
        turmaSelecionadaId,
        mesReferencia,
        itens,
        dataImportacao
      );

      setTemAlteracoesNaoSalvas(false);
      setSucesso('Controle de agenda salvo com sucesso!');
      await carregarDadosControle(turmaSelecionadaId, mesReferencia);
    } catch (err: any) {
      console.error('Erro ao salvar controle de agenda:', err);
      setErro(err?.message || 'Falha ao gravar controle de agenda no banco de dados');
    } finally {
      setSalvando(false);
    }
  };

  // 7. Acao: Alternar estado de uma linha
  const handleAlternarStatus = (itemId: string, novoStatus: ControleStatus) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const statusAtualizado = alternarStatus(item.status, novoStatus);
          return { ...item, status: statusAtualizado };
        }
        return item;
      })
    );
    setTemAlteracoesNaoSalvas(true);
  };

  // 8. Acao: Editar observacao de uma linha
  const handleEditarObservacao = (itemId: string, novoTexto: string) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, observacao: novoTexto };
        }
        return item;
      })
    );
    setTemAlteracoesNaoSalvas(true);
  };

  // 9. Acao: Remover paciente avulso
  const handleRemoverItem = (itemId: string) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;

    if (!podeRemoverItem(item)) {
      alert('Apenas pacientes de origem Avulso podem ser removidos.');
      return;
    }

    const confirmou = window.confirm(`Remover paciente avulso "${item.paciente}"?`);
    if (!confirmou) return;

    setItens((prev) => prev.filter((i) => i.id !== itemId));
    setTemAlteracoesNaoSalvas(true);
  };

  // 10. Acao: Abrir modal de adicionar avulso
  const handleAbrirAdicionar = (dia: string) => {
    const diaCanonico = canonicalizarDia(dia) || 'QUINTA';
    setDiaParaAdicionar(diaCanonico);
    setNovoHorario('08:00');
    setNovoPaciente('');
    setNovoAluno('');
    setModalAdicionarAberto(true);
  };

  // 11. Acao: Confirmar adicao de avulso
  const handleConfirmarAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = novoPaciente.trim();
    if (!nomeLimpo) {
      alert('Informe o nome do paciente');
      return;
    }

    const diaCanonico = canonicalizarDia(diaParaAdicionar) || 'QUINTA';
    const horarioFormatado = formatarHorarioControle(novoHorario);

    const alunoSelecionado = alunosTurma.find((a) => a.nome === novoAluno);

    const novoItem: ControleItem = {
      id: 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      origem: 'avulso',
      dia_semana: diaCanonico,
      data_atendimento: null,
      horario: horarioFormatado,
      paciente: nomeLimpo,
      aluno_nome: novoAluno.trim() || null,
      aluno_id: alunoSelecionado?.id || null,
      status: null,
      observacao: null
    };

    const listaAtualizada = ordenarControleItens([...itens, novoItem]).map((item, idx) => ({
      ...item,
      ordem: idx + 1
    }));

    setItens(listaAtualizada);
    setTemAlteracoesNaoSalvas(true);
    setModalAdicionarAberto(false);
  };

  // Contadores calculados
  const contadores = useMemo(() => calcularContadoresControle(itens), [itens]);

  // Agrupamento por dia da semana
  const itensPorDia = useMemo(() => {
    const grupos: Record<string, ControleItem[]> = {};

    for (const item of itens) {
      const diaCanonico = canonicalizarDia(item.dia_semana) || 'OUTRO';
      if (!grupos[diaCanonico]) {
        grupos[diaCanonico] = [];
      }
      grupos[diaCanonico].push(item);
    }

    const diasOrdenados = Object.keys(grupos).sort((a, b) => compararDiasSemana(a, b));

    return diasOrdenados.map((dia) => ({
      dia,
      rotulo: rotuloDia(dia),
      itens: ordenarControleItens(grupos[dia])
    }));
  }, [itens]);

  const turmaAtual = turmas.find((t) => t.id === turmaSelecionadaId);

  return (
    <DashboardLayout
      pageTitle="Controle de Agenda"
      pageSubtitle="Acompanhamento mensal de atendimentos, faltas e desmarcacoes por turma"
    >
      <div className="space-y-6">
        {/* Barra superior de controles e seletores */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-brand-50 text-brand-600">
                <CalendarCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {turmaAtual ? `Turma ${turmaAtual.nome}` : 'Selecione a Turma'}
                </h3>
                <p className="text-xs text-slate-500">
                  Referencia: {mesReferencia} | {itens.length} {itens.length === 1 ? 'paciente' : 'pacientes'} na grade
                </p>
              </div>
            </div>

            {/* Botoes de Acao */}
            <div className="flex items-center gap-2 flex-wrap">
              {temAlteracoesNaoSalvas && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Alteracoes nao salvas
                </span>
              )}

              <button
                type="button"
                onClick={handleImportar}
                disabled={importando || carregando}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                title="Importar registros da Agenda Mensal e Fixa"
              >
                {importando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>Importar da Agenda Mensal</span>
              </button>

              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando || carregando || (!temAlteracoesNaoSalvas && cabecalho !== null)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {salvando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Salvar</span>
              </button>
            </div>
          </div>

          {/* Seletores de Turma e Mes */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Turma:</span>
              <select
                value={turmaSelecionadaId}
                onChange={(e) => handleMudarTurma(e.target.value)}
                disabled={carregando || salvando}
                className="w-full sm:w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Mes:</span>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => handleMudarMes(e.target.value)}
                disabled={carregando || salvando}
                className="w-full sm:w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Alertas de Erro ou Sucesso */}
        {erro && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-800">
              <strong className="font-semibold">Erro: </strong>
              {erro}
            </div>
            <button
              type="button"
              onClick={() => setErro(null)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {sucesso && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-emerald-800">
              <strong className="font-semibold">Sucesso: </strong>
              {sucesso}
            </div>
            <button
              type="button"
              onClick={() => setSucesso(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cabecalho de Contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Atendidos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-700">{contadores.atendidos}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Faltaram</span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-bold text-rose-700">{contadores.faltaram}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Desmarcaram</span>
              <CalendarX className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-700">{contadores.desmarcaram}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Nao Marcaram</span>
              <AlertCircle className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-bold text-slate-700">{contadores.naoMarcaram}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pendentes</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-xl font-bold text-sky-700">{contadores.pendentes}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
              <Users className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">{contadores.total}</div>
          </div>
        </div>

        {/* Estado Carregando */}
        {carregando ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Carregando dados de controle da agenda...</p>
          </div>
        ) : itens.length === 0 ? (
          /* Estado Vazio */
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
              <CalendarCheck2 className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="text-base font-bold text-slate-800">Nenhum controle registrado para este mes</h4>
              <p className="text-xs text-slate-500 mt-1">
                Clique abaixo para importar os pacientes agendados na Agenda Mensal e Fixa da turma {turmaAtual?.nome}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportar}
              disabled={importando}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {importando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Importar da Agenda Mensal</span>
            </button>
          </div>
        ) : (
          /* Lista de Pacientes Agrupada por Dia */
          <div className="space-y-6">
            {itensPorDia.map((grupo) => (
              <div
                key={grupo.dia}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Cabecalho do Dia */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {grupo.rotulo}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-700">
                      {grupo.itens.length} {grupo.itens.length === 1 ? 'paciente' : 'pacientes'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAbrirAdicionar(grupo.dia)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-brand-700 border border-brand-200 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Paciente</span>
                  </button>
                </div>

                {/* Tabela de Pacientes do Dia */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 font-semibold uppercase">
                        <th className="py-2.5 px-4 w-20">Horario</th>
                        <th className="py-2.5 px-4 min-w-[160px]">Paciente</th>
                        <th className="py-2.5 px-4 w-28">Origem</th>
                        <th className="py-2.5 px-4 min-w-[140px]">Aluno / Dupla</th>
                        <th className="py-2.5 px-4 min-w-[280px]">Status</th>
                        <th className="py-2.5 px-4 min-w-[200px]">Observacao</th>
                        <th className="py-2.5 px-4 w-12 text-center">Acao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grupo.itens.map((item) => {
                        const obsVal = validarObservacao(item.observacao);
                        const tamanhoObs = (item.observacao || '').length;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/60 transition-colors"
                          >
                            {/* Horario */}
                            <td className="py-3 px-4 font-mono font-medium text-slate-700">
                              {formatarHorarioControle(item.horario)}
                            </td>

                            {/* Paciente */}
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {item.paciente}
                            </td>

                            {/* Badge Origem */}
                            <td className="py-3 px-4">
                              {item.origem === 'mensal' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  Mensal
                                </span>
                              )}
                              {item.origem === 'fixa' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  So na Fixa
                                </span>
                              )}
                              {item.origem === 'avulso' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Avulso
                                </span>
                              )}
                            </td>

                            {/* Aluno / Dupla */}
                            <td className="py-3 px-4 text-slate-600">
                              {item.aluno_nome || '-'}
                            </td>

                            {/* 4 Botoes de Status */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Atendido */}
                                <button
                                  type="button"
                                  onClick={() => handleAlternarStatus(item.id, 'atendido')}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    item.status === 'atendido'
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                                  }`}
                                  title="Marcar como Atendido (clique novamente para desmarcar)"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Atendido</span>
                                </button>

                                {/* Faltou */}
                                <button
                                  type="button"
                                  onClick={() => handleAlternarStatus(item.id, 'faltou')}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    item.status === 'faltou'
                                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                  }`}
                                  title="Marcar como Faltou (clique novamente para desmarcar)"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Faltou</span>
                                </button>

                                {/* Desmarcou */}
                                <button
                                  type="button"
                                  onClick={() => handleAlternarStatus(item.id, 'desmarcou')}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    item.status === 'desmarcou'
                                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                                  }`}
                                  title="Marcar como Desmarcou (clique novamente para desmarcar)"
                                >
                                  <CalendarX className="w-3 h-3" />
                                  <span>Desmarcou</span>
                                </button>

                                {/* Nao Marcou */}
                                <button
                                  type="button"
                                  onClick={() => handleAlternarStatus(item.id, 'nao_marcou')}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    item.status === 'nao_marcou'
                                      ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300'
                                  }`}
                                  title="Marcar como Nao marcou (clique novamente para desmarcar)"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Nao marcou</span>
                                </button>
                              </div>
                            </td>

                            {/* Campo Observacao (ate 500 caracteres) */}
                            <td className="py-3 px-4">
                              <div className="relative">
                                <input
                                  type="text"
                                  maxLength={500}
                                  value={item.observacao || ''}
                                  onChange={(e) => handleEditarObservacao(item.id, e.target.value)}
                                  placeholder="Observacao (ex: suspendeu...)"
                                  className={`w-full px-2.5 py-1 text-xs bg-white border rounded-md focus:outline-none focus:ring-1 ${
                                    !obsVal.valida
                                      ? 'border-red-400 focus:ring-red-500'
                                      : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/20'
                                  }`}
                                />
                                {tamanhoObs > 400 && (
                                  <span
                                    className={`text-[10px] block mt-0.5 ${
                                      tamanhoObs > 500 ? 'text-red-600 font-bold' : 'text-slate-400'
                                    }`}
                                  >
                                    {tamanhoObs}/500
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Acao (apenas para Avulso) */}
                            <td className="py-3 px-4 text-center">
                              {podeRemoverItem(item) ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoverItem(item.id)}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Remover paciente avulso"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span
                                  className="text-slate-300 text-xs select-none"
                                  title="Linhas importadas da Mensal ou Fixa nao podem ser removidas"
                                >
                                  -
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
            ))}
          </div>
        )}

        {/* Modal: Adicionar Paciente Avulso */}
        {modalAdicionarAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Adicionar Paciente ({rotuloDia(diaParaAdicionar)})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setModalAdicionarAberto(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmarAdicionar} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Paciente *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoPaciente}
                    onChange={(e) => setNovoPaciente(e.target.value)}
                    placeholder="Nome completo do paciente"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Horario *
                    </label>
                    <input
                      type="time"
                      required
                      value={novoHorario}
                      onChange={(e) => setNovoHorario(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dia da Semana
                    </label>
                    <input
                      type="text"
                      disabled
                      value={rotuloDia(diaParaAdicionar) || ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aluno ou Dupla Responsavel (opcional)
                  </label>
                  <select
                    value={novoAluno}
                    onChange={(e) => setNovoAluno(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">Selecione um aluno/dupla...</option>
                    {alunosTurma.map((a) => (
                      <option key={a.id} value={a.nome}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAdicionarAberto(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
