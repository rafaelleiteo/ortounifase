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
        {/* Prominent Visual Callout Banner for Protected Route Extension Point */}
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Camada Extra de Proteção
                  </span>
                  <span className="text-[11px] text-amber-400/80 font-medium">Nível 3 de Segurança</span>
                </div>
                <h3 className="text-base font-bold text-slate-100">Área Financeira com Restrição Adicional</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Esta rota é um ponto de extensão preparado para autenticação biométrica ou PIN de segurança (MFA).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono text-slate-300">Modo Demonstrativo</span>
            </div>
          </div>
        </div>

        {/* Dashboard Financial Metrics Placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Faturamento da Clínica</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">R$ 148.500,00</p>
            <p className="text-[11px] text-emerald-400 mt-1">Mês corrente (Estimado)</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Inadimplência</span>
              <TrendingUp className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">3,4%</p>
            <p className="text-[11px] text-slate-400 mt-1">Abaixo do teto estipulado</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Custo de Insumos</span>
              <CreditCard className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">R$ 32.120,00</p>
            <p className="text-[11px] text-slate-400 mt-1">Materiais ortodônticos e esterilização</p>
          </div>
        </div>

        {/* Placeholder Information Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">Módulo Financeiro Integrado</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Estrutura da rota <code className="text-amber-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">/coordenador/financeiro</code> já mapeada no roteador principal. Em etapas futuras, o componente poderá ser envolvido por um Guard de autenticação ou modal de chave de segurança antes de renderizar os dados sensíveis.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
