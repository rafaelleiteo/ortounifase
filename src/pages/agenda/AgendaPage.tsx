import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Turma,
  AgendaAluno,
  AgendaFixaItem,
  AgendaMensalItem,
  InconsistenciaItem,
  TurnoAgenda,
  normalizarHorario
} from '@/lib/agendaTypes';
import { recalcularInconsistenciasComPreservacao } from '@/lib/agendaService';
import { AgendaFixaTab } from '@/components/agenda/AgendaFixaTab';
import { AgendaMensalTab } from '@/components/agenda/AgendaMensalTab';
import { InconsistenciasTab } from '@/components/agenda/InconsistenciasTab';
import { ImportModal } from '@/components/agenda/ImportModal';
import { GerenciarAlunosModal } from '@/components/agenda/GerenciarAlunosModal';
import {
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertOctagon,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Users
} from 'lucide-react';

export const AgendaPage: React.FC = () => {
  const { effectiveRole } = useAuth();

  // Estados principais
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'fixa' | 'mensal' | 'inconsistencias'>('fixa');

  // Navegação compartilhada entre abas (dia da semana e turno persistidos dentro da mesma turma)
  const [diaSelecionado, setDiaSelecionado] = useState<string>('QUINTA');
  const [periodo, setPeriodo] = useState<TurnoAgenda>('TODOS');

  // Mês de referência atual (default: primeiro dia do mês atual em formato YYYY-MM-01)
  const [mesReferencia, setMesReferencia] = useState<string>(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}-01`;
  });

  // Dados da turma selecionada
  const [alunos, setAlunos] = useState<AgendaAluno[]>([]);
  const [agendaFixa, setAgendaFixa] = useState<AgendaFixaItem[]>([]);
  const [agendaMensal, setAgendaMensal] = useState<AgendaMensalItem[]>([]);
  const [inconsistencias, setInconsistencias] = useState<InconsistenciaItem[]>([]);

  // Estados de feedback / carregamento
  const [loading, setLoading] = useState<boolean>(true);
  const [carregandoDados, setCarregandoDados] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Modal de Importação e Gerenciar Alunos
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isGerenciarAlunosOpen, setIsGerenciarAlunosOpen] = useState<boolean>(false);

  // 1. Carregar Turmas
  const carregarTurmas = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: errTurmas } = await supabase
        .from('turmas')
        .select('*')
        .order('nome');

      if (errTurmas) throw errTurmas;

      if (data && data.length > 0) {
        setTurmas(data);
        if (!turmaSelecionada) {
          // Prefere 'ESP1' como padrão, se existir
          const defaultTurma = data.find((t) => t.nome === 'ESP1') || data[0];
          setTurmaSelecionada(defaultTurma);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar turmas:', err);
      setError('Falha ao consultar turmas: ' + (err.message || 'Erro inesperado'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTurmas();
  }, []);

  // 2. Carregar dados da turma selecionada
  const carregarDadosTurma = async () => {
    if (!turmaSelecionada) return;

    try {
      setCarregandoDados(true);
      setError(null);

      // 2.1 Alunos
      const { data: alunosData, error: errAlunos } = await supabase
        .from('agenda_alunos')
        .select('*')
        .eq('turma_id', turmaSelecionada.id)
        .order('nome');

      if (errAlunos) throw errAlunos;
      setAlunos(alunosData || []);

      // 2.2 Agenda Fixa
      const { data: fixaData, error: errFixa } = await supabase
        .from('agenda_fixa')
        .select('*, agenda_alunos(id, nome)')
        .eq('turma_id', turmaSelecionada.id);

      if (errFixa) throw errFixa;
      setAgendaFixa(fixaData || []);

      // 2.3 Agenda Mensal
      const { data: mensalData, error: errMensal } = await supabase
        .from('agenda_mensal')
        .select('*, agenda_alunos(id, nome)')
        .eq('turma_id', turmaSelecionada.id)
        .eq('mes_referencia', mesReferencia);

      if (errMensal) throw errMensal;
      setAgendaMensal(mensalData || []);

      // 2.4 Inconsistências
      const { data: incData, error: errInc } = await supabase
        .from('inconsistencias')
        .select('*')
        .eq('turma_id', turmaSelecionada.id)
        .eq('mes_referencia', mesReferencia)
        .order('created_at', { ascending: false });

      if (errInc) throw errInc;
      setInconsistencias(incData || []);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes da agenda:', err);
      setError(err.message || 'Erro ao carregar dados da agenda');
    } finally {
      setCarregandoDados(false);
    }
  };

  useEffect(() => {
    if (turmaSelecionada) {
      carregarDadosTurma();
    }
  }, [turmaSelecionada?.id, mesReferencia]);

  // Ações da Agenda Fixa
  const handleSalvarItemFixa = async (item: Partial<AgendaFixaItem>) => {
    try {
      if (item.id) {
        const updatePayload: Record<string, any> = {
          paciente: item.paciente,
          aluno_id: item.aluno_id,
          horario: item.horario,
          dia_semana: item.dia_semana,
          ...(item.tipo_registro ? { tipo_registro: item.tipo_registro } : {}),
          ...(item.tipo_bloqueio ? { tipo_bloqueio: item.tipo_bloqueio } : {}),
          updated_at: new Date().toISOString()
        };
        let { error: errUpdate } = await supabase
          .from('agenda_fixa')
          .update(updatePayload)
          .eq('id', item.id);

        if (errUpdate && errUpdate.message?.includes('tipo_bloqueio')) {
          delete updatePayload.tipo_bloqueio;
          const retry = await supabase.from('agenda_fixa').update(updatePayload).eq('id', item.id);
          errUpdate = retry.error;
        }

        if (errUpdate) throw errUpdate;
      } else {
        const insertPayload: Record<string, any> = {
          turma_id: item.turma_id,
          aluno_id: item.aluno_id,
          paciente: item.paciente,
          horario: item.horario,
          dia_semana: item.dia_semana,
          tipo_registro: item.tipo_registro || 'paciente',
          ...(item.tipo_bloqueio ? { tipo_bloqueio: item.tipo_bloqueio } : {})
        };
        let { error: errInsert } = await supabase
          .from('agenda_fixa')
          .insert(insertPayload);

        if (errInsert && errInsert.message?.includes('tipo_bloqueio')) {
          delete insertPayload.tipo_bloqueio;
          const retry = await supabase.from('agenda_fixa').insert(insertPayload);
          errInsert = retry.error;
        }

        if (errInsert) throw errInsert;
      }
      await carregarDadosTurma();
    } catch (err: any) {
      alert('Erro ao salvar item na agenda fixa: ' + err.message);
    }
  };

  const handleRemoverItemFixa = async (id: string) => {
    if (!confirm('Deseja realmente remover este paciente da agenda fixa?')) return;
    try {
      const { error: errDel } = await supabase
        .from('agenda_fixa')
        .delete()
        .eq('id', id);
      if (errDel) throw errDel;
      await carregarDadosTurma();
    } catch (err: any) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  // Ações da Agenda Mensal
  const handleSalvarItemMensal = async (dados: {
    id?: string;
    paciente?: string;
    aluno_id?: string | null;
    horario?: string;
    dia_semana?: string;
  }) => {
    if (!turmaSelecionada) return;
    try {
      setCarregandoDados(true);

      const alunoObj = dados.aluno_id ? alunos.find((a) => a.id === dados.aluno_id) : null;
      const nomeAluno = alunoObj ? alunoObj.nome : 'ATENDIMENTO EXTRA';

      if (dados.id) {
        const updatePayload: any = {};
        if (dados.paciente !== undefined) updatePayload.paciente = dados.paciente.trim();
        if (dados.horario !== undefined) updatePayload.horario = normalizarHorario(dados.horario);
        if (dados.dia_semana !== undefined) updatePayload.dia_semana = dados.dia_semana;

        if (dados.aluno_id !== undefined) {
          updatePayload.aluno_id = dados.aluno_id;
          updatePayload.aluno = nomeAluno;
        }

        const { error: errUpdate } = await supabase
          .from('agenda_mensal')
          .update(updatePayload)
          .eq('id', dados.id);
        if (errUpdate) throw errUpdate;
      } else {
        if (!dados.paciente || !dados.horario || !dados.dia_semana) {
          throw new Error('Paciente, horário e dia da semana são obrigatórios');
        }
        const insertPayload: any = {
          turma_id: turmaSelecionada.id,
          mes_referencia: mesReferencia,
          paciente: dados.paciente.trim(),
          horario: normalizarHorario(dados.horario),
          dia_semana: dados.dia_semana,
          aluno_id: dados.aluno_id || null,
          aluno: nomeAluno
        };
        const { error: errInsert } = await supabase
          .from('agenda_mensal')
          .insert(insertPayload);
        if (errInsert) throw errInsert;
      }

      // Recalcula inconsistências preservando status revisados
      try {
        await recalcularInconsistenciasComPreservacao(
          turmaSelecionada.id,
          mesReferencia
        );
      } catch (errCompare: any) {
        console.warn('Aviso ao recalcular comparação:', errCompare);
      }

      await carregarDadosTurma();
    } catch (err: any) {
      console.error('Erro ao salvar item na agenda mensal:', err);
      alert('Erro ao atualizar atendimento na agenda mensal: ' + err.message);
    } finally {
      setCarregandoDados(false);
    }
  };

  const handleRemoverItemMensal = async (id: string, pacienteNome?: string) => {
    if (!turmaSelecionada) return;
    const confirmMsg = pacienteNome
      ? `Deseja realmente remover o atendimento do paciente "${pacienteNome}" da Agenda Mensal? Esta ação alterará os dados importados do mês.`
      : 'Deseja realmente remover este atendimento da Agenda Mensal?';

    if (!confirm(confirmMsg)) return;

    try {
      setCarregandoDados(true);
      const { error: errDel } = await supabase
        .from('agenda_mensal')
        .delete()
        .eq('id', id);

      if (errDel) throw errDel;

      // Recalcula inconsistências preservando status revisados
      try {
        await recalcularInconsistenciasComPreservacao(
          turmaSelecionada.id,
          mesReferencia
        );
      } catch (errCompare: any) {
        console.warn('Aviso ao recalcular comparação:', errCompare);
      }

      await carregarDadosTurma();
    } catch (err: any) {
      console.error('Erro ao remover item da agenda mensal:', err);
      alert('Erro ao remover atendimento da agenda mensal: ' + err.message);
    } finally {
      setCarregandoDados(false);
    }
  };

  const handleCriarAluno = async (nome: string) => {
    if (!turmaSelecionada) return;
    try {
      const { error: errAdd } = await supabase
        .from('agenda_alunos')
        .insert({
          nome,
          turma_id: turmaSelecionada.id,
          ativo: true
        });
      if (errAdd) throw errAdd;
      await carregarDadosTurma();
    } catch (err: any) {
      alert('Erro ao cadastrar aluno: ' + err.message);
    }
  };

  // Ações de Inconsistência
  const handleAtualizarStatusInconsistencia = async (
    id: string,
    novoStatus: InconsistenciaItem['status'],
    observacao?: string
  ) => {
    try {
      const { error: errUpdate } = await supabase
        .from('inconsistencias')
        .update({
          status: novoStatus,
          observacao: observacao,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (errUpdate) throw errUpdate;

      // Atualiza localmente sem recarregar tudo
      setInconsistencias((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: novoStatus, observacao } : i))
      );
    } catch (err: any) {
      alert('Erro ao atualizar status da inconsistência: ' + err.message);
    }
  };

  const handleImportSucesso = (result: any) => {
    setMensagemSucesso(
      `Importação concluída com sucesso! ${result.totalImportados} registros processados e comparação gerada (${result.compareResult?.total || 0} inconsistências identificadas).`
    );
    if (result?.mesReferencia && result.mesReferencia !== mesReferencia) {
      setMesReferencia(result.mesReferencia);
    } else {
      carregarDadosTurma();
    }
    setTimeout(() => setMensagemSucesso(null), 8000);
  };

  // Verificação de Acesso: Apenas Coordenador e Admin Master
  const isAuthorized = effectiveRole === 'coordenador' || effectiveRole === 'admin_master';

  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Acesso Restrito</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              O módulo de Agenda da Especialização é restrito exclusivamente aos papéis de Coordenação e Administração Geral.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header Compacto da Página */}
        <div className="bg-white border-b border-slate-200/80 -mx-6 -mt-6 px-6 py-3 sm:px-8 sm:py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-2xs shrink-0">
                <Calendar className="w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                  Agenda da Especialização
                </h1>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Gestão clínica por turma, controle fixo vs. mensal e conciliação de inconsistências
                </p>
              </div>
            </div>

            {/* Seletor de Turma Compacto e Ação Gerenciar Alunos */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                <span className="text-[11px] font-bold text-slate-500 px-1.5 uppercase tracking-wider">
                  Turma:
                </span>
                {turmas.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (turmaSelecionada?.id !== t.id) {
                        setTurmaSelecionada(t);
                        setDiaSelecionado('QUINTA');
                        setPeriodo('TODOS');
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      turmaSelecionada?.id === t.id
                        ? 'bg-white text-brand-600 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.nome}
                  </button>
                ))}
              </div>

              {/* Botão Gerenciar Alunos (Coordenador / Admin) */}
              {isAuthorized && turmaSelecionada && (
                <button
                  type="button"
                  id="btn-gerenciar-alunos"
                  onClick={() => setIsGerenciarAlunosOpen(true)}
                  title="Gerenciar Alunos desta turma (editar nomes, mesclar duplicatas e desativar alunos)"
                  className="px-2.5 py-1.5 bg-slate-100/90 hover:bg-white text-slate-700 hover:text-brand-600 border border-slate-200/70 hover:border-brand-200 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Alunos</span>
                </button>
              )}
            </div>
          </div>

          {/* Abas de Navegação Compactas */}
          <div className="flex items-center gap-1.5 mt-2.5 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setAbaAtiva('fixa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                abaAtiva === 'fixa'
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Agenda Fixa
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('mensal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                abaAtiva === 'mensal'
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Agenda Mensal
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('inconsistencias')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                abaAtiva === 'inconsistencias'
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Relatório de Inconsistências
              {inconsistencias.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  {inconsistencias.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={carregarDadosTurma}
              title="Recarregar dados"
              className="ml-auto p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregandoDados ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {mensagemSucesso && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 flex items-center justify-between shadow-xs">
            <span>{mensagemSucesso}</span>
            <button
              onClick={() => setMensagemSucesso(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo Dinâmico das Abas */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
            <span className="text-xs font-semibold text-slate-500">Carregando dados da Agenda...</span>
          </div>
        ) : !turmaSelecionada ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
            Nenhuma turma disponível.
          </div>
        ) : (
          <div>
            {abaAtiva === 'fixa' && (
              <AgendaFixaTab
                turmaId={turmaSelecionada.id}
                turmaNome={turmaSelecionada.nome}
                alunos={alunos}
                agendaFixa={agendaFixa}
                diaSelecionado={diaSelecionado}
                onDiaSelecionadoChange={setDiaSelecionado}
                periodo={periodo}
                onPeriodoChange={setPeriodo}
                onSalvarItem={handleSalvarItemFixa}
                onRemoverItem={handleRemoverItemFixa}
                onCriarAluno={handleCriarAluno}
                isCoordenadorOrAdmin={isAuthorized}
              />
            )}

            {abaAtiva === 'mensal' && (
              <AgendaMensalTab
                turmaNome={turmaSelecionada.nome}
                alunos={alunos}
                agendaMensal={agendaMensal}
                inconsistencias={inconsistencias}
                mesReferencia={mesReferencia}
                onMesReferenciaChange={setMesReferencia}
                diaSelecionado={diaSelecionado}
                onDiaSelecionadoChange={setDiaSelecionado}
                periodo={periodo}
                onPeriodoChange={setPeriodo}
                onAbrirImportModal={() => setIsImportModalOpen(true)}
                onSalvarItem={handleSalvarItemMensal}
                onRemoverItem={handleRemoverItemMensal}
                isCoordenadorOrAdmin={isAuthorized}
              />
            )}

            {abaAtiva === 'inconsistencias' && (
              <InconsistenciasTab
                inconsistencias={inconsistencias}
                alunos={alunos}
                mesReferencia={mesReferencia}
                diaSelecionado={diaSelecionado}
                onDiaSelecionadoChange={setDiaSelecionado}
                periodo={periodo}
                onPeriodoChange={setPeriodo}
                onAtualizarStatus={handleAtualizarStatusInconsistencia}
              />
            )}
          </div>
        )}

        {/* Modal de Importação de JSON */}
        {turmaSelecionada && (
          <ImportModal
            turmaNome={turmaSelecionada.nome}
            defaultMesReferencia={mesReferencia}
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={handleImportSucesso}
          />
        )}

        {/* Modal de Gerenciamento de Alunos */}
        {turmaSelecionada && (
          <GerenciarAlunosModal
            isOpen={isGerenciarAlunosOpen}
            onClose={() => setIsGerenciarAlunosOpen(false)}
            turmaId={turmaSelecionada.id}
            turmaNome={turmaSelecionada.nome}
            alunos={alunos}
            agendaFixa={agendaFixa}
            agendaMensal={agendaMensal}
            onAtualizar={carregarDadosTurma}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
