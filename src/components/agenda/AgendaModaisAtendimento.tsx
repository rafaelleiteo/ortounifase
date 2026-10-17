import React from 'react';
import {
  DIAS_SEMANA,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  formatarHorarioExibicao,
  DiaSemana
} from '@/lib/agendaTypes';
import { CalendarClock, ArrowRightLeft, Edit2, AlertTriangle } from 'lucide-react';
import { AgendaCardItem } from './AgendaCardAtendimento';

export interface ModalEditarState {
  isOpen: boolean;
  item?: AgendaCardItem;
  paciente: string;
  alunoId: string;
  horario: string;
  diaSemana: string;
}

export interface ModalReagendarState {
  isOpen: boolean;
  item?: AgendaCardItem;
  horario: string;
  diaSemana: string;
  alunoId: string;
  erro?: string;
}

export interface ModalTrocarAlunoState {
  isOpen: boolean;
  item?: AgendaCardItem;
  novoAlunoId: string;
}

export interface AgendaModaisAtendimentoProps {
  alunos: Array<{ id: string; nome: string }>;
  permitirSemAluno?: boolean; // Para Agenda Mensal (Atendimento Extra)
  // Estado e handlers do Modal Editar
  modalEditar: ModalEditarState;
  onFecharEditar: () => void;
  onSalvarEditar: (dados: {
    id: string;
    paciente: string;
    aluno_id: string | null;
    horario: string;
    dia_semana: string;
  }) => Promise<void> | void;
  onUpdateModalEditar: (dados: Partial<ModalEditarState>) => void;

  // Estado e handlers do Modal Reagendar
  modalReagendar: ModalReagendarState;
  onFecharReagendar: () => void;
  onSalvarReagendar: (dados: {
    id: string;
    horario: string;
    dia_semana: string;
  }) => Promise<void> | void;
  onUpdateModalReagendar: (dados: Partial<ModalReagendarState>) => void;

  // Estado e handlers do Modal Trocar Aluno
  modalTrocarAluno: ModalTrocarAlunoState;
  onFecharTrocarAluno: () => void;
  onSalvarTrocarAluno: (dados: {
    id: string;
    novoAlunoId: string | null;
  }) => Promise<void> | void;
  onUpdateModalTrocarAluno: (dados: Partial<ModalTrocarAlunoState>) => void;
}

