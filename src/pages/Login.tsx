import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { KeyRound, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('coordenador@ortounifase.edu.br');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<'aluno' | 'professor' | 'secretaria' | 'coordenador'>('coordenador');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Visual prototype simulation - direct navigation to corresponding role or general dashboard
    if (selectedRole === 'coordenador') {
      navigate('/coordenador');
    } else {
      navigate(`/${selectedRole}`);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500 to-cyan-500 mx-auto flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-500/25 mb-4">
            OU
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Acesso ao Sistema</h2>
          <p className="text-xs text-slate-400 mt-1">Digite suas credenciais corporativas para acessar o OrtoUnifase</p>
        </div>

        {/* Prototype Info Alert */}
        <div className="mb-6 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-300 leading-relaxed">
            <strong>Ambiente de Desenvolvimento:</strong> Selecione o papel abaixo para simular o redirecionamento pós-login.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector for easy prototype navigation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Simular Papel de Acesso</label>
            <div className="grid grid-cols-2 gap-2">
              {(['aluno', 'professor', 'secretaria', 'coordenador'] as const).map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all text-center ${
                    selectedRole === role
                      ? 'bg-brand-500/20 border-brand-500 text-brand-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail Institucional</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="usuario@ortounifase.edu.br"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Senha</label>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] text-brand-400 hover:underline">
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <span>Entrar no Sistema</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Conexão Segura SSL Encaminhada</span>
        </div>
      </div>
    </AuthLayout>
  );
};
