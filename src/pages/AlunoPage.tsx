import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GraduationCap, BookOpen, Clock } from 'lucide-react';

export const AlunoPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Portal do Aluno"
      pageSubtitle="Acompanhamento de procedimentos clínicos, frequências e módulos acadêmicos"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-lg bg-brand-500/10 text-brand-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Área do Aluno (Placeholder)</h3>
            <p className="text-xs text-slate-400">Módulo reservado para consulta de notas, escala de atendimento e prontuários</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Prontuários Atribuição Direta</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Espaço para preenchimento de anamnese e planejamento ortodôntico.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Horas de Prática Clínica</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Controle de presença e validação por docentes responsáveis.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
