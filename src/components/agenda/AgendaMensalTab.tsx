import React, { useState } from 'react';
import {
  AgendaAluno,
  AgendaMensalItem,
  InconsistenciaItem,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  DIAS_SEMANA,
  normalizarHorario
} from '@/lib/agendaTypes';
import {
  Calendar,
  User,
  Clock,
  UploadCloud,
  AlertTriangle,
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
  onAbrirImportModal: () => void;
}

export const AgendaMensalTab: React.FC<AgendaMensalTabProps> = ({
  turmaNome,
  alunos,
  agendaMensal,
  inconsistencias,
  mesReferencia,
  onMesReferenciaChange,
  onAbrirImportModal
}) => {
  const [diaSelecionado, setDiaSelecionado] = useState<string>('QUINTA');
  const [periodo, setPeriodo] = useState<'MANHA' | 'TARDE' | 'TODOS'>('TODOS');

  const horarios =
    periodo === 'MANHA'
      ? HORARIOS_MANHA
      : periodo === 'TARDE'
      ? HORARIOS_TARDE
      : [...HORARIOS_MANHA, ...HORARIOS_TARDE];

  // Mapas por chave: `${alunoId}_${horario}`
  const mensalMap = new Map<string, AgendaMensalItem>();
  agendaMensal
    .filter((item) => (item.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase())
    .forEach((item) => {
      const hNorm = normalizarHorario(item.horario);
      mensalMap.set(`${item.aluno_id}_${hNorm}`, item);
    });

  // Mapeia inconsistências do dia selecionado
  // Guarda por horário para cruzamento
  const incPorHorario = inconsistencias.filter(
    (inc) => (inc.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase()
  );

  // Função para determinar o status/cor da inconsistência em um card
  const getInconsistenciaInfo = (pacienteNome: string, horario: string, alunoNome?: string) => {
    const hNorm = normalizarHorario(horario);
    const match = incPorHorario.find(
      (inc) =>
        normalizarHorario(inc.horario) === hNorm &&
        (inc.paciente.toLowerCase() === pacienteNome.toLowerCase() ||
         (inc.aluno_mensal && alunoNome && inc.aluno_mensal.toLowerCase() === alunoNome.toLowerCase()))
    );

    if (!match) return null;

    if (match.tipo === 'AUSENTE') {
      return {
        tipo: 'AUSENTE',
        corBorder: 'border-rose-400 bg-rose-50/70 text-rose-900',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        label: 'Ausente na Fixa',
        detalhe: match.observacao || 'Paciente não compareceu no horário habitual da agenda fixa'
      };
    }
    if (match.tipo === 'ALUNO_TROCADO') {
      return {
        tipo: 'ALUNO_TROCADO',
        corBorder: 'border-amber-400 bg-amber-50/70 text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        label: 'Aluno Trocado',
        detalhe: `Fixa: ${match.aluno_fixa || 'Outro'} ➔ Mensal: ${match.aluno_mensal || 'Outro'}`
      };
    }
    if (match.tipo === 'PACIENTE_NOVO') {
      return {
        tipo: 'PACIENTE_NOVO',
        corBorder: 'border-emerald-400 bg-emerald-50/70 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        label: 'Paciente Novo',
        detalhe: 'Não cadastrado neste horário na agenda fixa'
      };
    }
    return null;
  };

  // Também verificar se há pacientes AUSENTES na fixa para esse dia/horário que não estão em nenhuma célula do mensal
  const ausentesDoDia = incPorHorario.filter((inc) => inc.tipo === 'AUSENTE');

  return (
    <div className="space-y-5">
      {/* Barra de Controles: Seletor de Mês, Importar JSON, Dias e Turnos */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
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
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Paciente Novo
          </div>
        </div>

        {/* Seletor de Dia e Turno */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {DIAS_SEMANA.map((dia) => (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaSelecionado(dia)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  diaSelecionado === dia
                    ? 'bg-white text-brand-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dia}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['TODOS', 'MANHA', 'TARDE'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodo === p
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p === 'TODOS' ? 'Todos' : p === 'MANHA' ? 'Manhã' : 'Tarde'}
              </button>
            ))}
          </div>
        </div>
      </div>

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
      {alunos.length === 0 ? (
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
                  {alunos.map((aluno) => (
                    <th
                      key={aluno.id}
                      className="p-3 text-xs font-bold text-slate-800 border-r border-slate-200 min-w-[200px]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="truncate" title={aluno.nome}>{aluno.nome}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {horarios.map((h) => {
                  const isTurnoDivisor = h === '13:30' && periodo === 'TODOS';
                  return (
                    <React.Fragment key={h}>
                      {isTurnoDivisor && (
                        <tr className="bg-slate-100/80 font-bold text-slate-500 text-[11px]">
                          <td colSpan={alunos.length + 1} className="py-1 px-3 border-y border-slate-200">
                            --- Turno da Tarde (Intervalos de 15 min) ---
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono">
                          {h}
                        </td>
                        {alunos.map((aluno) => {
                          const hNorm = normalizarHorario(h);
                          const item = mensalMap.get(`${aluno.id}_${hNorm}`);
                          const incInfo = item ? getInconsistenciaInfo(item.paciente, h, aluno.nome) : null;

                          return (
                            <td
                              key={aluno.id}
                              className="p-2 border-r border-slate-100 align-top relative"
                            >
                              {item ? (
                                <div
                                  className={`p-2 rounded-xl border shadow-2xs transition-all ${
                                    incInfo
                                      ? incInfo.corBorder
                                      : 'bg-white border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <div className="font-semibold break-words mb-1">
                                    {item.paciente}
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
                                  ) : (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      Conforme agenda fixa
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="h-11 rounded-xl bg-slate-50/40 border border-slate-100 flex items-center justify-center text-[10px] text-slate-300">
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
