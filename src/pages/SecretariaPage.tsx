import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClipboardList, UserPlus, CalendarDays } from 'lucide-react';

export const SecretariaPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Secretaria e Recepção"
      pageSubtitle="Triagem de pacientes, agendamento de consultas e gestão de matrículas"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-lg bg-cyan-50 text-cyan-600">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Área da Secretaria (Placeholder)</h3>
            <p className="text-xs text-slate-500">Fluxo de caixa de balcão, agendamentos e cadastro inicial de pacientes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Novo Cadastro de Paciente</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Ficha de triagem e direcionamento para clínica de especialização.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Agenda de Cadeira Clínicas</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Mapeamento de horários por turma e alocação de equipamentos.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
