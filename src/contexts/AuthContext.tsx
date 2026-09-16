import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  PermissaoPapel,
  Papel,
  fetchPermissoesPapel,
  updatePermissaoPapel as apiUpdatePermissaoPapel,
} from '@/lib/permissoesPapel';

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
  previewRole: PreviewRole;
  effectiveRole: 'coordenador' | 'admin_master' | 'professor' | 'aluno';
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
  const [previewRole, setPreviewRole] = useState<PreviewRole>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadRolePermissions = async () => {
    const data = await fetchPermissoesPapel();
    setRolePermissions(data);
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

      // 3. Fetch Permissões Globais por Papel
      await loadRolePermissions();
    } catch (err) {
      console.error('Erro ao carregar dados de autenticação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRolePermissions();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithPassword = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      return { error };
    }

    if (data.user) {
      await fetchUserData(data.user);
    }
    return { error: null };
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions([]);
    setPreviewRole(null);
    setLoading(false);
  };

  const realRole = profile?.papel || 'coordenador';
  const effectiveRole = (realRole === 'coordenador' || realRole === 'admin_master') && previewRole
    ? previewRole
    : realRole;

  const updateRolePermission = async (papel: Papel, modulo: string, pode_ver: boolean) => {
    const result = await apiUpdatePermissaoPapel(papel, modulo, pode_ver);
    setRolePermissions(result.data);
  };

  const hasPermission = (modulo: string, requireEdit: boolean = false): boolean => {
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
