import { useState, useEffect } from 'react';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import api from '../utils/api.jsx';
import { formatDate, initiales } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { Users, Building2, Plus, X, Edit2, Trash2, Shield, Save } from 'lucide-react';

export default function ParametresPage() {
  const { dark } = useTheme();
  const C = getC(dark);
  const { actuelle, chargerEntreprises } = useEntreprise();
  const [tab, setTab] = useState('entreprise');
  const [membres, setMembres] = useState([]);
  const [form, setForm] = useState({});
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user', nom: '' });
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

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
    } catch { toast.error('Erreur chargement membres'); }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveEntreprise = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/entreprises/${actuelle.id}`, form);
      await chargerEntreprises();
      toast.success('Paramètres sauvegardés');
    } catch { toast.error('Erreur sauvegarde'); }
    finally { setSaving(false); }
  };

  const handleInviter = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/entreprises/${actuelle.id}/membres`, inviteForm);
      toast.success(`${inviteForm.email} invité en tant que ${inviteForm.role}`);
      setShowInvite(false);
      setInviteForm({ email: '', role: 'user', nom: '' });
      fetchMembres();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur invitation'); }
  };

  const handleChangeRole = async (userId, role) => {
    try {
      await api.put(`/entreprises/${actuelle.id}/membres/${userId}/role`, { role });
      toast.success('Rôle mis à jour');
      fetchMembres();
    } catch { toast.error('Erreur mise à jour rôle'); }
  };

  const handleRetirerMembre = async (userId) => {
    if (!confirm('Retirer ce membre ?')) return;
    try {
      await api.delete(`/entreprises/${actuelle.id}/membres/${userId}`);
      toast.success('Membre retiré');
      fetchMembres();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  if (!actuelle) return (
    <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>Aucune entreprise sélectionnée</div>
  );

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Paramètres</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{actuelle.nom}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {[
          { id: 'entreprise', icon: Building2, label: 'Entreprise' },
          { id: 'membres', icon: Users, label: `Membres (${membres.length})` },
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
        <form onSubmit={handleSaveEntreprise} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Informations générales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label="Raison sociale *" value={form.nom} onChange={set('nom')} placeholder="SARL MonEntreprise" />
              <Input label="Sigle" value={form.sigle} onChange={set('sigle')} placeholder="ME" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forme juridique</label>
                <select value={form.forme_juridique} onChange={set('forme_juridique')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {FORMES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Régime fiscal</label>
                <select value={form.regime_fiscal} onChange={set('regime_fiscal')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {REGIMES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taux TVA (%)</label>
                <input type="number" value={form.taux_tva} onChange={set('taux_tva')} min="0" max="100"
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <Input label="Secteur d'activité" value={form.secteur} onChange={set('secteur')} placeholder="Services informatiques, Commerce..." />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Contact & Localisation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="contact@entreprise.ci" />
              <Input label="Téléphone" value={form.telephone} onChange={set('telephone')} placeholder="+225 27 00 00 00" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input label="Adresse" value={form.adresse} onChange={set('adresse')} placeholder="Rue des Jardins, Cocody" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="Ville" value={form.ville} onChange={set('ville')} placeholder="Abidjan" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pays</label>
                <select value={form.pays} onChange={set('pays')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {PAYS_LIST.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Identification fiscale</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="NINEA / NIF" value={form.ninea} onChange={set('ninea')} placeholder="CI-2020-A-12345" />
              <Input label="RCCM" value={form.rccm} onChange={set('rccm')} placeholder="RCC/ABJ/2020/B/1234" />
            </div>
          </div>

          <button type="submit" disabled={saving} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: C.accent, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: 'fit-content',
          }}>
            <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
          </button>
        </form>
      )}

      {/* Tab Membres */}
      {tab === 'membres' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Légende des rôles */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Rôles et permissions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {Object.entries(ROLES).map(([key, r]) => (
                <div key={key} style={{ background: C.hover, borderRadius: 10, padding: '12px 14px', border: `1px solid ${r.color}30` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: r.color, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Liste membres */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Membres de l'équipe ({membres.length})</div>
              <button onClick={() => setShowInvite(s => !s)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
                border: 'none', background: C.accent, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                <Plus size={14} /> Inviter un membre
              </button>
            </div>

            {/* Formulaire invitation */}
            {showInvite && (
              <div style={{ padding: '20px 24px', background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                <form onSubmit={handleInviter} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 0 200px' }}>
                    <Input label="Email *" type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="collaborateur@exemple.ci" />
                  </div>
                  <div style={{ flex: '1 0 140px' }}>
                    <Input label="Nom (optionnel)" value={inviteForm.nom} onChange={e => setInviteForm(f => ({ ...f, nom: e.target.value }))} placeholder="Prénom Nom" />
                  </div>
                  <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rôle</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                      {Object.entries(ROLES).filter(([k]) => k !== 'proprietaire').map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: C.accent, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    Inviter
                  </button>
                </form>
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
                  <div style={{ fontSize: 11, color: C.muted }}>Depuis {formatDate(m.created_at)}</div>
                  {m.role !== 'proprietaire' ? (
                    <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                      style={{ background: `${roleInfo.color}20`, border: `1px solid ${roleInfo.color}50`, borderRadius: 8, padding: '6px 10px', color: roleInfo.color, fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {Object.entries(ROLES).filter(([k]) => k !== 'proprietaire').map(([k, v]) => (
                        <option key={k} value={k} style={{ background: C.card, color: C.text }}>{v.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: `${roleInfo.color}20`, color: roleInfo.color, fontWeight: 700 }}>
                      {roleInfo.label}
                    </span>
                  )}
                  {m.role !== 'proprietaire' && (
                    <button onClick={() => handleRetirerMembre(m.id)}
                      style={{ padding: '6px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


