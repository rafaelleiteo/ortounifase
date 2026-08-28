import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { AlunoPage } from '@/pages/AlunoPage';
import { ProfessorPage } from '@/pages/ProfessorPage';
import { SecretariaPage } from '@/pages/SecretariaPage';
import { CoordenadorPage } from '@/pages/CoordenadorPage';
import { FinanceiroPage } from '@/pages/FinanceiroPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
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

          {/* Extra Protected Route */}
          <Route path="/coordenador/financeiro" element={<FinanceiroPage />} />

          {/* Fallback wildcard route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
