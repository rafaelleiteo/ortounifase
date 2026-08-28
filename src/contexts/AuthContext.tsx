import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Perfil {
  id: string;
  nome: string;
  papel: 'coordenador' | 'admin_master' | 'professor';
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

interface AuthContextType {
  user: User | null;
  profile: Perfil | null;
  permissions: PermissaoModulo[];
  loading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  hasPermission: (modulo: string, requireEdit?: boolean) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [permissions, setPermissions] = useState<PermissaoModulo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

      // 2. Fetch Permissões de Módulo
      const { data: permData, error: permError } = await supabase
        .from('permissoes_modulo')
        .select('*')
        .eq('usuario_id', authUser.id);

      if (permError) {
        console.error('Erro ao buscar permissões:', permError);
      }
      setPermissions(permData || []);
    } catch (err) {
      console.error('Erro ao carregar dados de autenticação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Session listener
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
    setLoading(false);
  };

  const hasPermission = (modulo: string, requireEdit: boolean = false): boolean => {
    if (!profile) return false;
    if (profile.papel === 'coordenador' || profile.papel === 'admin_master') return true;

    const modPerm = permissions.find((p) => p.modulo === modulo);
    if (!modPerm) return false;

    return requireEdit ? modPerm.pode_editar : modPerm.pode_ver;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        permissions,
        loading,
        loginWithPassword,
        logout,
        hasPermission,
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
