import React from 'react';
import { Edit2, Clock, ArrowRightLeft, Trash2, Lock } from 'lucide-react';

export interface AgendaCardItem {
  id: string;
  paciente: string;
  aluno_id?: string | null;
  aluno?: string | null;
  horario: string;
  dia_semana: string;
  turma_id?: string;
  mes_referencia?: string;
  tipo_registro?: 'paciente' | 'bloqueio';
  is_extra?: boolean;
}

export interface AgendaCardAtendimentoProps {
  item: AgendaCardItem;
  badge?: React.ReactNode;
  detalhe?: React.ReactNode;
  corCard?: string;
  podeEditar?: boolean;
  onEditar?: (item: AgendaCardItem) => void;
  onReagendar?: (item: AgendaCardItem) => void;
  onTrocarAluno?: (item: AgendaCardItem) => void;
  onExcluir?: (item: AgendaCardItem) => void;
}

export const AgendaCardAtendimento: React.FC<AgendaCardAtendimentoProps> = ({
  item,
  badge,
  detalhe,
  corCard,
  podeEditar = false,
  onEditar,
  onReagendar,
  onTrocarAluno,
  onExcluir
}) => {
  const isBloqueio = item.tipo_registro === 'bloqueio';
  const defaultBg = isBloqueio
    ? 'bg-amber-50/70 border-amber-300 text-amber-900'
    : 'bg-brand-50/50 border-brand-200 text-brand-900';

  const cardStyle = corCard || defaultBg;

  return (
    <div
      className={`group p-2 rounded-xl border text-xs shadow-2xs transition-all relative ${cardStyle}`}
    >
      {/* Cabeçalho do Card: Nome e Badges */}
      <div className="font-semibold break-words mb-1 flex items-start justify-between gap-1">
        <span className="leading-snug">{item.paciente}</span>
        {isBloqueio && (
          <span
            title="Horário Fechado / Bloqueio"
            className="shrink-0 text-amber-700 bg-amber-100/90 border border-amber-200/80 p-0.5 rounded-md"
          >
            <Lock className="w-3 h-3" />
          </span>
        )}
        {item.is_extra && !badge && (
          <span
            title="Atendimento Extra"
            className="shrink-0 text-[10px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold"
          >
            Extra
          </span>
        )}
      </div>

      {/* Badge ou Detalhe (ex: Inconsistência) */}
      {badge && <div className="mb-1">{badge}</div>}
      {detalhe && <div className="text-[10px] opacity-85 leading-tight mb-1">{detalhe}</div>}

      {/* Barra de Ações (Visível e com destaque no hover) */}
      {podeEditar && (
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 pt-1 mt-1 border-t border-slate-200/50">
          {onEditar && (
            <button
              type="button"
              title="Editar Atendimento"
              onClick={(e) => {
                e.stopPropagation();
                onEditar(item);
              }}
              className="p-1 text-slate-500 hover:text-brand-600 rounded-md hover:bg-white/80 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}

          {onReagendar && (
            <button
              type="button"
              title="Reagendar / Alterar Horário"
              onClick={(e) => {
                e.stopPropagation();
                onReagendar(item);
              }}
              className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-white/80 transition-colors"
            >
              <Clock className="w-3 h-3" />
            </button>
          )}

          {onTrocarAluno && (
            <button
              type="button"
              title="Trocar Aluno Responsável"
              onClick={(e) => {
                e.stopPropagation();
                onTrocarAluno(item);
              }}
              className="p-1 text-slate-500 hover:text-amber-600 rounded-md hover:bg-white/80 transition-colors"
            >
              <ArrowRightLeft className="w-3 h-3" />
            </button>
          )}

          {onExcluir && (
            <button
              type="button"
              title="Excluir Atendimento"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir(item);
              }}
              className="p-1 text-slate-500 hover:text-rose-600 rounded-md hover:bg-white/80 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
