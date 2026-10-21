import React from 'react';
import { Edit2, Clock, ArrowRightLeft, Trash2, Lock, Link2, Sparkles } from 'lucide-react';
import {
  TipoBloqueio,
  COR_BLOQUEIO_SEQUENCIA,
  COR_BLOQUEIO_LIVRE,
  COR_BLOQUEIO_OUTRO,
  getTipoBloqueio,
  getDescricaoBloqueio
} from '@/lib/agendaTypes';

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
  tipo_bloqueio?: TipoBloqueio;
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
  const tipoBloqueio = isBloqueio ? (item.tipo_bloqueio || getTipoBloqueio(item)) : null;

  let defaultBg = 'bg-brand-50/50 border-brand-200 text-brand-900 agenda-cor-sequencia';
  let badgeBloqueio = null;

  if (isBloqueio) {
    if (tipoBloqueio === 'SEQUENCIA') {
      // 1. TIPO SEQUÊNCIA DE ATENDIMENTO: AZUL (mesmo token de paciente agendado normalmente)
      defaultBg = `${COR_BLOQUEIO_SEQUENCIA} agenda-cor-sequencia`;
      badgeBloqueio = (
        <span
          title="Sequência de Atendimento (Continuação)"
          className="shrink-0 text-brand-700 bg-brand-100/90 border border-brand-200/80 p-0.5 rounded-md flex items-center gap-0.5 print:border-none print:p-0"
        >
          <Lock className="w-3 h-3 print:w-2.5 print:h-2.5" />
        </span>
      );
    } else if (tipoBloqueio === 'LIVRE') {
      // 2. TIPO LIVRE: AMARELO (horário intencionalmente vago/disponível)
      defaultBg = `${COR_BLOQUEIO_LIVRE} agenda-cor-livre`;
      badgeBloqueio = (
        <span
          title="Horário Livre (Vago)"
          className="shrink-0 text-amber-700 bg-amber-100/90 border border-amber-200/80 p-0.5 rounded-md flex items-center gap-0.5 print:border-none print:p-0"
        >
          <Lock className="w-3 h-3 print:w-2.5 print:h-2.5" />
        </span>
      );
    } else {
      // 3. TIPO OUTRO: CINZA (observação livre ou legado sem tipo definido)
      defaultBg = `${COR_BLOQUEIO_OUTRO} agenda-cor-outro`;
      badgeBloqueio = (
        <span
          title="Bloqueio / Observação Geral"
          className="shrink-0 text-slate-600 bg-slate-200/80 border border-slate-300/80 p-0.5 rounded-md flex items-center gap-0.5 print:border-none print:p-0"
        >
          <Lock className="w-3 h-3 print:w-2.5 print:h-2.5" />
        </span>
      );
    }
  }

  const cardStyle = corCard || defaultBg;
  const textoExibicao = isBloqueio ? getDescricaoBloqueio(item.paciente) : item.paciente;

  return (
    <div
      className={`agenda-print-card group p-2 print:p-0.5 rounded-xl print:rounded-xs border text-xs print:text-[11px] print:leading-tight shadow-2xs print:shadow-none transition-all relative ${item.is_extra ? 'agenda-cor-extra ' : ''}${cardStyle}`}
    >
      {/* Cabeçalho do Card: Nome e Badges */}
      <div className="card-title font-semibold break-words mb-1 print:mb-0 flex items-start justify-between gap-1 leading-snug print:leading-tight">
        <span className="leading-snug print:leading-tight">{textoExibicao}</span>
        {isBloqueio && badgeBloqueio}
        {item.is_extra && !badge && (
          <span
            title="Atendimento Extra"
            className="shrink-0 text-[10px] print:text-[9.5px] print:leading-tight agenda-print-badge bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold"
          >
            Extra
          </span>
        )}
      </div>

      {/* Badge ou Detalhe (ex: Inconsistência) */}
      {badge && <div className="mb-1 print:mb-0 agenda-print-badge">{badge}</div>}
      {detalhe && <div className="agenda-print-detalhe text-[10px] print:text-[8.5px] print:leading-tight opacity-85 leading-tight mb-1 print:mb-0">{detalhe}</div>}

      {/* Barra de Ações (Visível e com destaque no hover - Oculta na impressão) */}
      {podeEditar && (
        <div className="agenda-card-actions flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 pt-1 mt-1 border-t border-slate-200/50 print:hidden">
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
