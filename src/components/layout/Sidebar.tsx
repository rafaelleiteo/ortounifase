import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  UserCheck,
  ClipboardList,
  ShieldAlert,
  DollarSign,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  role: 'aluno' | 'professor' | 'secretaria' | 'coordenador';
  badge?: string;
  isExtraProtected?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Visão Geral',
    path: '/dashboard',
    icon: LayoutDashboard,
    role: 'aluno',
  },
  {
    label: 'Área do Aluno',
    path: '/aluno',
    icon: GraduationCap,
    role: 'aluno',
  },
  {
    label: 'Área do Professor',
    path: '/professor',
    icon: UserCheck,
    role: 'professor',
  },
  {
    label: 'Secretaria',
    path: '/secretaria',
    icon: ClipboardList,
    role: 'secretaria',
  },
  {
    label: 'Coordenação Geral',
    path: '/coordenador',
    icon: ShieldAlert,
    role: 'coordenador',
  },
  {
    label: 'Módulo Financeiro',
    path: '/coordenador/financeiro',
    icon: DollarSign,
    role: 'coordenador',
    badge: 'Camada Extra',
    isExtraProtected: true,
  },
];

interface SidebarProps {
  currentRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRole = 'todos' }) => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Header / Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-500/20">
            OU
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base leading-tight">OrtoUnifase</h1>
            <p className="text-xs text-slate-400">Portal de Gestão</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Navegação Interna
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                        isActive
                          ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn(
                        "w-4 h-4 transition-colors",
                        item.isExtraProtected ? "text-amber-400" : "group-hover:text-brand-400"
                      )} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer / User Profile & Logout Link */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-slate-200 truncate">Usuário Teste</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">Papel: Multi-Acesso</p>
            </div>
          </div>
          <NavLink
            to="/login"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Sair para tela de login"
          >
            <LogOut className="w-4 h-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
