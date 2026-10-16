import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // 1. Enquanto loading === true: exibir spinner de carregamento de tela inteira
  // Nunca redirecionar nem renderizar conteúdo antes da sessão carregar
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">
            Validando sessão de autenticação...
          </p>
        </div>
      </div>
    );
  }

  // 2. Se loading === false e !user (sem sessão real do Supabase): redirecionar para /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Se loading === false e user existe mas profile ainda não carregou ou é null/inválido:
  // Tratar como não autorizado também (nunca mostrar o painel sem um profile.papel válido)
  if (!profile || !profile.papel) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            Perfil não localizado
          </h2>
          <p className="text-xs text-slate-600">
            Sua conta está autenticada, mas não possui um perfil de acesso configurado no sistema. Entre em contato com a Coordenação.
          </p>
          <button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
