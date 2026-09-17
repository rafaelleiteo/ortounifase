import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  MODULOS_SISTEMA,
  PAPEIS_SISTEMA,
  Papel,
  DEFAULT_PERMISSOES_PAPEL,
} from '@/lib/permissoesPapel';
import {
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Info,
  SlidersHorizontal,
  AlertTriangle,
  Database
} from 'lucide-react';

export const AcessoPage: React.FC = () => {
  const {
    rolePermissions,
    rolePermissionsError,
    updateRolePermission,
    refreshRolePermissions
  } = useAuth();

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPodeVer = (papel: Papel, moduloKey: string): boolean => {
    const item = rolePermissions.find((p) => p.papel === papel && p.modulo === moduloKey);
    return item ? item.pode_ver : false;
  };

  const handleToggle = async (papel: Papel, moduloKey: string, currentValue: boolean) => {
    const cellKey = `${papel}:${moduloKey}`;
    setSavingKey(cellKey);
    setActionError(null);
    const newValue = !currentValue;

    try {
      await updateRolePermission(papel, moduloKey, newValue);
      setFeedbackKey(cellKey);
      setTimeout(() => {
        setFeedbackKey((prev) => (prev === cellKey ? null : prev));
      }, 1800);
    } catch (err: any) {
      console.error('Erro ao salvar no Supabase:', err);
      setActionError(err.message || 'Erro ao salvar alteração no Supabase.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleRestoreDefaults = async () => {
    setActionError(null);
    try {
      for (const item of DEFAULT_PERMISSOES_PAPEL) {
        await updateRolePermission(item.papel, item.modulo, item.pode_ver);
      }
      await refreshRolePermissions();
    } catch (err: any) {
      setActionError(`Erro ao restaurar padrões no banco: ${err.message}`);
    }
  };

  const displayError = rolePermissionsError || actionError;

  return (
    <DashboardLayout
      pageTitle="Controle de Acessos por Papel"
      pageSubtitle="Matriz global de permissões de módulos para Aluno, Professor e Admin Master"
    >
      <div className="space-y-6">
        {/* Banner de Erro Real do Banco de Dados (Sem Mascaramento Silencioso) */}
        {displayError && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-start gap-3 text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Erro de Banco de Dados no Supabase</h4>
                <p className="text-xs text-rose-700 mt-0.5">{displayError}</p>
                <p className="text-xs text-rose-800 mt-2 font-medium">
                  A tabela <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">permissoes_papel</code> precisa ser criada fisicamente no banco de dados do Supabase executando o script de migração no SQL Editor do Console do Supabase.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> 20260916120000_create_permissoes_papel.sql</span>
              </div>
              <pre className="pt-2 text-[11px] leading-relaxed text-emerald-400">
{`CREATE TABLE IF NOT EXISTS public.permissoes_papel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    papel TEXT NOT NULL CHECK (papel IN ('aluno', 'professor', 'admin_master')),
    modulo TEXT NOT NULL,
    pode_ver BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_papel_modulo UNIQUE (papel, modulo)
);`}
              </pre>
            </div>
          </div>
        )}

        {/* Banner Informativo */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Gestão Global de Permissões (Estrito Supabase)
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                As alterações realizadas nesta matriz gravam diretamente na tabela <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">permissoes_papel</code> no Supabase. O Coordenador continua com acesso irrestrito a todos os módulos.
              </p>
            </div>
          </div>

          <button
            onClick={handleRestoreDefaults}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer"
            title="Restaurar padrão inicial do sistema no banco de dados"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restaurar Padrões no Banco</span>
          </button>
        </div>

        {/* Tabela de Matriz de Permissões por Papel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Matriz de Visualização de Módulos (permissoes_papel)
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Persistência direta no Supabase
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 text-xs font-semibold">
                  <th className="py-3.5 px-6 w-1/3">Módulo do Sistema</th>
                  {PAPEIS_SISTEMA.map((papelInfo) => (
                    <th key={papelInfo.key} className="py-3.5 px-6 text-center w-1/5">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-900">{papelInfo.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 mt-0.5 max-w-[140px] truncate">
                          {papelInfo.description}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {MODULOS_SISTEMA.map((modulo) => (
                  <tr key={modulo.key} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{modulo.label}</p>
                          <p className="text-[11px] text-slate-500">{modulo.description}</p>
                          <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 mt-1 inline-block">
                            {modulo.path}
                          </code>
                        </div>
                      </div>
                    </td>

                    {PAPEIS_SISTEMA.map((papelInfo) => {
                      const papel = papelInfo.key;
                      const active = isPodeVer(papel, modulo.key);
                      const cellKey = `${papel}:${modulo.key}`;
                      const isSaving = savingKey === cellKey;
                      const hasFeedback = feedbackKey === cellKey;

                      return (
                        <td key={papel} className="py-4 px-6 text-center align-middle">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={isSaving || !!rolePermissionsError}
                                onChange={() => handleToggle(papel, modulo.key, active)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:left-[2px] after:top-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 hover:opacity-90 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
                            </label>

                            {hasFeedback ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Salvo no Supabase!
                              </span>
                            ) : active ? (
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                Permitido
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                Bloqueado
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
