import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { AlunoPage } from '@/pages/AlunoPage';
import { ProfessorPage } from '@/pages/ProfessorPage';
import { LinksUteisPage } from '@/pages/LinksUteisPage';
import { SecretariaPage } from '@/pages/SecretariaPage';
import { CoordenadorPage } from '@/pages/CoordenadorPage';
import { AcessoPage } from '@/pages/AcessoPage';
import { FinanceiroPage } from '@/pages/FinanceiroPage';
import { MateriaisPage } from '@/pages/MateriaisPage';
import { GestaoLinksUteisPage } from '@/pages/coordenador/GestaoLinksUteisPage';
import { BoltonCalculatorPage } from '@/pages/ferramentas/BoltonCalculatorPage';
import { PacientesPage } from '@/pages/pacientes/PacientesPage';
import { ValidacaoConflitosPage } from '@/pages/pacientes/ValidacaoConflitosPage';
import { AgendaPage } from '@/pages/agenda/AgendaPage';
import { AlinhadoresPage } from '@/pages/alinhadores/AlinhadoresPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / Auth Route */}
          <Route path="/login" element={<Login />} />

          {/* Internal Application Routes (Protected) */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/links-uteis" replace /></ProtectedRoute>} />
          <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
          <Route path="/alinhadores" element={<ProtectedRoute allowedRoles={['coordenador', 'admin_master']}><AlinhadoresPage /></ProtectedRoute>} />
          <Route path="/pacientes" element={<ProtectedRoute><PacientesPage /></ProtectedRoute>} />
          <Route path="/pacientes/validacao" element={<ProtectedRoute><ValidacaoConflitosPage /></ProtectedRoute>} />
          <Route path="/links-uteis" element={<ProtectedRoute><LinksUteisPage /></ProtectedRoute>} />
          <Route path="/aluno" element={<ProtectedRoute><AlunoPage /></ProtectedRoute>} />
          <Route path="/professor" element={<ProtectedRoute><ProfessorPage /></ProtectedRoute>} />
          <Route path="/materiais" element={<ProtectedRoute><MateriaisPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/secretaria" element={<ProtectedRoute><SecretariaPage /></ProtectedRoute>} />
          <Route path="/coordenador" element={<ProtectedRoute><CoordenadorPage /></ProtectedRoute>} />
          <Route path="/coordenador/acesso" element={<ProtectedRoute><AcessoPage /></ProtectedRoute>} />
          <Route path="/coordenador/links-uteis" element={<ProtectedRoute><GestaoLinksUteisPage /></ProtectedRoute>} />

          {/* Ferramentas Clínicas (Protected) */}
          <Route path="/ferramentas/bolton" element={<ProtectedRoute><BoltonCalculatorPage /></ProtectedRoute>} />

          {/* Extra Protected Route */}
          <Route path="/coordenador/financeiro" element={<ProtectedRoute><FinanceiroPage /></ProtectedRoute>} />

          {/* Fallback wildcard route */}
          <Route path="*" element={<ProtectedRoute><Navigate to="/links-uteis" replace /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
