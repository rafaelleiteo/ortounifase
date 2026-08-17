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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium">Atendimentos Hoje</span>
              <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">28</p>
            <p className="text-[11px] text-emerald-400 mt-1">↑ 12% em relação a ontem</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium">Alunos Ativos</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">142</p>
            <p className="text-[11px] text-slate-500 mt-1">Distribuídos em 6 turmas</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium">Prontuários Abertos</span>
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">89</p>
            <p className="text-[11px] text-amber-400 mt-1">14 pendentes de validação</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium">Ocupação de Clínica</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">92%</p>
            <p className="text-[11px] text-emerald-400 mt-1">Capacidade quase máxima</p>
          </div>
        </div>

        {/* Content Placeholder Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center border-dashed">
          <h3 className="text-base font-semibold text-slate-200 mb-2">Painel de Controle em Construção</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Estrutura base pronta para integração de gráficos, tabelas de agendamentos e lista de pacientes. Utilize o menu lateral para explorar as rotas por papel.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
