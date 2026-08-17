import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { AlunoPage } from '@/pages/AlunoPage';
import { ProfessorPage } from '@/pages/ProfessorPage';
import { SecretariaPage } from '@/pages/SecretariaPage';
import { CoordenadorPage } from '@/pages/CoordenadorPage';
import { FinanceiroPage } from '@/pages/FinanceiroPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Auth Route */}
        <Route path="/login" element={<Login />} />

        {/* Internal Application Routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/aluno" element={<AlunoPage />} />
        <Route path="/professor" element={<ProfessorPage />} />
        <Route path="/secretaria" element={<SecretariaPage />} />
        <Route path="/coordenador" element={<CoordenadorPage />} />

        {/* Extra Protected Route (Extension point for PIN / 2FA) */}
        <Route path="/coordenador/financeiro" element={<FinanceiroPage />} />

        {/* Fallback wildcard route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
