import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import api from '../utils/api.jsx';
import { formatDate, initiales } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { Users, Building2, Plus, X, Edit2, Trash2, Shield, Save, Copy, Link2, Globe } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC, Input } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

// ─── Référentiels ──────────────────────────────────────────────────────────
// Formes juridiques courantes en zone OHADA / Côte d'Ivoire
const FORMES = [
  'SARL', 'SARLU', 'SA', 'SAS', 'SUARL', 'SNC', 'SCS',
  'Entreprise individuelle', 'GIE', 'SCI', 'Coopérative', 'Association', 'Autre',
];

// Régimes fiscaux applicables en Côte d'Ivoire
const REGIMES = [
  'RSI',           // Réel Simplifié d'Imposition
  'RNI',           // Réel Normal d'Imposition
  'Microentreprise',
  'BIC',           // Bénéfices Industriels et Commerciaux
  'BNC',           // Bénéfices Non Commerciaux
  'Exonéré',
];

// Pays UEMOA / CEMAC les plus fréquents
const PAYS_LIST = [
  "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Bénin', 'Togo',
  'Niger', 'Guinée-Bissau', 'Cameroun', 'Gabon', 'Congo', 'Tchad', 'Autre',
];

// Rôles d'accès — alignés sur les permissions du backend (middleware/entreprise.js)
const ROLES = {
  proprietaire: { labelKey: 'roles.proprietaire', color: '#F5A623', descKey: 'parametres.role_proprietaire_desc' },
  admin:        { labelKey: 'roles.admin',        color: '#4E8BF5', descKey: 'parametres.role_admin_desc' },
  comptable:    { labelKey: 'roles.comptable',    color: '#00D4AA', descKey: 'parametres.role_comptable_desc' },
  rh:           { labelKey: 'roles.rh',           color: '#A855F7', descKey: 'parametres.role_rh_desc' },
  user:         { labelKey: 'roles.user',         color: '#9BAACC', descKey: 'parametres.role_user_desc' },
  lecture:      { labelKey: 'roles.lecture',      color: '#6B7A99', descKey: 'parametres.role_lecture_desc' },
};

function PreferencesTab({ C }) {
  const { t } = useTranslation();
  return (
    <div data-onboarding="form-preferences" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Globe size={18} color={C.accent} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('parametres.language_label')}</div>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          {t('parametres.language_help')}
        </div>
        <div style={{ maxWidth: 320 }}>
          <LanguageSwitcher variant="dropdown" C={C} />
        </div>
      </div>
    </div>
  );
}

