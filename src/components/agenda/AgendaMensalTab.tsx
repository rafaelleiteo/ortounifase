import React, { useState, useMemo } from 'react';
import {
  AgendaAluno,
  AgendaMensalItem,
  InconsistenciaItem,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  DIAS_SEMANA,
  TurnoAgenda,
  OPCOES_TURNO,
  HORARIO_DIVISOR_TURNO,
  getHorariosPorTurno,
  normalizarHorario,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA,
  DiaSemana
} from '@/lib/agendaTypes';
import { AgendaFiltrosHeader } from './AgendaFiltrosHeader';
import {
  Calendar,
  User,
  Clock,
  UploadCloud,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  UserPlus,
  HelpCircle
} from 'lucide-react';

interface AgendaMensalTabProps {
  turmaNome: string;
  alunos: AgendaAluno[];
  agendaMensal: AgendaMensalItem[];
  inconsistencias: InconsistenciaItem[];
  mesReferencia: string;
  onMesReferenciaChange: (mes: string) => void;
  diaSelecionado?: string;
  onDiaSelecionadoChange?: (dia: string) => void;
  periodo?: TurnoAgenda;
  onPeriodoChange?: (periodo: TurnoAgenda) => void;
  onAbrirImportModal: () => void;
}

export const AgendaMensalTab: React.FC<AgendaMensalTabProps> = ({
  turmaNome,
  alunos,
  agendaMensal,
  inconsistencias,
  mesReferencia,
  onMesReferenciaChange,
  diaSelecionado: diaProp,
  onDiaSelecionadoChange,
  periodo: periodoProp,
  onPeriodoChange,
  onAbrirImportModal
}) => {
  const [diaLocal, setDiaLocal] = useState<string>('QUINTA');
  const diaSelecionadoRaw = diaProp !== undefined ? diaProp : diaLocal;
  const diaSelecionado = (diaSelecionadoRaw && diaSelecionadoRaw !== 'TODOS') ? diaSelecionadoRaw : 'QUINTA';
  const handleDiaChange = onDiaSelecionadoChange || setDiaLocal;

  const [periodoLocal, setPeriodoLocal] = useState<TurnoAgenda>('TODOS');
  const periodo = periodoProp !== undefined ? periodoProp : periodoLocal;
  const handlePeriodoChange = onPeriodoChange || setPeriodoLocal;

  // Coluna "Atendimento Extra" deve sempre aparecer por último (à direita de todas as colunas de alunos reais).
  // Alunos inativos só aparecem se já possuírem atendimentos lançados na agenda mensal do mês.
  const temAtendimentoExtra = useMemo(() => {
    return agendaMensal.some((item) => !item.aluno_id || isAtendimentoExtra(item.aluno));
  }, [agendaMensal]);

  const extraAlunoCadastrado = useMemo(() => {
    return alunos.find((a) => isAtendimentoExtra(a.nome));
  }, [alunos]);

  const extraColumnId = extraAlunoCadastrado ? extraAlunoCadastrado.id : 'EXTRA_VIRTUAL';

  const alunosOrdenados = useMemo(() => {
    const visiveis = alunos.filter((a) => {
      if (a.ativo === false) {
        return agendaMensal.some((item) => item.aluno_id === a.id);
      }
      return true;
    });
    const normais = visiveis.filter((a) => !isAtendimentoExtra(a.nome));
    const extras = visiveis.filter((a) => isAtendimentoExtra(a.nome));

    const colunas = [...normais, ...extras];
    // Se houver atendimentos sem aluno_id (Atendimento Extra) e nenhum aluno "Atendimento Extra" na tabela de alunos,
    // adicionamos uma coluna virtual "Atendimento Extra" com id 'EXTRA_VIRTUAL'
    if (temAtendimentoExtra && extras.length === 0) {
      colunas.push({
        id: 'EXTRA_VIRTUAL',
        nome: NOME_ATENDIMENTO_EXTRA,
        turma_id: turmaNome,
        ativo: true
      });
    }
    return colunas;
  }, [alunos, agendaMensal, temAtendimentoExtra, turmaNome]);

  const horarios = getHorariosPorTurno(periodo);

  // Mapas por chave: `${alunoId}_${horario}` => lista de itens (suporta múltiplos extras no mesmo horário)
  const mensalMap = new Map<string, AgendaMensalItem[]>();
  agendaMensal
    .filter((item) => (item.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase())
    .forEach((item) => {
      const hNorm = normalizarHorario(item.horario);
      const isItemExtra = !item.aluno_id || isAtendimentoExtra(item.aluno);
      const chaveAluno = isItemExtra ? extraColumnId : (item.aluno_id || extraColumnId);
      const key = `${chaveAluno}_${hNorm}`;
      const existing = mensalMap.get(key) || [];
      existing.push(item);
      mensalMap.set(key, existing);
    });

  // Mapeia inconsistências do dia selecionado
  // Guarda por horário para cruzamento
  const incPorHorario = inconsistencias.filter(
    (inc) => (inc.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase()
  );

  // Função para determinar o status/cor da inconsistência em um card
  const getInconsistenciaInfo = (pacienteNome: string, horario: string, alunoNome?: string) => {
    const hNorm = normalizarHorario(horario);
    const match = incPorHorario.find((inc) => {
      const matchName = inc.paciente.toLowerCase() === pacienteNome.toLowerCase();
      if (inc.tipo === 'HORARIO_ALTERADO' && matchName) {
        return true;
      }
      return (
        normalizarHorario(inc.horario) === hNorm &&
        (matchName || (inc.aluno_mensal && alunoNome && inc.aluno_mensal.toLowerCase() === alunoNome.toLowerCase()))
      );
    });

    if (!match) return null;

    const tNorm = (match.tipo || '').toUpperCase().trim();
    if (tNorm === 'AUSENTE') {
      return {
        tipo: 'AUSENTE',
        corBorder: 'border-rose-400 bg-rose-50/70 text-rose-900',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        label: 'Ausente na Fixa',
        detalhe: match.observacao || 'Paciente não compareceu no horário habitual da agenda fixa'
      };
    }
    if (tNorm === 'ALUNO_TROCADO') {
      return {
        tipo: 'ALUNO_TROCADO',
        corBorder: 'border-amber-400 bg-amber-50/70 text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        label: 'Aluno Trocado',
        detalhe: `Fixa: ${match.aluno_fixa || 'Outro'} ➔ Mensal: ${match.aluno_mensal || 'Outro'}`
      };
    }
    if (tNorm === 'PACIENTE_NOVO') {
      return {
        tipo: 'PACIENTE_NOVO',
        corBorder: 'border-emerald-400 bg-emerald-50/70 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        label: 'Paciente Novo',
        detalhe: 'Não cadastrado neste dia na agenda fixa'
      };
    }
    if (tNorm === 'HORARIO_ALTERADO') {
      return {
        tipo: 'HORARIO_ALTERADO',
        corBorder: 'border-blue-400 bg-blue-50/70 text-blue-900',
        badge: 'bg-blue-100 text-blue-800 border-blue-300',
        label: 'Horário Alterado',
        detalhe: match.observacao ? `Horário alterado: ${match.observacao}` : 'Horário alterado em relação à agenda fixa'
      };
    }
    return {
      tipo: match.tipo,
      corBorder: 'border-slate-300 bg-slate-50 text-slate-800',
      badge: 'bg-slate-100 text-slate-800 border-slate-300',
      label: match.tipo || 'Inconsistência',
      detalhe: match.observacao || 'Inconsistência identificada'
    };
  };

  // Também verificar se há pacientes AUSENTES na fixa para esse dia/horário que não estão em nenhuma célula do mensal
  const ausentesDoDia = incPorHorario.filter((inc) => inc.tipo === 'AUSENTE');

  return (
    <div className="space-y-5">
      {/* Barra Superior de Controles: Dias e Períodos */}
      <AgendaFiltrosHeader
        diaSelecionado={diaSelecionado as DiaSemana}
        onDiaChange={handleDiaChange}
        periodo={periodo}
        onPeriodoChange={handlePeriodoChange}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          {/* Seletor de Mês e Botão Importar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mês Ref:</span>
              <input
                type="month"
                value={mesReferencia.substring(0, 7)}
                onChange={(e) => onMesReferenciaChange(`${e.target.value}-01`)}
                className="text-xs font-bold text-slate-800 px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-slate-50"
              />
            </div>

            <button
              type="button"
              onClick={onAbrirImportModal}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-all flex items-center gap-2 hover:shadow-md"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Importar e Comparar
            </button>
          </div>

          {/* Legenda de Cores de Inconsistência */}
          <div className="flex items-center gap-3 text-[11px] font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-bold">Legenda:</span>
            <div className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              Ausente
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Aluno Trocado
            </div>
            <div className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Horário Alterado
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Paciente Novo
            </div>
          </div>
        </div>
      </AgendaFiltrosHeader>

      {/* Painel de Ausentes identificados para o Dia Selecionado */}
      {ausentesDoDia.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-rose-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Pacientes Ausentes da Agenda Fixa neste dia ({ausentesDoDia.length}):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ausentesDoDia.map((ausente) => (
              <span
                key={ausente.id}
                className="text-xs px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-900 font-medium shadow-2xs flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <strong>{ausente.paciente}</strong> (Horário: {ausente.horario} | Aluno Habitual: {ausente.aluno_fixa || 'N/A'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid / Tabela Kanban da Agenda Mensal */}
      {alunosOrdenados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhum dado importado para {turmaNome}</h4>
          <p className="text-xs text-slate-500 mt-1">Clique no botão "Importar e Comparar" para colar o JSON da agenda mensal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[750px] relative">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="p-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-24 bg-slate-50 border-r border-slate-200 sticky left-0 z-20">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Horário
                    </div>
                  </th>
                  {alunosOrdenados.map((aluno) => {
                    const isExtra = isAtendimentoExtra(aluno.nome) || aluno.id === 'EXTRA_VIRTUAL';
                    return (
                      <th
                        key={aluno.id}
                        className={`p-3 text-xs font-bold border-r min-w-[210px] transition-colors ${
                          isExtra
                            ? 'bg-amber-50/80 border-amber-300 border-dashed border-r-2 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            {isExtra ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            )}
                            <span
                              className={`truncate ${isExtra ? 'font-extrabold text-amber-900' : ''}`}
                              title={aluno.nome}
                            >
                              {aluno.nome}
                            </span>
                          </div>
                          {isExtra && (
                            <span
                              title="Coluna de atendimento extra / aguardando revisão de aluno"
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-semibold shrink-0"
                            >
                              Revisão
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {horarios.map((h) => {
                  const isTurnoDivisor = h === HORARIO_DIVISOR_TURNO && periodo === 'TODOS';
                  return (
                    <React.Fragment key={h}>
                      {isTurnoDivisor && (
                        <tr className="bg-slate-100/80 font-bold text-slate-500 text-[11px]">
                          <td colSpan={alunosOrdenados.length + 1} className="py-1 px-3 border-y border-slate-200">
                            --- Turno da Tarde (Intervalos de 15 min) ---
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono">
                          {h}
                        </td>
                        {alunosOrdenados.map((aluno) => {
                          const isExtra = isAtendimentoExtra(aluno.nome) || aluno.id === 'EXTRA_VIRTUAL';
                          const hNorm = normalizarHorario(h);
                          const items = mensalMap.get(`${aluno.id}_${hNorm}`) || [];

                          return (
                            <td
                              key={aluno.id}
                              className={`p-2 border-r align-top relative transition-colors ${
                                isExtra
                                  ? 'bg-amber-50/15 border-dashed border-amber-200/80 border-r-2'
                                  : 'border-slate-100'
                              }`}
                            >
                              {items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {items.map((item) => {
                                    const incInfo = getInconsistenciaInfo(item.paciente, h, aluno.nome);
                                    return (
                                      <div
                                        key={item.id}
                                        className={`p-2 rounded-xl border shadow-2xs transition-all ${
                                          incInfo
                                            ? incInfo.corBorder
                                            : isExtra
                                            ? 'bg-amber-50/80 border-amber-300 text-slate-900'
                                            : 'bg-white border-slate-200 text-slate-800'
                                        }`}
                                      >
                                        <div className="font-semibold break-words mb-1 flex items-start justify-between gap-1">
                                          <span>{item.paciente}</span>
                                          {isExtra && !incInfo && (
                                            <span
                                              title="Atendimento Extra"
                                              className="shrink-0 text-[10px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold"
                                            >
                                              Extra
                                            </span>
                                          )}
                                        </div>

                                        {incInfo ? (
                                          <div className="space-y-1">
                                            <span
                                              className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${incInfo.badge}`}
                                            >
                                              {incInfo.label}
                                            </span>
                                            <div className="text-[10px] opacity-85 leading-tight">
                                              {incInfo.detalhe}
                                            </div>
                                          </div>
                                        ) : isExtra ? (
                                          <span className="text-[10px] font-medium text-amber-700/80">
                                            Revisar alocação
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-slate-400">
                                            Conforme agenda fixa
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div
                                  className={`h-11 rounded-xl flex items-center justify-center text-[10px] ${
                                    isExtra
                                      ? 'bg-amber-50/30 border border-dashed border-amber-200/60 text-amber-300'
                                      : 'bg-slate-50/40 border border-slate-100 text-slate-300'
                                  }`}
                                >
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
