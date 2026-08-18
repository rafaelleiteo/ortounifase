import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { KeyRound, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import logoOfficial from '@/assets/logo/logo-official.png';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('coordenador@ortounifase.edu.br');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<'aluno' | 'professor' | 'secretaria' | 'coordenador'>('coordenador');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'coordenador') {
      navigate('/coordenador');
    } else {
      navigate(`/${selectedRole}`);
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
          <p className="text-xs text-slate-500 mt-1">Digite suas credenciais corporativas para entrar</p>
        </div>

        {/* Development Prototype Info Alert */}
        <div className="mb-6 p-3 bg-brand-50/80 border border-brand-200 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-900 leading-relaxed">
            <strong>Ambiente de Teste:</strong> Selecione o papel abaixo para simular a navegação pós-login.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Simular Papel de Acesso</label>
            <div className="grid grid-cols-2 gap-2">
              {(['aluno', 'professor', 'secretaria', 'coordenador'] as const).map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all text-center ${
                    selectedRole === role
                      ? 'bg-brand-500 text-white border-brand-500 shadow-sm font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">E-mail Institucional</label>
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
              <label className="block text-xs font-medium text-slate-700">Senha</label>
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
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <span>Entrar no Sistema</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-emerald-700 bg-emerald-50/50 py-2 rounded-lg">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Conexão Segura SSL Encaminhada</span>
        </div>
      </div>
    </AuthLayout>
  );
};
