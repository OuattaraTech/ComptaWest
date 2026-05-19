import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { Menu, X } from 'lucide-react';

// Largeur fixe de la sidebar sur desktop. Sur mobile (≤ 960 px), la sidebar
// devient un drawer slide-in et le contenu principal occupe toute la largeur.
const SIDEBAR_WIDTH = 240;
const MOBILE_BP = 960;

export default function Layout() {
  const { dark } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_BP
  );

  // Réagit aux changements de taille d'écran : passe en/hors mode mobile et
  // ferme automatiquement le drawer si on repasse en desktop.
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth <= MOBILE_BP;
      setIsMobile(m);
      if (!m) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Ferme automatiquement le drawer à chaque navigation pour ne pas masquer
  // le contenu de la page après un clic dans la sidebar.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Empêche le scroll du body quand le drawer est ouvert (sinon on peut
  // scroller le contenu derrière l'overlay).
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: dark ? '#0B0F1A' : '#F0F4F8' }}>
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} isMobile={isMobile} />

      {/* Bouton burger : visible uniquement sur mobile */}
      {isMobile && (
        <button onClick={() => setMobileOpen(o => !o)} aria-label="Menu"
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 200,
            width: 40, height: 40, borderRadius: 10,
            background: dark ? '#161F2E' : '#FFFFFF',
            border: `1px solid ${dark ? '#1E2D40' : '#E2EAF4'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? '#E8EDF5' : '#0F172A',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      )}

      {/* Overlay noir quand le drawer est ouvert (mobile) — clic ferme */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
          }} />
      )}

      <main style={{
        marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
        paddingTop: isMobile ? 60 : 0,
        // Le FAB d'onboarding (bouton flottant « ? ») est positionné en
        // bottom:24 avec une taille de 48px. Sans réserve d'espace en
        // bas, il masque la pagination et les boutons d'action de toutes
        // les pages quand on scrolle jusqu'en bas. 88px = 24 + 48 + 16
        // (marge de confort pour le focus-ring du FAB).
        paddingBottom: 88,
        flex: 1, minHeight: '100vh', overflow: 'auto', minWidth: 0,
      }}>
        <Outlet />
      </main>
    </div>
  );
}
