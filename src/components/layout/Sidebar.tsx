import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  DollarSign,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Package,
  Eye,
  Link2,
  Calculator,
  Users,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoOfficial from '@/assets/logo/logo-official.png';
import { useAuth } from '@/contexts/AuthContext';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  moduloKey: string;
  section?: 'main' | 'ferramentas';
  roleRequired?: Array<'coordenador' | 'admin_master' | 'professor' | 'aluno'>;
  badge?: string;
  isExtraProtected?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Pacientes',
    path: '/pacientes',
    icon: Users,
    moduloKey: 'aluno',
    section: 'main',
  },
  {
    label: 'Links Úteis',
    path: '/links-uteis',
    icon: Link2,
    moduloKey: 'aluno',
    section: 'main',
  },
  {
    label: 'Catálogo de Materiais',
    path: '/materiais',
    icon: Package,
    moduloKey: 'materiais',
    section: 'main',
  },
  {
    label: 'Agenda',
    path: '/agenda',
    icon: Calendar,
    moduloKey: 'coordenador',
    section: 'main',
    roleRequired: ['coordenador', 'admin_master'],
  },
  {
    label: 'Coordenação Geral',
    path: '/coordenador',
    icon: ShieldAlert,
    moduloKey: 'coordenador',
    section: 'main',
    roleRequired: ['coordenador', 'admin_master'],
  },
  {
    label: 'Módulo Financeiro',
    path: '/coordenador/financeiro',
    icon: DollarSign,
    moduloKey: 'coordenador',
    section: 'main',
    roleRequired: ['coordenador', 'admin_master'],
    badge: 'Camada Extra',
    isExtraProtected: true,
  },

  // SEÇÃO FERRAMENTAS CLÍNICAS
  {
    label: 'Análise de Bolton',
    path: '/ferramentas/bolton',
    icon: Calculator,
    moduloKey: 'aluno',
    section: 'ferramentas',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { profile, logout, hasPermission, effectiveRole, previewRole } = useAuth();

  const userRole = profile?.papel ?? '';
  const userName = profile?.nome ?? '';

  const visibleNavItems = navItems.filter((item) => {
    if (!effectiveRole) return false;
    if (effectiveRole === 'coordenador' || effectiveRole === 'admin_master') return true;

    if (item.roleRequired && !item.roleRequired.includes(effectiveRole as any)) {
      return false;
    }

    if (item.path === '/pacientes' || item.path === '/links-uteis' || item.path === '/ferramentas/bolton') {
      return hasPermission('aluno') || hasPermission('professor');
    }

    return hasPermission(item.moduloKey);
  });

  const mainNavItems = visibleNavItems.filter((i) => !i.section || i.section === 'main');
  const ferramentasNavItems = visibleNavItems.filter((i) => i.section === 'ferramentas');

  const renderNavGroup = (items: NavItem[]) => (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl text-xs font-medium transition-all group',
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
                isActive
                  ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              )
            }
          >
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
              <Icon className={cn(
                "transition-colors",
                isCollapsed ? "w-5 h-5" : "w-4 h-4",
                item.isExtraProtected ? "text-amber-500" : "group-hover:text-brand-500 text-slate-500"
              )} />
              {!isCollapsed && <span>{item.label}</span>}
            </div>

            {!isCollapsed && (
              item.badge ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
              )
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <aside
      className={cn(
        "bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 transition-all duration-300 relative print:hidden",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Botão de alternância flutuante na borda lateral */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-6 z-40 bg-white border border-slate-200 rounded-full p-1 shadow-sm hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-transform active:scale-95 cursor-pointer"
          title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}

      <div>
        {/* Header with Official OrtoUnifase Logo */}
        <div className={cn(
          "border-b border-slate-100 flex items-center transition-all",
          isCollapsed ? "p-3 justify-center" : "p-4 justify-between"
        )}>
          {!isCollapsed ? (
            <>
              <img
                src={logoOfficial}
                alt="OrtoUnifase"
                className="h-10 object-contain max-w-[170px]"
              />
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Recolher menu lateral"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <div
              className="w-9 h-9 rounded-xl bg-brand-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs tracking-wider cursor-pointer"
              title="OrtoUnifase (Clique para expandir)"
              onClick={onToggleCollapse}
            >
              OU
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className={cn("space-y-6 transition-all", isCollapsed ? "p-2" : "p-4")}>
          {/* SEÇÃO 1: NAVEGAÇÃO INTERNA */}
          <div>
            {!isCollapsed ? (
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Navegação Interna
                </span>
                {previewRole && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5 text-amber-600" />
                    Preview: {effectiveRole}
                  </span>
                )}
              </div>
            ) : (
              <div className="h-px bg-slate-200 my-2 mx-1" />
            )}
            {renderNavGroup(mainNavItems)}
          </div>

          {/* SEÇÃO 2: FERRAMENTAS CLÍNICAS */}
          {ferramentasNavItems.length > 0 && (
            <div>
              {!isCollapsed ? (
                <div className="px-3 mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Ferramentas
                  </span>
                </div>
              ) : (
                <div className="h-px bg-slate-200 my-2 mx-1" />
              )}
              {renderNavGroup(ferramentasNavItems)}
            </div>
          )}
        </div>
      </div>

      {/* Footer / User Profile & Logout */}
      <div className={cn("border-t border-slate-100 bg-slate-50/60 transition-all", isCollapsed ? "p-2.5" : "p-4")}>
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">
                  Papel: {userRole} {previewRole ? `(ver como ${effectiveRole})` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center text-xs font-bold text-brand-700"
              title={`${userName} (${userRole})`}
            >
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
