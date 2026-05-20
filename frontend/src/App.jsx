import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { EntrepriseProvider } from './hooks/useEntreprise.jsx';
import { PermissionsProvider } from './hooks/usePermissions.jsx';
import { QuotasProvider } from './hooks/useQuotas.jsx';
import { ThemeProvider, useTheme } from './hooks/useTheme.jsx';
import { usePermissions } from './hooks/usePermissions.jsx';
import PermissionGate from './components/PermissionGate.jsx';
import QuotaGate from './components/QuotaGate.jsx';
import UpgradeModal from './components/UpgradeModal.jsx';
import CelebrationModal from './components/CelebrationModal.jsx';
import Layout from './components/Layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import InvitationPage from './pages/InvitationPage.jsx';
import TarifsPage from './pages/TarifsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DashboardRH from './pages/DashboardRH.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import FacturesPage from './pages/FacturesPage.jsx';
import DevisPage from './pages/DevisPage.jsx';
import RapportsPage from './pages/RapportsPage.jsx';
import DepensesPage from './pages/DepensesPage.jsx';
import TaxesPage from './pages/TaxesPage.jsx';
import ParametresPage from './pages/ParametresPage.jsx';
import AuditLogPage from './pages/AuditLogPage.jsx';
import ComptabilitePage from './pages/ComptabilitePage.jsx';
import TresoreriePage from './pages/TresoreriePage.jsx';
import RHPage from './pages/RHPage.jsx';
import ImmobilisationsPage from './pages/ImmobilisationsPage.jsx';
import ProduitsPage from './pages/ProduitsPage.jsx';
import FournisseursPage from './pages/FournisseursPage.jsx';

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

// Aiguillage du tableau de bord selon les permissions du rôle :
// - dashboard.read OK   -> DashboardPage (vue financière complète)
// - sinon dashboard_rh.read OK -> DashboardRH (masse salariale)
// - sinon Settings est la seule porte d'entrée raisonnable
const DashboardSwitch = () => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (can('dashboard', 'read')) return <DashboardPage />;
  if (can('dashboard_rh', 'read')) return <DashboardRH />;
  return <Navigate to="/parametres" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/invitation/:token" element={<InvitationPage />} />
      {/* /tarifs accessible publiquement (acquisition) ET en mode connecté
          (consultation/upgrade depuis l'app). Pas de wrapper Public car on
          ne veut pas rediriger un utilisateur connecté vers /dashboard. */}
      <Route path="/tarifs" element={<TarifsPage />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {/* Chaque route est protégée par PermissionGate qui interroge
            la matrice avant tout appel API : si refusé, page « Accès
            refusé » lisible plutôt qu'une page blanche avec erreurs. */}
        <Route path="dashboard" element={<DashboardSwitch />} />
        <Route path="dashboard-rh" element={<PermissionGate module="dashboard_rh"><DashboardRH /></PermissionGate>} />
        <Route path="clients" element={<PermissionGate module="clients"><ClientsPage /></PermissionGate>} />
        <Route path="devis" element={<PermissionGate module="devis"><DevisPage /></PermissionGate>} />
        <Route path="factures" element={<PermissionGate module="factures"><FacturesPage /></PermissionGate>} />
        <Route path="depenses" element={<PermissionGate module="depenses"><DepensesPage /></PermissionGate>} />
        <Route path="tresorerie" element={<PermissionGate module="tresorerie"><TresoreriePage /></PermissionGate>} />
        {/* QuotaGate après PermissionGate : on autorise d'abord par rôle,
            puis on bascule en lecture seule si la formule ne l'inclut pas.
            La page reste visible (découvrable) avec un bandeau d'upgrade. */}
        <Route path="paie" element={
          <PermissionGate module="paie">
            <QuotaGate feature="paie"><RHPage /></QuotaGate>
          </PermissionGate>
        } />
        <Route path="immobilisations" element={
          <PermissionGate module="immobilisations">
            <QuotaGate feature="immobilisations"><ImmobilisationsPage /></QuotaGate>
          </PermissionGate>
        } />
        <Route path="produits" element={<PermissionGate module="produits"><ProduitsPage /></PermissionGate>} />
        <Route path="fournisseurs" element={<PermissionGate module="fournisseurs"><FournisseursPage /></PermissionGate>} />
        <Route path="taxes" element={<PermissionGate module="taxes"><TaxesPage /></PermissionGate>} />
        <Route path="rapports" element={<PermissionGate module="rapports"><RapportsPage /></PermissionGate>} />
        <Route path="comptabilite" element={<PermissionGate module="ecritures"><ComptabilitePage /></PermissionGate>} />
        <Route path="audit-log" element={<PermissionGate module="audit_log"><AuditLogPage /></PermissionGate>} />
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
          <PermissionsProvider>
            <QuotasProvider>
              <BrowserRouter>
                <AppRoutes />
                <ToasterThemed />
                {/* Monté globalement pour pouvoir être ouvert depuis
                    l'intercepteur Axios sur une réponse 402. */}
                <UpgradeModal />
                {/* Modal chaleureuse affichée après un changement de
                    palier réussi. Déclenchée par ouvrirCelebrationModal()
                    depuis TarifsPage ou LoginPage. */}
                <CelebrationModal />
              </BrowserRouter>
            </QuotasProvider>
          </PermissionsProvider>
        </EntrepriseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
