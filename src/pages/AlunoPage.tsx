import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GraduationCap, BookOpen, Clock } from 'lucide-react';

export const AlunoPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Portal do Aluno"
      pageSubtitle="Acompanhamento de procedimentos clínicos, frequências e módulos acadêmicos"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-lg bg-brand-50 text-brand-600">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Área do Aluno (Placeholder)</h3>
            <p className="text-xs text-slate-500">Módulo reservado para consulta de notas, escala de atendimento e prontuários</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Prontuários Atribuição Direta</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Espaço para preenchimento de anamnese e planejamento ortodôntico.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Horas de Prática Clínica</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Controle de presença e validação por docentes responsáveis.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
