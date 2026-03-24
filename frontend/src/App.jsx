import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { EntrepriseProvider } from './hooks/useEntreprise.jsx';
import { ThemeProvider, useTheme } from './hooks/useTheme.jsx';
import Layout from './components/Layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import FacturesPage from './pages/FacturesPage.jsx';
import RapportsPage from './pages/RapportsPage.jsx';
import DepensesPage from './pages/DepensesPage.jsx';
import TaxesPage from './pages/TaxesPage.jsx';
import ParametresPage from './pages/ParametresPage.jsx';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  const { dark } = useTheme();
  const bg = dark ? '#0B0F1A' : '#F0F4F8';
  const color = dark ? '#6B7A99' : '#64748B';

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'linear-gradient(135deg, #00D4AA, #00A882)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 900, color: '#000',
      }}>₣</div>
      <div style={{ color, fontSize: 13 }}>Chargement ComptaWest...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const Public = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="factures" element={<FacturesPage />} />
        <Route path="depenses" element={<DepensesPage />} />
        <Route path="taxes" element={<TaxesPage />} />
        <Route path="rapports" element={<RapportsPage />} />
        <Route path="parametres" element={<ParametresPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function ToasterThemed() {
  const { dark } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: dark ? '#111827' : '#FFFFFF',
          color: dark ? '#E8EDF5' : '#0F172A',
          border: `1px solid ${dark ? '#1E2D40' : '#D1DBE8'}`,
          borderRadius: 10,
          fontSize: 13,
        },
        success: { iconTheme: { primary: '#00D4AA', secondary: '#000' } },
        error: { iconTheme: { primary: '#FF5C6B', secondary: '#000' } },
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EntrepriseProvider>
          <BrowserRouter>
            <AppRoutes />
            <ToasterThemed />
          </BrowserRouter>
        </EntrepriseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
