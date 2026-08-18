import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Users, Calendar, FileText, Activity } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Visão Geral do Sistema"
      pageSubtitle="Resumo de atividades clínicas e administrativas em tempo real"
    >
      <div className="space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-semibold">Atendimentos Hoje</span>
              <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">28</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">↑ 12% em relação a ontem</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-semibold">Alunos Ativos</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">142</p>
            <p className="text-[11px] text-slate-500 mt-1">Distribuídos em 6 turmas</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-semibold">Prontuários Abertos</span>
              <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">89</p>
            <p className="text-[11px] text-amber-600 font-medium mt-1">14 pendentes de validação</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-semibold">Ocupação de Clínica</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">92%</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Capacidade quase máxima</p>
          </div>
        </div>

        {/* Content Placeholder Box */}
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-2">Painel de Controle em Construção</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Estrutura base pronta para integração de gráficos, tabelas de agendamentos e lista de pacientes. Utilize o menu lateral para explorar as rotas por papel.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
