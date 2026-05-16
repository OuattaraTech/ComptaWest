import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useEntreprise } from '../../hooks/useEntreprise.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { initiales } from '../../utils/helpers.jsx';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import {
  LayoutDashboard, Users, FileText, BarChart3, LogOut,
  Settings, ChevronRight, Receipt, Calculator, Plus,
  ChevronDown, Building2, Check, Sun, Moon, Shield, BookMarked, Wallet, UserCheck, Package, Box, Truck,
  FileSignature,
} from 'lucide-react';

// Le rôle "rh" ne voit que le tableau de bord et le module Paie & RH :
// tous les autres modules portent rolesRequis SANS_RH pour le masquer.
const SANS_RH = ['proprietaire', 'admin', 'comptable', 'user', 'lecture'];

// Items de navigation : on stocke la clé i18n à côté d'un libellé fallback
// (utilisé si la traduction est absente). Le label final est résolu par t().
const navItems = [
  { to: '/dashboard',       icon: LayoutDashboard, i18nKey: 'nav.dashboard',        label: 'Tableau de bord' },
  { to: '/clients',         icon: Users,           i18nKey: 'nav.clients',          label: 'Clients',           rolesRequis: SANS_RH },
  { to: '/fournisseurs',    icon: Truck,           i18nKey: 'nav.fournisseurs',     label: 'Fournisseurs',      rolesRequis: SANS_RH },
  { to: '/produits',        icon: Box,             i18nKey: 'nav.produits',         label: 'Produits & Stocks', rolesRequis: SANS_RH },
  { to: '/devis',           icon: FileSignature,   i18nKey: 'nav.devis',            label: 'Devis & Proformas', rolesRequis: SANS_RH },
  { to: '/factures',        icon: FileText,        i18nKey: 'nav.factures',         label: 'Factures',          rolesRequis: SANS_RH },
  { to: '/depenses',        icon: Receipt,         i18nKey: 'nav.depenses',         label: 'Dépenses',          rolesRequis: SANS_RH },
  { to: '/tresorerie',      icon: Wallet,          i18nKey: 'nav.tresorerie',       label: 'Trésorerie',        rolesRequis: SANS_RH },
  { to: '/immobilisations', icon: Package,         i18nKey: 'nav.immobilisations',  label: 'Immobilisations',   rolesRequis: ['proprietaire','admin','comptable'] },
  { to: '/paie',            icon: UserCheck,       i18nKey: 'nav.paie',             label: 'Paie & RH',         rolesRequis: ['proprietaire','admin','comptable','rh'] },
  { to: '/taxes',           icon: Calculator,      i18nKey: 'nav.taxes',            label: 'Taxes & Impôts',    rolesRequis: SANS_RH },
  { to: '/comptabilite',    icon: BookMarked,      i18nKey: 'nav.comptabilite',     label: 'Comptabilité',      rolesRequis: ['proprietaire','admin','comptable'] },
  { to: '/rapports',        icon: BarChart3,       i18nKey: 'nav.rapports',         label: 'Rapports',          rolesRequis: SANS_RH },
];

// Visible uniquement pour propriétaires et administrateurs
const adminItems = [
  { to: '/audit-log',  icon: Shield,  i18nKey: 'nav.audit_log',  label: 'Journal d’audit' },
];

// Couleurs par rôle ; le libellé est résolu via t('roles.<key>') au rendu.
const ROLE_COLORS = {
  proprietaire: { bg: '#F5A62322', color: '#F5A623' },
  admin:        { bg: '#4E8BF522', color: '#4E8BF5' },
  comptable:    { bg: '#00D4AA22', color: '#00D4AA' },
  rh:           { bg: '#A855F722', color: '#A855F7' },
  user:         { bg: '#6B7A9922', color: '#9BAACC' },
  lecture:      { bg: '#6B7A9922', color: '#6B7A99' },
};

