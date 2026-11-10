import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  PermissaoPapel,
  Papel,
  fetchPermissoesPapel,
  updatePermissaoPapel as apiUpdatePermissaoPapel,
} from '@/lib/permissoesPapel';
import {
  sessaoExpirada,
  obterInicioSessao,
  salvarInicioSessao,
  salvarInicioSessaoSeNaoExistir,
  limparInicioSessao,
  inicioValido,
  getStorage,
  obterSupabaseStorageKey,
  limparChavesSessaoSupabase,
} from '@/lib/sessaoLimite';

export interface Perfil {
  id: string;
  nome: string;
  papel: 'coordenador' | 'admin_master' | 'professor' | 'aluno';
  ativo: boolean;
  criado_em: string;
}

export interface PermissaoModulo {
  id: string;
  usuario_id: string;
  modulo: string;
  pode_ver: boolean;
  pode_editar: boolean;
}

export type PreviewRole = 'aluno' | 'professor' | null;

interface AuthContextType {
  user: User | null;
  profile: Perfil | null;
  permissions: PermissaoModulo[];
  rolePermissions: PermissaoPapel[];
  rolePermissionsError: string | null;
  previewRole: PreviewRole;
  effectiveRole: 'coordenador' | 'admin_master' | 'professor' | 'aluno' | null;
  loading: boolean;
  setPreviewRole: (role: PreviewRole) => void;
  loginWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  hasPermission: (modulo: string, requireEdit?: boolean) => boolean;
  updateRolePermission: (papel: Papel, modulo: string, pode_ver: boolean) => Promise<void>;
  refreshRolePermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [permissions, setPermissions] = useState<PermissaoModulo[]>([]);
  const [rolePermissions, setRolePermissions] = useState<PermissaoPapel[]>([]);
  const [rolePermissionsError, setRolePermissionsError] = useState<string | null>(null);
  const [previewRole, setPreviewRole] = useState<PreviewRole>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const deslogandoRef = useRef<boolean>(false);

  const deslogarPorExpiracao = async () => {
    if (deslogandoRef.current) return;
    deslogandoRef.current = true;

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.warn('Erro ao executar signOut local por expiracao de sessao:', error.message);
      }
    } catch (err: any) {
      console.warn('Excecao ao deslogar por expiracao de sessao:', err?.message || err);
    } finally {
      limparInicioSessao();
      const storageKey =
        (supabase.auth as unknown as { storageKey?: string })?.storageKey ||
        obterSupabaseStorageKey(import.meta.env.VITE_SUPABASE_URL);
      if (storageKey) {
        limparChavesSessaoSupabase(getStorage(), storageKey);
      }
      setUser(null);
      setProfile(null);
      setPermissions([]);
      setPreviewRole(null);
      setLoading(false);
      window.location.href = '/login?expirada=1';
    }
  };

  const loadRolePermissions = async () => {
    try {
      setRolePermissionsError(null);
      const data = await fetchPermissoesPapel();
      setRolePermissions(data);
    } catch (err: any) {
      console.error('Erro ao carregar permissões por papel do Supabase:', err);
      setRolePermissions([]);
      setRolePermissionsError(err.message || 'Falha ao consultar tabela permissoes_papel no Supabase.');
    }
  };

  const fetchUserData = async (authUser: User) => {
    try {
      // 1. Fetch Perfil
      const { data: profileData, error: profileError } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Erro ao buscar perfil:', profileError);
      }
      setProfile(profileData || null);

      // 2. Fetch Permissões de Módulo individuais
      const { data: permData, error: permError } = await supabase
        .from('permissoes_modulo')
        .select('*')
        .eq('usuario_id', authUser.id);

      if (permError) {
        console.error('Erro ao buscar permissões:', permError);
      }
      setPermissions(permData || []);

      // 3. Fetch Permissões Globais por Papel (estrito Supabase)
      await loadRolePermissions();
    } catch (err) {
      console.error('Erro ao carregar dados de autenticação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRolePermissions();

    let montado = true;

    const checarAoMontar = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!montado) return;

        if (session?.user) {
          const inicio = obterInicioSessao();
          const agora = Date.now();
          if (inicio === null || !inicioValido(inicio, agora)) {
            salvarInicioSessao(agora);
          } else if (sessaoExpirada(inicio, agora)) {
            await deslogarPorExpiracao();
            return;
          }

          setUser(session.user);
          await fetchUserData(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro na verificacao de sessao:', err);
        if (montado) setLoading(false);
      }
    };

    checarAoMontar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!montado) return;

      if (event === 'SIGNED_OUT') {
        limparInicioSessao();
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        salvarInicioSessaoSeNaoExistir();
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        const inicio = obterInicioSessao();
        const agora = Date.now();
        if (sessaoExpirada(inicio, agora)) {
          deslogarPorExpiracao();
          return;
        }
        fetchUserData(session.user);
      } else {
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    const verificarPeriodico = () => {
      if (deslogandoRef.current) return;
      const agora = Date.now();
      const inicio = obterInicioSessao();
      if (inicio !== null && sessaoExpirada(inicio, agora)) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            deslogarPorExpiracao();
          }
        });
      }
    };

    const intervalId = window.setInterval(verificarPeriodico, 60000);

    const onFocus = () => {
      verificarPeriodico();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verificarPeriodico();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      montado = false;
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const loginWithPassword = async (email: string, password: string) => {
    setLoading(true);
    limparInicioSessao();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      return { error };
    }

    if (data.user) {
      salvarInicioSessao();
      await fetchUserData(data.user);
    }
    return { error: null };
  };

  const logout = async () => {
    setLoading(true);
    limparInicioSessao();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao executar signOut:', err);
    }
    setUser(null);
    setProfile(null);
    setPermissions([]);
    setPreviewRole(null);
    setLoading(false);
    window.location.href = '/login';
  };

  const realRole = profile?.papel ?? null;
  const effectiveRole = (realRole === 'coordenador' || realRole === 'admin_master') && previewRole
    ? previewRole
    : realRole;

  const updateRolePermission = async (papel: Papel, modulo: string, pode_ver: boolean) => {
    await apiUpdatePermissaoPapel(papel, modulo, pode_ver);
    await loadRolePermissions();
  };

  const hasPermission = (modulo: string, requireEdit: boolean = false): boolean => {
    if (!effectiveRole) return false;
    if (effectiveRole === 'coordenador' || effectiveRole === 'admin_master') return true;

    const rolePerm = rolePermissions.find((p) => p.papel === effectiveRole && p.modulo === modulo);
    if (rolePerm) {
      return rolePerm.pode_ver;
    }

    const modPerm = permissions.find((p) => p.modulo === modulo);
    if (modPerm) {
      return requireEdit ? modPerm.pode_editar : modPerm.pode_ver;
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        permissions,
        rolePermissions,
        rolePermissionsError,
        previewRole,
        effectiveRole,
        loading,
        setPreviewRole,
        loginWithPassword,
        logout,
        hasPermission,
        updateRolePermission,
        refreshRolePermissions: loadRolePermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
