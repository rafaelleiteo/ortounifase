import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ProfessorPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Portal Docente"
      pageSubtitle="Supervisão de atendimentos, aprovação de planos de tratamento e avaliações"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Área do Professor (Placeholder)</h3>
            <p className="text-xs text-slate-400">Painel de supervisão e visto em procedimentos clínicos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Planos Pendentes de Visto</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Lista de tratamentos que requerem aprovação formal antes da execução.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Avaliações Práticas Concluídas</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Histórico de notas e rubricas aplicadas por disciplina.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
