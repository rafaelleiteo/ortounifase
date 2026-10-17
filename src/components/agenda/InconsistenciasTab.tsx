import React, { useState } from 'react';
import {
  InconsistenciaItem,
  AgendaAluno,
  DIAS_SEMANA,
  formatarHorarioExibicao
} from '@/lib/agendaTypes';
import {
  AlertTriangle,
  Clock,
  User,
  Filter,
  CheckCircle2,
  FileEdit,
  Eye,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface InconsistenciasTabProps {
  inconsistencias: InconsistenciaItem[];
  alunos: AgendaAluno[];
  mesReferencia: string;
  onAtualizarStatus: (id: string, novoStatus: InconsistenciaItem['status'], obs?: string) => Promise<void>;
}

const STATUS_COLUMNS: Array<{
  id: InconsistenciaItem['status'];
  label: string;
  badge: string;
  headerBg: string;
}> = [
  { id: 'PENDENTE', label: 'Pendente', badge: 'bg-rose-100 text-rose-800 border-rose-300', headerBg: 'bg-rose-50 border-rose-200' },
  { id: 'REVISADO', label: 'Revisado', badge: 'bg-amber-100 text-amber-800 border-amber-300', headerBg: 'bg-amber-50 border-amber-200' },
  { id: 'OK', label: 'OK / Aceito', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', headerBg: 'bg-emerald-50 border-emerald-200' },
  { id: 'EDITAR', label: 'Requer Edição', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300', headerBg: 'bg-indigo-50 border-indigo-200' }
];

export const InconsistenciasTab: React.FC<InconsistenciasTabProps> = ({
  inconsistencias,
  alunos,
  mesReferencia,
  onAtualizarStatus
}) => {
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroDia, setFiltroDia] = useState<string>('TODOS');
  const [filtroAluno, setFiltroAluno] = useState<string>('TODOS');
  const [observacoesLocais, setObservacoesLocais] = useState<Record<string, string>>({});

  const itensFiltrados = inconsistencias.filter((item) => {
    if (filtroTipo !== 'TODOS' && item.tipo !== filtroTipo) return false;
    if (filtroDia !== 'TODOS' && (item.dia_semana || '').toUpperCase() !== filtroDia.toUpperCase()) return false;
    if (filtroAluno !== 'TODOS') {
      const nomeAlunoFiltro = filtroAluno.toLowerCase();
      const matchFixa = item.aluno_fixa?.toLowerCase().includes(nomeAlunoFiltro);
      const matchMensal = item.aluno_mensal?.toLowerCase().includes(nomeAlunoFiltro);
      if (!matchFixa && !matchMensal) return false;
    }
    return true;
  });

  const getTipoBadge = (tipo: InconsistenciaItem['tipo']) => {
    switch (tipo) {
      case 'AUSENTE':
        return {
          label: 'Ausente',
          classes: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-500'
        };
      case 'ALUNO_TROCADO':
        return {
          label: 'Aluno Trocado',
          classes: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500'
        };
      case 'PACIENTE_NOVO':
        return {
          label: 'Paciente Novo',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500'
        };
      case 'HORARIO_ALTERADO':
        return {
          label: 'Horário Alterado',
          classes: 'bg-blue-100 text-blue-800 border-blue-300',
          dot: 'bg-blue-500'
        };
    }
  };

  const handleSalvarObservacao = (item: InconsistenciaItem) => {
    const texto = observacoesLocais[item.id] ?? item.observacao ?? '';
    onAtualizarStatus(item.id, item.status, texto);
  };

  return (
    <div className="space-y-5">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            Filtros:
          </div>

          {/* Filtro por Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-slate-50 font-medium"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="AUSENTE">Somente Ausentes</option>
            <option value="ALUNO_TROCADO">Somente Aluno Trocado</option>
            <option value="PACIENTE_NOVO">Somente Paciente Novo</option>
            <option value="HORARIO_ALTERADO">Somente Horário Alterado</option>
          </select>

          {/* Filtro por Dia */}
          <select
            value={filtroDia}
            onChange={(e) => setFiltroDia(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-slate-50 font-medium"
          >
            <option value="TODOS">Todos os Dias</option>
            {DIAS_SEMANA.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Filtro por Aluno */}
          <select
            value={filtroAluno}
            onChange={(e) => setFiltroAluno(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-slate-50 font-medium max-w-xs"
          >
            <option value="TODOS">Todos os Alunos</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.nome}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Total de Inconsistências: <strong className="text-slate-800">{itensFiltrados.length}</strong> de {inconsistencias.length}
        </div>
      </div>

      {/* Grid de 4 Colunas Kanban por Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {STATUS_COLUMNS.map((col) => {
          const itensDaColuna = itensFiltrados.filter(
            (i) => (i.status || 'PENDENTE').toUpperCase() === col.id
          );

          return (
            <div
              key={col.id}
              className="bg-slate-50/70 rounded-2xl border border-slate-200 flex flex-col min-h-[500px]"
            >
              {/* Header da Coluna */}
              <div
                className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between ${col.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{col.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
                  {itensDaColuna.length}
                </span>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
                {itensDaColuna.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Nenhum item {col.label.toLowerCase()}
                  </div>
                ) : (
                  itensDaColuna.map((item) => {
                    const badge = getTipoBadge(item.tipo);
                    const obsAtual =
                      observacoesLocais[item.id] !== undefined
                        ? observacoesLocais[item.id]
                        : item.observacao || '';

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-2.5 hover:shadow-xs transition-shadow"
                      >
                        {/* Tipo Badge & Horário */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.classes}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.dia_semana} {formatarHorarioExibicao(item.horario)}
                          </span>
                        </div>

                        {/* Nome do Paciente */}
                        <div>
                          <div className="text-xs font-bold text-slate-800 break-words">
                            {item.paciente}
                          </div>
                        </div>

                        {/* Detalhes de Alunos (Fixa vs Mensal) */}
                        <div className="bg-slate-50 p-2 rounded-lg text-[11px] space-y-1 text-slate-600 border border-slate-100">
                          {item.tipo === 'AUSENTE' && (
                            <div>
                              <strong>Aluno Habitual (Fixa):</strong> {item.aluno_fixa || 'Não informado'}
                            </div>
                          )}
                          {item.tipo === 'PACIENTE_NOVO' && (
                            <div>
                              <strong>Aluno (Mensal):</strong> {item.aluno_mensal || 'Não informado'}
                            </div>
                          )}
                          {item.tipo === 'ALUNO_TROCADO' && (
                            <>
                              <div>
                                <strong>Aluno na Fixa:</strong> {item.aluno_fixa || 'N/A'}
                              </div>
                              <div className="text-amber-700 font-medium">
                                ➔ <strong>Aluno no Mensal:</strong> {item.aluno_mensal || 'N/A'}
                              </div>
                            </>
                          )}
                          {item.tipo === 'HORARIO_ALTERADO' && (
                            <>
                              <div>
                                <strong>Mudança de Horário:</strong> {item.observacao || `${formatarHorarioExibicao(item.horario)} (Fixa)`}
                              </div>
                              <div>
                                <strong>Aluno Responsável:</strong> {item.aluno_fixa || item.aluno_mensal || 'Não informado'}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Campo de Observação Livre */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                            Observação:
                          </label>
                          <textarea
                            value={obsAtual}
                            onChange={(e) =>
                              setObservacoesLocais({
                                ...observacoesLocais,
                                [item.id]: e.target.value
                              })
                            }
                            onBlur={() => handleSalvarObservacao(item)}
                            placeholder="Adicionar nota..."
                            rows={2}
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white"
                          />
                        </div>

                        {/* Ações de Transição de Status */}
                        <div className="pt-2 border-t border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                            Mover para Status:
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            {STATUS_COLUMNS.filter((sc) => sc.id !== col.id).map((dest) => (
                              <button
                                key={dest.id}
                                type="button"
                                onClick={() =>
                                  onAtualizarStatus(
                                    item.id,
                                    dest.id,
                                    observacoesLocais[item.id] ?? item.observacao ?? ''
                                  )
                                }
                                className="text-[10px] font-semibold py-1 px-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors text-center"
                              >
                                ➔ {dest.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