export default function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { entreprises, actuelle, switchEntreprise, ajouterEntreprise } = useEntreprise();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showNewEnt, setShowNewEnt] = useState(false);
  const [newEntNom, setNewEntNom] = useState('');
  const [creating, setCreating] = useState(false);

  // Couleurs selon le thème
  const C = {
    bg:     dark ? '#0D1220' : '#FFFFFF',
    border: dark ? '#1E2D40' : '#E2EAF4',
    accent: '#00D4AA',
    text:   dark ? '#E8EDF5' : '#0F172A',
    muted:  dark ? '#6B7A99' : '#64748B',
    sub:    dark ? '#9BAACC' : '#475569',
    hover:  dark ? '#161F2E' : '#F1F5F9',
    gold:   '#F5A623',
    inputBg: dark ? '#0B0F1A' : '#F8FAFC',
    dropBg:  dark ? '#1A2235' : '#FFFFFF',
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleCreateEntreprise = async (e) => {
    e.preventDefault();
    if (!newEntNom.trim()) return;
    setCreating(true);
    try {
      const ent = await ajouterEntreprise({ nom: newEntNom });
      switchEntreprise(ent);
      setShowNewEnt(false);
      setNewEntNom('');
      setShowSwitcher(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const roleInfo = ROLE_COLORS[actuelle?.role] || ROLE_COLORS.user;
  const estAdmin = actuelle?.role === 'proprietaire' || actuelle?.role === 'admin';

  return (
    <aside style={{
      width: 240, height: '100vh', background: C.bg,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #00D4AA, #00A882)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 900, color: '#000',
          }}>₣</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>ComptaWest</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.06em' }}>SYSCOHADA · v2</div>
          </div>
        </div>

        {/* Switcher entreprise */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSwitcher(s => !s)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.hover, cursor: 'pointer', textAlign: 'left',
          }}>
            <Building2 size={14} color={C.accent} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {actuelle?.nom || 'Sélectionner...'}
              </div>
              <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: roleInfo.bg, color: roleInfo.color, display: 'inline-block', marginTop: 2 }}>
                {t(`roles.${actuelle?.role || 'user'}`)}
              </div>
            </div>
            <ChevronDown size={13} color={C.muted} style={{ flexShrink: 0, transform: showSwitcher ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showSwitcher && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
              background: C.dropBg, border: `1px solid ${C.border}`, borderRadius: 12,
              overflow: 'hidden', boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
            }}>
              {entreprises.map(e => (
                <button key={e.id} onClick={() => { switchEntreprise(e); setShowSwitcher(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: 'none', background: e.id === actuelle?.id ? C.hover : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, #00D4AA60, #4E8BF560)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: C.text,
                  }}>{initiales(e.nom)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nom}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{e.forme_juridique}</div>
                  </div>
                  {e.id === actuelle?.id && <Check size={13} color={C.accent} />}
                </button>
              ))}

              {!showNewEnt ? (
                <button onClick={() => setShowNewEnt(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', border: 'none', borderTop: `1px solid ${C.border}`,
                  background: 'transparent', cursor: 'pointer', color: C.accent, fontSize: 12, fontWeight: 600,
                }}>
                  <Plus size={13} /> Nouvelle entreprise
                </button>
              ) : (
                <form onSubmit={handleCreateEntreprise} style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
                  <input value={newEntNom} onChange={e => setNewEntNom(e.target.value)}
                    placeholder={t('login.company_name')} autoFocus
                    style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', marginBottom: 7, fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setShowNewEnt(false)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
                    <button type="submit" disabled={creating} style={{ flex: 2, padding: '6px 0', borderRadius: 7, border: 'none', background: C.accent, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {creating ? '...' : t('common.create')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation — défile si le contenu dépasse la hauteur d'écran */}
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.1em', padding: '6px 8px 3px', textTransform: 'uppercase' }}>
          {t('common.menu')}
        </div>
        {navItems
          .filter(item => !item.rolesRequis || item.rolesRequis.includes(actuelle?.role))
          .map(({ to, icon: Icon, label, i18nKey }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 10px', borderRadius: 9, textDecoration: 'none',
            fontSize: 13, fontWeight: isActive ? 700 : 500,
            color: isActive ? C.accent : C.sub,
            background: isActive ? `${C.accent}15` : 'transparent',
            transition: 'all 0.15s',
            border: isActive ? `1px solid ${C.accent}30` : '1px solid transparent',
          })}>
            {({ isActive }) => (
              <>
                <Icon size={16} />
                <span style={{ flex: 1 }}>{i18nKey ? t(i18nKey) : label}</span>
                {isActive && <ChevronRight size={13} />}
              </>
            )}
          </NavLink>
        ))}

        {estAdmin && (
          <>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.1em', padding: '14px 8px 3px', textTransform: 'uppercase' }}>
              {t('common.administration')}
            </div>
            {adminItems.map(({ to, icon: Icon, label, i18nKey }) => (
              <NavLink key={to} to={to} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 10px', borderRadius: 9, textDecoration: 'none',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? C.accent : C.sub,
                background: isActive ? `${C.accent}15` : 'transparent',
                transition: 'all 0.15s',
                border: isActive ? `1px solid ${C.accent}30` : '1px solid transparent',
              })}>
                {({ isActive }) => (
                  <>
                    <Icon size={16} />
                    <span style={{ flex: 1 }}>{i18nKey ? t(i18nKey) : label}</span>
                    {isActive && <ChevronRight size={13} />}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer — toujours visible, ne se comprime pas */}
      <div style={{ padding: '10px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* Toggle Dark/Light */}
        <button onClick={toggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`,
          background: C.hover, cursor: 'pointer', marginBottom: 6, transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dark
              ? <Sun size={15} color="#F5A623" />
              : <Moon size={15} color="#4E8BF5" />
            }
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
              {dark ? t('parametres.theme_light') : t('parametres.theme_dark')}
            </span>
          </div>
          {/* Toggle switch */}
          <div style={{
            width: 34, height: 18, borderRadius: 9,
            background: dark ? '#1E2D40' : '#D1DBE8',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: dark ? C.accent : '#4E8BF5',
              position: 'absolute', top: 2,
              left: dark ? 2 : 18,
              transition: 'left 0.2s, background 0.2s',
            }} />
          </div>
        </button>

        {/* Sélecteur de langue compact */}
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
          <LanguageSwitcher C={{ ...C, accent: '#00D4AA' }} dark={dark} />
        </div>

        <NavLink to="/parametres" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 9, textDecoration: 'none',
          fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 4,
        }}>
          <Settings size={15} /> {t('common.settings')}
        </NavLink>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 10px', borderRadius: 9, background: C.hover, marginBottom: 7,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #F5A623, #E08C1A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#000',
          }}>{initiales(user?.nom || 'U')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.nom}</div>
            <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>

        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '8px 0', borderRadius: 9, border: `1px solid ${C.border}`,
          background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5C6B50'; e.currentTarget.style.color = '#FF5C6B'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
        >
          <LogOut size={13} /> {t('common.logout')}
        </button>
      </div>
    </aside>
  );
}
