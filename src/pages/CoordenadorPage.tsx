import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShieldAlert, Settings, FileSpreadsheet, Lock, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CoordenadorPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Gestão de Coordenação"
      pageSubtitle="Controle master de disciplinas, grade curricular e parametrizações do sistema"
    >
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Painel Geral de Controle do Coordenador</h3>
                <p className="text-xs text-slate-500">Configurações globais, permissões de papel e relatórios corporativos</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/coordenador/acesso"
                className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-brand-700" />
                <span>Gestão de Acessos por Papel</span>
              </Link>

              <Link
                to="/coordenador/financeiro"
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
              >
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Módulo Financeiro</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <Link
              to="/coordenador/acesso"
              className="p-4 bg-slate-50 hover:bg-brand-50/40 border border-slate-200 hover:border-brand-200 rounded-lg flex items-start gap-3 transition-all group"
            >
              <SlidersHorizontal className="w-5 h-5 text-brand-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-brand-700">Controle de Acessos</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Definição global da matriz permissoes_papel para Aluno, Professor e Admin Master.</p>
              </div>
            </Link>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
              <Settings className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Parâmetros Acadêmicos</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Definição de matrizes de cursos, vagas de especialização e calendário de clínicas.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Relatórios Gerenciais Globais</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Exportação de métricas institucionais e índice de evasão/frequência.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
