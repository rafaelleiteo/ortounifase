import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { KeyRound, Mail, ArrowRight, Shield, AlertCircle, Loader2 } from 'lucide-react';
import logoOfficial from '@/assets/logo/logo-official.png';
import { useAuth } from '@/contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPassword } = useAuth();
  
  const [email, setEmail] = useState('coordenador@ortounifase.edu.br');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { error } = await loginWithPassword(email, password);

      if (error) {
        setErrorMessage(error.message || 'Erro ao realizar login. Verifique suas credenciais.');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro inesperado ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-500" />

        {/* Brand Official Logo Header */}
        <div className="text-center mb-6 pt-2">
          <img
            src={logoOfficial}
            alt="Ortodontia Unifase Logo"
            className="h-16 mx-auto object-contain mb-3"
          />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Acesso ao Sistema</h2>
          <p className="text-xs text-slate-500 mt-1">Digite suas credenciais de Admin / Docente</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-900 leading-relaxed font-medium">
              {errorMessage}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail Institucional</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                placeholder="usuario@ortounifase.edu.br"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Senha</label>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] text-brand-600 hover:underline font-medium">
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                placeholder="Sua senha corporativa"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar com Supabase</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-emerald-700 bg-emerald-50/50 py-2 rounded-lg">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Autenticação Segura via Supabase Auth</span>
        </div>
      </div>
    </AuthLayout>
  );
};