export const AgendaModaisAtendimento: React.FC<AgendaModaisAtendimentoProps> = ({
  alunos,
  permitirSemAluno = false,
  modalEditar,
  onFecharEditar,
  onSalvarEditar,
  onUpdateModalEditar,
  modalReagendar,
  onFecharReagendar,
  onSalvarReagendar,
  onUpdateModalReagendar,
  modalTrocarAluno,
  onFecharTrocarAluno,
  onSalvarTrocarAluno,
  onUpdateModalTrocarAluno
}) => {
  const todosHorarios = [...HORARIOS_MANHA, ...HORARIOS_TARDE];

  return (
    <>
      {/* 1. Modal Editar Atendimento (Nome, Aluno, Horário, Dia) */}
      {modalEditar.isOpen && modalEditar.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Editar Atendimento</h4>
              </div>
              <button
                type="button"
                onClick={onFecharEditar}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Paciente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalEditar.paciente}
                  onChange={(e) => onUpdateModalEditar({ paciente: e.target.value })}
                  placeholder="Nome do paciente..."
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && modalEditar.paciente.trim()) {
                      onSalvarEditar({
                        id: modalEditar.item!.id,
                        paciente: modalEditar.paciente.trim(),
                        aluno_id: modalEditar.alunoId ? modalEditar.alunoId : null,
                        horario: modalEditar.horario,
                        dia_semana: modalEditar.diaSemana
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Aluno Responsável
                </label>
                <select
                  value={modalEditar.alunoId}
                  onChange={(e) => onUpdateModalEditar({ alunoId: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {permitirSemAluno && (
                    <option value="">Atendimento Extra (Sem aluno fixo)</option>
                  )}
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Dia da Semana
                  </label>
                  <select
                    value={modalEditar.diaSemana}
                    onChange={(e) => onUpdateModalEditar({ diaSemana: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {DIAS_SEMANA.map((dia) => (
                      <option key={dia} value={dia}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Horário
                  </label>
                  <select
                    value={modalEditar.horario}
                    onChange={(e) => onUpdateModalEditar({ horario: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                  >
                    {todosHorarios.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onFecharEditar}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!modalEditar.paciente.trim()}
                onClick={() =>
                  onSalvarEditar({
                    id: modalEditar.item!.id,
                    paciente: modalEditar.paciente.trim(),
                    aluno_id: modalEditar.alunoId ? modalEditar.alunoId : null,
                    horario: modalEditar.horario,
                    dia_semana: modalEditar.diaSemana
                  })
                }
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Reagendar / Alterar Horário */}
      {modalReagendar.isOpen && modalReagendar.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-reagendar-atendimento" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Reagendar Atendimento</h4>
              </div>
              <button
                type="button"
                onClick={onFecharReagendar}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1 border border-slate-100">
              <div><strong>Paciente:</strong> {modalReagendar.item.paciente}</div>
              <div className="text-slate-500 text-[11px]">
                <strong>Horário Atual:</strong> {modalReagendar.item.dia_semana} às {formatarHorarioExibicao(modalReagendar.item.horario)}
                {modalReagendar.item.aluno && ` — Aluno: ${modalReagendar.item.aluno}`}
              </div>
            </div>

            {modalReagendar.erro && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{modalReagendar.erro}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Dia da Semana
                </label>
                <select
                  value={modalReagendar.diaSemana}
                  onChange={(e) => onUpdateModalReagendar({ diaSemana: e.target.value, erro: undefined })}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia} value={dia}>
                      {dia}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Novo Horário
                </label>
                <select
                  value={modalReagendar.horario}
                  onChange={(e) => onUpdateModalReagendar({ horario: e.target.value, erro: undefined })}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                >
                  {todosHorarios.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onFecharReagendar}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  onSalvarReagendar({
                    id: modalReagendar.item!.id,
                    horario: modalReagendar.horario,
                    dia_semana: modalReagendar.diaSemana
                  })
                }
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
              >
                Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Trocar Aluno Responsável */}
      {modalTrocarAluno.isOpen && modalTrocarAluno.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-trocar-aluno" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Trocar Aluno Responsável</h4>
              </div>
              <button
                type="button"
                onClick={onFecharTrocarAluno}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1 border border-slate-100">
              <div><strong>Paciente:</strong> {modalTrocarAluno.item.paciente}</div>
              <div>
                <strong>Horário:</strong> {modalTrocarAluno.item.dia_semana} às {formatarHorarioExibicao(modalTrocarAluno.item.horario)}
              </div>
              <div>
                <strong>Aluno Atual:</strong>{' '}
                {modalTrocarAluno.item.aluno ||
                  alunos.find((a) => a.id === modalTrocarAluno.item?.aluno_id)?.nome ||
                  'Sem aluno atribuído'}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Selecione o Novo Aluno Responsável
              </label>
              <select
                value={modalTrocarAluno.novoAlunoId}
                onChange={(e) => onUpdateModalTrocarAluno({ novoAlunoId: e.target.value })}
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Selecione um aluno da turma...</option>
                {permitirSemAluno && (
                  <option value="EXTRA">Atendimento Extra (Sem aluno fixo)</option>
                )}
                {alunos
                  .filter((a) => a.id !== modalTrocarAluno.item?.aluno_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onFecharTrocarAluno}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!modalTrocarAluno.novoAlunoId}
                onClick={() =>
                  onSalvarTrocarAluno({
                    id: modalTrocarAluno.item!.id,
                    novoAlunoId:
                      modalTrocarAluno.novoAlunoId === 'EXTRA'
                        ? null
                        : modalTrocarAluno.novoAlunoId
                  })
                }
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Confirmar Mudança
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
