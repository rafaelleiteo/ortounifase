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
import logoBlue from '@/assets/logo/logo-horizontal-blue.png';

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

export const Sidebar: React.FC<SidebarProps> = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30">
      <div>
        {/* Header with Official OrtoUnifase Logo */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <img
            src={logoBlue}
            alt="OrtoUnifase"
            className="h-10 object-contain max-w-[180px]"
          />
        </div>

        {/* Navigation Items */}
        <div className="p-4 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
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
                        'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group',
                        isActive
                          ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-sm font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn(
                        "w-4 h-4 transition-colors",
                        item.isExtraProtected ? "text-amber-500" : "group-hover:text-brand-500 text-slate-500"
                      )} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer / User Profile & Logout Link */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center text-xs font-bold text-brand-700">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">Usuário Teste</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">Multi-Acesso</p>
            </div>
          </div>
          <NavLink
            to="/login"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Sair para tela de login"
          >
            <LogOut className="w-4 h-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
