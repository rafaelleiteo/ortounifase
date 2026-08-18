import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DollarSign, ShieldCheck, KeyRound, Sparkles, TrendingUp, CreditCard } from 'lucide-react';

export const FinanceiroPage: React.FC = () => {
  return (
    <DashboardLayout
      pageTitle="Módulo Financeiro - Coordenação"
      pageSubtitle="Gestão de mensalidades, custos operacionais da clínica e repasses"
    >
      <div className="space-y-6">
        {/* Prominent Visual Callout Banner for Protected Route (Amber Alert in Light Theme) */}
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-6 relative overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 border border-amber-300 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-700" />
                    Camada Extra de Proteção
                  </span>
                  <span className="text-[11px] text-amber-800 font-medium">Nível 3 de Segurança</span>
                </div>
                <h3 className="text-base font-bold text-amber-950">Área Financeira com Restrição Adicional</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Esta rota é um ponto de extensão preparado para autenticação biométrica ou PIN de segurança (MFA).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-amber-200 shrink-0 shadow-xs">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-mono text-slate-700 font-medium">Modo Demonstrativo</span>
            </div>
          </div>
        </div>

        {/* Dashboard Financial Metrics Placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold">Faturamento da Clínica</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">R$ 148.500,00</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Mês corrente (Estimado)</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold">Inadimplência</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">3,4%</p>
            <p className="text-[11px] text-slate-500 mt-1">Abaixo do teto estipulado</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold">Custo de Insumos</span>
              <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">R$ 32.120,00</p>
            <p className="text-[11px] text-slate-500 mt-1">Materiais ortodônticos e esterilização</p>
          </div>
        </div>

        {/* Placeholder Information Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Módulo Financeiro Integrado</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Estrutura da rota <code className="text-brand-700 font-mono bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">/coordenador/financeiro</code> já mapeada no roteador principal. Em etapas futuras, o componente poderá ser envolvido por um Guard de autenticação ou modal de chave de segurança antes de renderizar os dados sensíveis.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
