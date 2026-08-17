import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShieldAlert, Settings, FileSpreadsheet, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CoordenadorPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Gestão de Coordenação"
      pageSubtitle="Controle master de disciplinas, grade curricular e parametrizações do sistema"
    >
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Painel do Coordenador (Placeholder)</h3>
                <p className="text-xs text-slate-400">Configurações globais, turmas e permissões de acesso corporativo</p>
              </div>
            </div>

            <Link
              to="/coordenador/financeiro"
              className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Acessar Módulo Financeiro</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
              <Settings className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Parâmetros Acadêmicos</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Definição de matrizes de cursos, vagas de especialização e calendário de clínicas.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Relatórios Gerenciais Globais</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Exportação de métricas institucionais e índice de evasão/frequência.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
