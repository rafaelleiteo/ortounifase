import React from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Search, ShieldCheck, Eye, X, AlertTriangle } from 'lucide-react';
import { useAuth, PreviewRole } from '@/contexts/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  pageTitle = 'Painel de Gestão',
  pageSubtitle = 'Sistema Interno de Controle Acadêmico e Odontológico',
}) => {
  const { profile, previewRole, setPreviewRole } = useAuth();

  const isCoordenadorOrAdmin = !profile || profile.papel === 'coordenador' || profile.papel === 'admin_master';

  const getPreviewRoleLabel = (role: PreviewRole) => {
    if (role === 'aluno') return 'Aluno';
    if (role === 'professor') return 'Professor';
    return 'Eu mesmo (Coordenador)';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Lateral Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Banner Fixo Amarelo para Modo Visualização (Preview) */}
        {previewRole && (
          <div className="bg-amber-400 text-slate-900 px-6 py-2.5 flex items-center justify-between shadow-xs sticky top-0 z-30 font-medium text-xs border-b border-amber-500">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-slate-900 shrink-0" />
              <span>
                <strong>Modo Visualização: {getPreviewRoleLabel(previewRole)}</strong> — Você continua logado como Coordenador
              </span>
            </div>

            <button
              onClick={() => setPreviewRole(null)}
              className="px-3 py-1 bg-slate-900 hover:bg-black text-amber-300 rounded-md font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3 text-amber-300" />
              <span>Sair do modo visualização</span>
            </button>
          </div>
        )}

        {/* Top App Bar */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">{pageTitle}</h2>
            <p className="text-xs text-slate-500">{pageSubtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Seletor "Ver como:" exclusivo para Coordenador / Admin */}
            {isCoordenadorOrAdmin && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs">
                <Eye className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold text-amber-900 text-[11px]">Ver como:</span>
                <select
                  value={previewRole || 'coordenador'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'aluno') setPreviewRole('aluno');
                    else if (val === 'professor') setPreviewRole('professor');
                    else setPreviewRole(null);
                  }}
                  className="bg-white border border-amber-300 text-slate-800 font-medium text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="coordenador">Eu mesmo (Coordenador)</option>
                  <option value="professor">Professor</option>
                  <option value="aluno">Aluno</option>
                </select>
              </div>
            )}

            {/* Quick search input placeholder */}
            <div className="relative hidden lg:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar prontuário, aluno ou turma..."
                className="bg-slate-50 border border-slate-200 text-xs rounded-lg pl-9 pr-4 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors w-56"
                readOnly
              />
            </div>

            <div className="h-4 w-px bg-slate-200 hidden md:block" />

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Sessão Ativa
              </span>
              <button
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors relative"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-brand-500 absolute top-1.5 right-1.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
