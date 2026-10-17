import React from 'react';
import { DIAS_SEMANA, OPCOES_TURNO, DiaSemana, TurnoAgenda } from '../../lib/agendaTypes';

export interface AgendaFiltrosHeaderProps {
  diaSelecionado: DiaSemana;
  onDiaChange: (dia: DiaSemana) => void;
  periodo: TurnoAgenda;
  onPeriodoChange: (turno: TurnoAgenda) => void;
  children?: React.ReactNode;
  className?: string;
}

export function AgendaFiltrosHeader({
  diaSelecionado,
  onDiaChange,
  periodo,
  onPeriodoChange,
  children,
  className = ''
}: AgendaFiltrosHeaderProps) {
  return (
    <div className={`bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 ${className}`}>
      {/* Seletor de Dia da Semana */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dia da Semana:</span>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {DIAS_SEMANA.map((dia) => (
            <button
              key={dia}
              type="button"
              onClick={() => onDiaChange(dia)}
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
      </div>

      {/* Filtro de Período / Turno */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Turno:</span>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {OPCOES_TURNO.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPeriodoChange(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodo === opt.id
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.id === 'TODOS' ? opt.label : `${opt.label} (${opt.descricao})`}
            </button>
          ))}
        </div>
      </div>

      {/* Ações ou Controles específicos da aba */}
      {children}
    </div>
  );
}