export default function ParametresPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const { actuelle, chargerEntreprises } = useEntreprise();
  const [tab, setTab] = useState('entreprise');
  const [membres, setMembres] = useState([]);
  const [form, setForm] = useState({});
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user', nom: '' });
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invitationGeneree, setInvitationGeneree] = useState(null);  // { email, role, lien_invitation, compte_existant }

  useEffect(() => {
    if (actuelle) {
      setForm({
        nom: actuelle.nom || '', sigle: actuelle.sigle || '',
        forme_juridique: actuelle.forme_juridique || 'SARL',
        secteur: actuelle.secteur || '', email: actuelle.email || '',
        telephone: actuelle.telephone || '', adresse: actuelle.adresse || '',
        ville: actuelle.ville || '', pays: actuelle.pays || "Côte d'Ivoire",
        ninea: actuelle.ninea || '', rccm: actuelle.rccm || '',
        regime_fiscal: actuelle.regime_fiscal || 'RSI',
        taux_tva: actuelle.taux_tva || 18,
      });
      fetchMembres();
    }
  }, [actuelle?.id]);

  const fetchMembres = async () => {
    try {
      const res = await api.get(`/entreprises/${actuelle.id}/membres`);
      setMembres(res.data.data);
    } catch { toast.error(t('parametres.err_load_members')); }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveEntreprise = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/entreprises/${actuelle.id}`, form);
      await chargerEntreprises();
      toast.success(t('parametres.toast_saved'));
    } catch { toast.error(t('parametres.toast_save_err')); }
    finally { setSaving(false); }
  };

  const handleInviter = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/entreprises/${actuelle.id}/membres`, inviteForm);
      const data = res.data.data || {};
      const emailInvite = inviteForm.email;
      setShowInvite(false);
      setInviteForm({ email: '', role: 'user', nom: '' });
      fetchMembres();
      if (data.lien_invitation) {
        // Nouveau compte : on affiche le lien à transmettre
        setInvitationGeneree({
          email: emailInvite,
          role: data.role,
          lien_invitation: window.location.origin + data.lien_invitation,
          compte_existant: false,
        });
      } else {
        // Compte déjà existant : accès immédiat, pas de lien
        toast.success(t('parametres.account_exists', { email: emailInvite }));
      }
    } catch (err) { toast.error(err.response?.data?.message || t('parametres.err_invite')); }
  };

  const copierLien = () => {
    if (!invitationGeneree) return;
    navigator.clipboard.writeText(invitationGeneree.lien_invitation)
      .then(() => toast.success(t('parametres.copy_success')))
      .catch(() => toast.error(t('parametres.copy_failed')));
  };

  const handleChangeRole = async (userId, role) => {
    try {
      await api.put(`/entreprises/${actuelle.id}/membres/${userId}/role`, { role });
      toast.success(t('parametres.role_changed'));
      fetchMembres();
    } catch (err) {
      toast.error(err.response?.data?.message || t('parametres.err_role_update'));
      fetchMembres();  // resynchronise le sélecteur sur la valeur réelle
    }
  };

  const handleRetirerMembre = async (userId) => {
    if (!confirm(t('parametres.remove_member'))) return;
    try {
      await api.delete(`/entreprises/${actuelle.id}/membres/${userId}`);
      toast.success(t('parametres.removed'));
      fetchMembres();
    } catch (err) { toast.error(err.response?.data?.message || t('parametres.err_generic')); }
  };

  if (!actuelle) return (
    <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>{t('parametres.no_company')}</div>
  );

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('parametres.title')}</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{actuelle.nom}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {[
          { id: 'entreprise',  icon: Building2, label: t('parametres.company') },
          { id: 'membres',     icon: Users,     label: `${t('parametres.members')} (${membres.length})` },
          { id: 'preferences', icon: Globe,     label: t('parametres.preferences') },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === id ? C.accent : '#161F2E', color: tab === id ? '#000' : C.muted,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Entreprise */}
      {tab === 'entreprise' && (
        <form data-onboarding="form-entreprise" onSubmit={handleSaveEntreprise} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.company_info')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label={`${t('parametres.company_name')} *`} value={form.nom} onChange={set('nom')} placeholder="SARL MonEntreprise" />
              <Input label={t('parametres.sigle')} value={form.sigle} onChange={set('sigle')} placeholder="ME" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.legal_form')}</label>
                <select value={form.forme_juridique} onChange={set('forme_juridique')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {FORMES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.tax_regime')}</label>
                <select value={form.regime_fiscal} onChange={set('regime_fiscal')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {REGIMES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.tva_rate')}</label>
                <input type="number" value={form.taux_tva} onChange={set('taux_tva')} min="0" max="100"
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <Input label={t('parametres.sector')} value={form.secteur} onChange={set('secteur')} placeholder="Services informatiques, Commerce..." />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.contact_section')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label={t('common.email')} type="email" value={form.email} onChange={set('email')} placeholder="contact@entreprise.ci" />
              <Input label={t('common.phone')} value={form.telephone} onChange={set('telephone')} placeholder="+225 27 00 00 00" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input label={t('common.address')} value={form.adresse} onChange={set('adresse')} placeholder="Rue des Jardins, Cocody" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label={t('common.city')} value={form.ville} onChange={set('ville')} placeholder="Abidjan" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.country')}</label>
                <select value={form.pays} onChange={set('pays')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {PAYS_LIST.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.fiscal_id_section')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label={t('parametres.ninea')} value={form.ninea} onChange={set('ninea')} placeholder="CI-2020-A-12345" />
              <Input label={t('parametres.rccm')} value={form.rccm} onChange={set('rccm')} placeholder="RCC/ABJ/2020/B/1234" />
            </div>
          </div>

          <button type="submit" disabled={saving} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: C.accent, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: 'fit-content',
          }}>
            <Save size={16} /> {saving ? t('parametres.saving') : t('parametres.save_changes')}
          </button>
        </form>
      )}

      {/* Tab Préférences */}
      {tab === 'preferences' && <PreferencesTab C={C} />}

      {/* Tab Membres */}
      {tab === 'membres' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Légende des rôles */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{t('parametres.roles_legend')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {Object.entries(ROLES).map(([key, r]) => (
                <div key={key} style={{ background: C.hover, borderRadius: 10, padding: '12px 14px', border: `1px solid ${r.color}30` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: r.color, marginBottom: 4 }}>{t(r.labelKey)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t(r.descKey)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Liste membres */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t('parametres.team_members', { count: membres.length })}</div>
              <button onClick={() => setShowInvite(s => !s)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
                border: 'none', background: C.accent, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                <Plus size={14} /> {t('parametres.invite_member')}
              </button>
            </div>

            {/* Formulaire invitation */}
            {showInvite && (
              <div style={{ padding: '20px 24px', background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                <form onSubmit={handleInviter} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 0 200px' }}>
                    <Input label={t('parametres.invite_email')} type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder={t('parametres.invite_email_placeholder')} />
                  </div>
                  <div style={{ flex: '1 0 140px' }}>
                    <Input label={t('parametres.invite_name')} value={inviteForm.nom} onChange={e => setInviteForm(f => ({ ...f, nom: e.target.value }))} placeholder={t('parametres.invite_name_placeholder')} />
                  </div>
                  <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.invite_role')}</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                      {Object.entries(ROLES).filter(([k]) => k !== 'proprietaire').map(([k, v]) => (
                        <option key={k} value={k}>{t(v.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: C.accent, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {t('parametres.invite_submit')}
                  </button>
                </form>
              </div>
            )}

            {/* Lien d'invitation généré — à transmettre au nouveau membre */}
            {invitationGeneree && (
              <div style={{
                padding: '18px 24px', background: `${C.accent}10`,
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <Link2 size={16} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {t('parametres.link_title', { email: invitationGeneree.email })}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {t('parametres.link_help')}
                    </div>
                  </div>
                  <button onClick={() => setInvitationGeneree(null)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0 }}>
                    <X size={15} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={invitationGeneree.lien_invitation}
                    onFocus={e => e.target.select()}
                    style={{
                      flex: 1, background: C.input, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '9px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }} />
                  <button onClick={copierLien} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                    border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <Copy size={13} /> {t('parametres.btn_copy')}
                  </button>
                </div>
              </div>
            )}

            {membres.map((m, i) => {
              const roleInfo = ROLES[m.role] || ROLES.user;
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 24px', borderBottom: i < membres.length - 1 ? `1px solid ${C.border}22` : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161F2E'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${roleInfo.color}80, ${roleInfo.color}40)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#fff',
                  }}>{initiales(m.nom)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.nom}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t('parametres.member_since', { date: formatDate(m.created_at) })}</div>
                  {/* Le rôle de tout membre est modifiable (y compris propriétaire) ;
                      le backend empêche de retirer/rétrograder le dernier propriétaire. */}
                  <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                    style={{ background: `${roleInfo.color}20`, border: `1px solid ${roleInfo.color}50`, borderRadius: 8, padding: '6px 10px', color: roleInfo.color, fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {Object.entries(ROLES).map(([k, v]) => (
                      <option key={k} value={k} style={{ background: C.card, color: C.text }}>{t(v.labelKey)}</option>
                    ))}
                  </select>
                  <button onClick={() => handleRetirerMembre(m.id)}
                    title={t('parametres.member_remove_tooltip')}
                    style={{ padding: '6px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Onboarding pageKey="parametres" />
    </div>
  );
}


