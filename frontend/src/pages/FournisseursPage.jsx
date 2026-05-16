import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, initiales, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input, AlerteSolde, evaluerSortie } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import {
  Plus, Search, Edit2, Trash2, FileText, ChevronLeft, Eye,
  ShoppingCart, Truck, CheckCircle, Send, AlertTriangle, Clock,
  Calendar, X, ArrowRight, CreditCard, Mail, Phone, MapPin,
  Building2, Users, TrendingUp, Receipt,
} from 'lucide-react';

const fmt = (n) => formatFCFA(n, false);
const fmtQ = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(parseFloat(n) || 0);

// Couleurs des statuts BC ; les libellés sont résolus via t('statut.*') au rendu.
const STATUT_BC_COLORS = {
  brouillon:    { bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' },
  envoyee:      { bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
  receptionnee: { bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
  facturee:     { bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
  annulee:      { bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
};

const URGENCE_COLORS = {
  retard: { color: '#C01833', bg: '#FF5C6B20' },
  urgent: { color: '#A0660A', bg: '#F5A62325' },
  proche: { color: '#1A52B0', bg: '#4E8BF520' },
  futur:  { color: '#6B7A99', bg: '#6B7A9920' },
};

export default function FournisseursPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const [tab, setTab] = useState('liste');
  const [selected, setSelected] = useState(null);
  const [selectedBC, setSelectedBC] = useState(null);

  if (selected) return <FournisseurDetail id={selected} onBack={() => setSelected(null)} C={C} dark={dark} />;
  if (selectedBC) return <CommandeDetail id={selectedBC} onBack={() => setSelectedBC(null)} C={C} dark={dark} />;

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('fournisseurs.title')}</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{t('fournisseurs.subtitle')}</p>
      </div>

      <StatsBandeau C={C} dark={dark} />

      <div data-onboarding="tabs" style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {[
          { id: 'liste',       label: t('fournisseurs.tab_list'),     icon: Building2 },
          { id: 'commandes',   label: t('fournisseurs.tab_orders'),   icon: ShoppingCart },
          { id: 'echeancier',  label: t('fournisseurs.tab_schedule'), icon: Calendar },
        ].map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? C.text : C.muted,
              background: active ? C.cardAlt : 'transparent', cursor: 'pointer',
            }}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'liste'      && <ListeTab onSelect={setSelected} C={C} dark={dark} />}
      {tab === 'commandes'  && <CommandesTab onSelect={setSelectedBC} C={C} dark={dark} />}
      {tab === 'echeancier' && <EcheancierTab C={C} dark={dark} />}

      <Onboarding pageKey="fournisseurs" />
    </div>
  );
}

// ─── KPI BANDEAU ──────────────────────────────────────────────────────────
function StatsBandeau({ C, dark }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/fournisseurs/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);
  if (!stats) return null;

  return (
    <div data-onboarding="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
      {[
        { label: t('fournisseurs.stat_actifs'),   val: stats.nb_actifs,    color: C.blue,  icon: Building2,     fmt: 'count' },
        { label: t('fournisseurs.stat_encours'),  val: stats.encours_total, color: C.gold,  icon: TrendingUp },
        { label: t('fournisseurs.stat_retard'),   val: stats.nb_retard,    color: C.red,   icon: AlertTriangle, fmt: 'count' },
        { label: t('fournisseurs.stat_year'),     val: stats.annee,        color: C.muted, icon: Calendar,      fmt: 'count' },
      ].map((k, i) => (
        <div key={i} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '18px 20px', position: 'relative', overflow: 'hidden', boxShadow: C.shadow,
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 55, height: 55,
            background: `radial-gradient(circle at top right, ${k.color}25, transparent 70%)`,
            borderRadius: '0 14px 0 55px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{k.label}</span>
            <k.icon size={14} color={k.color} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
            {k.fmt === 'count' ? k.val : fmt(k.val)}
            {k.fmt !== 'count' && <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{t('common.currency')}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET LISTE
// ═══════════════════════════════════════════════════════════════════════════
function ListeTab({ onSelect, C, dark }) {
  const { t } = useTranslation();
  const [fournisseurs, setFournisseurs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/fournisseurs?search=${encodeURIComponent(search)}&limit=100`);
      setFournisseurs(res.data.data);
    } catch { toast.error(t('fournisseurs.error_load')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (f) => {
    if (!confirm(t('fournisseurs.confirm_archive', { nom: f.nom }))) return;
    try { await api.delete(`/fournisseurs/${f.id}`); toast.success(t('fournisseurs.archived')); fetchData(); }
    catch { toast.error(t('fournisseurs.error_load')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 0 280px', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('fournisseurs.search_placeholder')}
            style={{ width: '100%', background: C.card, border: `1.5px solid ${C.border}`,
              borderRadius: 10, padding: '10px 12px 10px 36px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <button data-onboarding="btn-nouveau" onClick={() => { setEditing(null); setShowForm(true); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> {t('fournisseurs.new')}
        </button>
      </div>

      <div data-onboarding="liste" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('common.code'),
                t('fournisseurs.col_supplier'),
                t('fournisseurs.col_contact'),
                t('fournisseurs.col_city'),
                t('fournisseurs.code_aux'),
                t('fournisseurs.col_expenses'),
                t('common.total_billed'),
                t('fournisseurs.col_encours'),
                '',
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : fournisseurs.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {search ? t('clients.no_results') : t('fournisseurs.empty')}
              </td></tr>
            ) : fournisseurs.map(f => (
              <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onClick={() => onSelect(f.id)}
                onMouseEnter={e => e.currentTarget.style.background = C.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{f.code}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.gold}60, ${C.red}60)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: dark ? '#000' : '#fff',
                    }}>{initiales(f.nom)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{truncate(f.nom, 28)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{f.type}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: C.sub }}>{f.email || '—'}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{f.telephone || '—'}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{f.ville || '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{f.code_auxiliaire || '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.text }}>{f.nb_depenses || 0}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.red }}>{fmt(f.total_facture)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                            color: parseFloat(f.encours) > 0 ? C.gold : C.muted }}>
                  {parseFloat(f.encours) > 0 ? fmt(f.encours) : '—'}
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => { setEditing(f); setShowForm(true); }}
                      style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(f)}
                      style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <FournisseurFormModal fournisseur={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); toast.success(editing ? t('fournisseurs.saved') : t('fournisseurs.created')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

// ─── MODAL FORM FOURNISSEUR ────────────────────────────────────────────────
export function FournisseurFormModal({ fournisseur, onClose, onSaved, C, dark, initialNom }) {
  const { t } = useTranslation();
  const isEdit = !!fournisseur;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(fournisseur || {
    code: '', nom: initialNom || '', type: 'entreprise', email: '', telephone: '',
    contact_principal: '', adresse: '', ville: '', pays: 'Côte d\'Ivoire',
    ninea: '', rccm: '', delai_paiement_jours: 30, mode_paiement_defaut: 'virement',
    banque: '', rib: '', numero_mobile_money: '', notes: '',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.nom) { toast.error(t('fournisseurs.field_legal_name')); return; }
    setSaving(true);
    try {
      let res;
      if (isEdit) res = await api.put(`/fournisseurs/${fournisseur.id}`, form);
      else res = await api.post('/fournisseurs', form);
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('fournisseurs.error_save'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={isEdit ? `${t('fournisseurs.edit')} — ${fournisseur.nom}` : t('fournisseurs.new')} onClose={onClose} width={600}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Input label={t('common.code')} value={form.code} onChange={set('code')} placeholder="F-0001" />
          <Input label={`${t('fournisseurs.field_legal_name')} *`} value={form.nom} onChange={set('nom')} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('fournisseurs.field_type')}</label>
            <select value={form.type} onChange={set('type')} style={selectStyle}>
              <option value="entreprise">{t('clients.type_company')}</option>
              <option value="particulier">{t('clients.type_individual')}</option>
              <option value="administration">{t('common.administration')}</option>
            </select>
          </div>
          <Input label={t('fournisseurs.section_contact')} value={form.contact_principal} onChange={set('contact_principal')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('common.email')} type="email" value={form.email} onChange={set('email')} />
          <Input label={t('common.phone')} value={form.telephone} onChange={set('telephone')} placeholder="+225 07 00 00 00" />
        </div>

        <Input label={t('common.address')} value={form.adresse} onChange={set('adresse')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('common.city')} value={form.ville} onChange={set('ville')} placeholder="Abidjan" />
          <Input label={t('common.country')} value={form.pays} onChange={set('pays')} />
        </div>

        {form.type === 'entreprise' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('parametres.ninea')} value={form.ninea} onChange={set('ninea')} placeholder="CI-2024-..." />
            <Input label={t('parametres.rccm')} value={form.rccm} onChange={set('rccm')} />
          </div>
        )}

        <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            {t('fournisseurs.section_payment')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('fournisseurs.delay_days')} type="number" value={form.delai_paiement_jours} onChange={set('delai_paiement_jours')} placeholder="30" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('fournisseurs.default_mode')}</label>
              <select value={form.mode_paiement_defaut} onChange={set('mode_paiement_defaut')} style={selectStyle}>
                <option value="virement">{t('fournisseurs.mode_virement')}</option>
                <option value="mobile_money">{t('fournisseurs.mode_mobile_money')}</option>
                <option value="cheque">{t('fournisseurs.mode_cheque')}</option>
                <option value="cash">{t('fournisseurs.mode_cash')}</option>
                <option value="carte">{t('fournisseurs.mode_carte')}</option>
              </select>
            </div>
          </div>
          {form.mode_paiement_defaut === 'virement' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 12 }}>
              <Input label={t('fournisseurs.field_bank')} value={form.banque} onChange={set('banque')} placeholder="BICICI" />
              <Input label={t('fournisseurs.field_rib')} value={form.rib} onChange={set('rib')} />
            </div>
          )}
          {form.mode_paiement_defaut === 'mobile_money' && (
            <div style={{ marginTop: 12 }}>
              <Input label={t('fournisseurs.field_mobile_money')} value={form.numero_mobile_money} onChange={set('numero_mobile_money')} placeholder="+225 07 ..." />
            </div>
          )}
        </div>

        <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : isEdit ? t('common.save') : t('fournisseurs.create_button')}</button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VUE DÉTAIL FOURNISSEUR
// ═══════════════════════════════════════════════════════════════════════════
function FournisseurDetail({ id, onBack, C, dark }) {
  const { t } = useTranslation();
  const [f, setF] = useState(null);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaiement, setShowPaiement] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fr, p] = await Promise.all([
        api.get(`/fournisseurs/${id}`),
        api.get(`/fournisseurs/${id}/paiements`),
      ]);
      setF(fr.data.data);
      setPaiements(p.data.data);
    } catch { toast.error(t('fournisseurs.error_load')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !f) {
    return (
      <div style={{ padding: '32px 36px', background: C.bg, minHeight: '100vh' }}>
        <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back')}</button>
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back_to_list')}</button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginTop: 18, marginBottom: 22, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `linear-gradient(135deg, ${C.gold}60, ${C.red}60)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: dark ? '#000' : '#fff',
            }}>{initiales(f.nom)}</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{f.nom}</h1>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {t('common.code')} <strong style={{ color: C.accent, fontFamily: 'monospace' }}>{f.code}</strong>
                {' · '}{t('fournisseurs.code_aux')} <strong style={{ color: C.text, fontFamily: 'monospace' }}>{f.code_auxiliaire}</strong>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowEdit(true)} style={btnSec(C)}><Edit2 size={13} /> {t('common.edit')}</button>
            <button onClick={() => setShowPaiement({})} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CreditCard size={13} /> {t('fournisseurs.pay_button')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 22 }}>
          {[
            { l: t('common.total_billed'),         v: f.total_facture, color: C.text },
            { l: t('fournisseurs.col_encours'),    v: f.encours, color: C.gold },
            { l: t('fournisseurs.delay_days'),     v: t('fournisseurs.delay_days_value', { n: f.delai_paiement_jours }), color: C.muted, fmt: 'text' },
            { l: t('fournisseurs.default_mode'),   v: (f.mode_paiement_defaut || '').replace('_', ' '), color: C.blue, fmt: 'text' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 14, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: s.fmt === 'text' ? 'inherit' : 'monospace', marginTop: 5 }}>
                {s.fmt === 'text' ? s.v : fmt(s.v)}
                {s.fmt !== 'text' && <span style={{ fontSize: 9, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{t('common.currency')}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginTop: 16 }}>
          {[
            { icon: Mail,    label: f.email || '—' },
            { icon: Phone,   label: f.telephone || '—' },
            { icon: MapPin,  label: [f.ville, f.pays].filter(Boolean).join(', ') || '—' },
            { icon: Receipt, label: f.ninea ? t('fournisseurs.ninea_label', { value: f.ninea }) : t('fournisseurs.ninea_empty') },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: C.hover, borderRadius: 9, border: `1px solid ${C.border}` }}>
              <Icon size={13} color={C.muted} />
              <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
        {/* Dépenses récentes */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{t('fournisseurs.recent_expenses')}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                {[
                  t('dashboard.transactions_col_num'),
                  t('common.description'),
                  t('common.date'),
                  t('common.amount'),
                  t('common.status'),
                ].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.depenses.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>{t('fournisseurs.no_expenses')}</td></tr>
              ) : f.depenses.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: C.accent }}>{d.numero}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: C.text }}>{truncate(d.description, 30)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: C.muted }}>{formatDate(d.date_depense)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.red }}>{fmt(d.montant_ttc)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 10, color: d.statut === 'payee' ? C.accent : C.gold }}>{t(`statut.${d.statut}`, { defaultValue: d.statut })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paiements récents */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{t('fournisseurs.recent_payments')}</div>
          </div>
          <div style={{ padding: 12 }}>
            {paiements.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: C.muted, fontSize: 12 }}>{t('fournisseurs.no_payments')}</div>
            ) : paiements.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 11,
              }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 600 }}>{formatDate(p.date_paiement)}</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>{p.mode_paiement} · {p.compte_tresorerie_nom || '—'}</div>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>−{fmt(p.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPaiement && (
        <PaiementModal fournisseur={f}
          depense={showPaiement.depense}
          onClose={() => setShowPaiement(null)}
          onSaved={() => { setShowPaiement(null); fetchData(); toast.success(t('factures.success_paiement')); }}
          C={C} dark={dark} />
      )}
      {showEdit && (
        <FournisseurFormModal fournisseur={f}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchData(); toast.success(t('fournisseurs.saved')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

const btnRetour = (C) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
  border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
});
const btnSec = (C) => ({
  padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${C.border}`,
  background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
});

// ─── MODAL PAIEMENT FOURNISSEUR ────────────────────────────────────────────
function PaiementModal({ fournisseur, depense, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const [comptes, setComptes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [form, setForm] = useState({
    fournisseur_id: fournisseur.id,
    depense_id: depense?.id || '',
    montant: depense?.montant_ttc || '',
    mode_paiement: fournisseur.mode_paiement_defaut || 'virement',
    compte_tresorerie_id: '',
    date_paiement: new Date().toISOString().split('T')[0],
    reference: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/tresorerie/comptes').then(r => setComptes(r.data.data)).catch(() => {});
    // Charger les dépenses non payées du fournisseur (pour le sélecteur)
    api.get(`/fournisseurs/${fournisseur.id}`).then(r => {
      const enAttente = (r.data.data.depenses || []).filter(d => d.statut === 'en_attente' || d.statut === 'en_retard');
      setDepenses(enAttente);
    });
  }, [fournisseur.id]);

  const handleSubmit = async () => {
    if (!parseFloat(form.montant) || parseFloat(form.montant) <= 0) { toast.error(t('common.error_generic')); return; }
    setSaving(true);
    try {
      await api.post('/fournisseurs/paiements', form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('factures.error_paiement'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={t('fournisseurs.pay_modal_title', { supplier: fournisseur.nom })} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('fournisseurs.pay_encours').toUpperCase()}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold, fontFamily: 'monospace' }}>
            {fmt(fournisseur.encours)} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{t('common.currency')}</span>
          </div>
        </div>

        {depenses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('fournisseurs.pay_expense_select')}
            </label>
            <select value={form.depense_id}
              onChange={e => {
                const dep = depenses.find(d => d.id === e.target.value);
                setForm(f => ({ ...f, depense_id: e.target.value, montant: dep ? dep.montant_ttc : f.montant }));
              }}
              style={selectStyle}>
              <option value="">{t('fournisseurs.pay_expense_default')}</option>
              {depenses.map(d => (
                <option key={d.id} value={d.id}>{d.numero} · {fmt(d.montant_ttc)} {t('common.currency')}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label={t('fournisseurs.pay_amount')} type="number" value={form.montant}
            onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} required />
          <Input label={t('fournisseurs.pay_date')} type="date" value={form.date_paiement}
            onChange={e => setForm(f => ({ ...f, date_paiement: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('fournisseurs.pay_mode')}</label>
            <select value={form.mode_paiement}
              onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value, compte_tresorerie_id: '' }))}
              style={selectStyle}>
              <option value="virement">{t('fournisseurs.mode_virement')}</option>
              <option value="mobile_money">{t('fournisseurs.mode_mobile_money')}</option>
              <option value="cheque">{t('fournisseurs.mode_cheque')}</option>
              <option value="cash">{t('fournisseurs.mode_cash')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('fournisseurs.pay_account')}</label>
            <select value={form.compte_tresorerie_id}
              onChange={e => setForm(f => ({ ...f, compte_tresorerie_id: e.target.value }))}
              style={selectStyle}>
              <option value="">{t('fournisseurs.pay_account_default')}</option>
              {comptes
                .filter(c => {
                  const tt = form.mode_paiement === 'cash' ? 'caisse'
                    : form.mode_paiement === 'mobile_money' ? 'mobile_money' : 'banque';
                  return c.type === tt;
                })
                .map(c => (
                  <option key={c.id} value={c.id}>{c.nom} ({fmt(c.solde_actuel)})</option>
                ))}
            </select>
          </div>
        </div>

        <Input label={t('fournisseurs.pay_reference')} value={form.reference}
          onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder={t('fournisseurs.pay_reference_placeholder')} />

        {(() => {
          const compteSel = comptes.find(c => c.id === form.compte_tresorerie_id);
          if (!compteSel) return null;
          return <AlerteSolde compte={compteSel} montant={form.montant} />;
        })()}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          {(() => {
            const compteSel = comptes.find(c => c.id === form.compte_tresorerie_id);
            const bloque = compteSel ? evaluerSortie(compteSel, form.montant).bloquant : false;
            return (
              <button onClick={handleSubmit} disabled={saving || bloque} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
              }}>{saving ? t('fournisseurs.pay_running') : bloque ? t('fournisseurs.pay_insufficient') : t('fournisseurs.pay_confirm')}</button>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET BONS DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════
function CommandesTab({ onSelect, C, dark }) {
  const { t } = useTranslation();
  const [commandes, setCommandes] = useState([]);
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statut) params.set('statut', statut);
      const r = await api.get(`/commandes-achat?${params}`);
      setCommandes(r.data.data);
    } catch { toast.error(t('fournisseurs.error_load')); }
    finally { setLoading(false); }
  }, [statut, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { v: '',             l: t('common.all') },
          { v: 'brouillon',    l: t('statut.brouillon') },
          { v: 'envoyee',      l: t('statut.envoyee') },
          { v: 'receptionnee', l: t('fournisseurs.orders_received') },
          { v: 'facturee',     l: t('statut.payee') },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setStatut(v)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${statut === v ? C.accent : C.border}`,
            background: statut === v ? `${C.accent}15` : 'transparent',
            color: statut === v ? C.accent : C.muted,
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> {t('fournisseurs.orders_new')}
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('fournisseurs.orders_col_number'),
                t('fournisseurs.orders_col_date'),
                t('fournisseurs.orders_col_supplier'),
                t('common.due_date'),
                t('fournisseurs.orders_total'),
                t('fournisseurs.orders_col_status'),
                '',
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : commandes.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {t('fournisseurs.orders_empty')}
              </td></tr>
            ) : commandes.map(c => {
              const colors = STATUT_BC_COLORS[c.statut] || STATUT_BC_COLORS.brouillon;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                  onClick={() => onSelect(c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{c.numero}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted }}>{formatDate(c.date_commande)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.text, fontWeight: 600 }}>{c.fournisseur_nom}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date() && c.statut === 'envoyee' ? C.red : C.muted }}>
                    {c.date_livraison_prevue ? formatDate(c.date_livraison_prevue) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{fmt(c.total_ttc)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                  background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{t(`statut.${c.statut}`, { defaultValue: c.statut })}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><Eye size={13} color={C.muted} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CommandeFormModal
          onClose={() => setShowForm(false)}
          onSaved={(c) => { setShowForm(false); fetchData(); onSelect(c.id); toast.success(t('fournisseurs.created')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

// ─── MODAL CRÉATION COMMANDE ───────────────────────────────────────────────
function CommandeFormModal({ onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const emptyLigne = { description: '', produit_id: null, quantite: 1, unite: 'unité', prix_unitaire: '', remise: 0 };
  const [fournisseurs, setFournisseurs] = useState([]);
  const [produits, setProduits] = useState([]);
  const [form, setForm] = useState({
    fournisseur_id: '', date_commande: new Date().toISOString().split('T')[0],
    date_livraison_prevue: '', reference_fournisseur: '',
    taux_tva: 18, lignes: [{ ...emptyLigne }], notes: '', conditions: '',
    valider_envoi: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/fournisseurs?limit=200').then(r => setFournisseurs(r.data.data)).catch(() => {});
    api.get('/produits?limit=500').then(r => setProduits(r.data.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setLigne = (i, k, v) => setForm(f => {
    const lignes = [...f.lignes]; lignes[i] = { ...lignes[i], [k]: v }; return { ...f, lignes };
  });
  const choisirProduit = (i, p) => setForm(f => {
    const lignes = [...f.lignes];
    lignes[i] = {
      ...lignes[i],
      produit_id: p.id, description: p.libelle, unite: p.unite || 'unité',
      prix_unitaire: p.prix_achat_ht || lignes[i].prix_unitaire,
    };
    return { ...f, lignes };
  });
  const addLigne = () => setForm(f => ({ ...f, lignes: [...f.lignes, { ...emptyLigne }] }));
  const removeLigne = (i) => setForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }));

  const totaux = useMemo(() => {
    let st = 0;
    for (const l of form.lignes) {
      const q = parseFloat(l.quantite) || 0;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const r = parseFloat(l.remise) || 0;
      st += q * pu * (1 - r / 100);
    }
    const tva = st * (parseFloat(form.taux_tva) / 100);
    return { st: Math.round(st * 100) / 100, tva: Math.round(tva * 100) / 100, ttc: Math.round((st + tva) * 100) / 100 };
  }, [form.lignes, form.taux_tva]);

  const handleSubmit = async (validerEnvoi) => {
    if (!form.fournisseur_id) { toast.error(t('common.supplier')); return; }
    if (form.lignes.some(l => !l.description || !l.prix_unitaire)) { toast.error(t('fournisseurs.orders_lines')); return; }
    setSaving(true);
    try {
      const res = await api.post('/commandes-achat', { ...form, valider_envoi: validerEnvoi });
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('fournisseurs.error_save'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={t('fournisseurs.orders_new')} onClose={onClose} width={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('common.supplier')} *</label>
            <select value={form.fournisseur_id} onChange={set('fournisseur_id')} style={selectStyle} required>
              <option value="">— {t('common.search')} —</option>
              {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <Input label={`${t('fournisseurs.orders_col_date')} *`} type="date" value={form.date_commande} onChange={set('date_commande')} required />
          <Input label={t('common.due_date')} type="date" value={form.date_livraison_prevue} onChange={set('date_livraison_prevue')} />
        </div>

        <Input label={t('common.reference')} value={form.reference_fournisseur} onChange={set('reference_fournisseur')} />

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 6 }}>
            {[
              t('common.description'),
              t('common.quantity'),
              t('factures.line_unit'),
              t('factures.line_unit_price'),
              t('factures.line_discount'),
              '',
            ].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {form.lignes.map((l, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={l.description}
                onChange={e => { setLigne(idx, 'description', e.target.value); if (l.produit_id) setLigne(idx, 'produit_id', null); }}
                list={`prod-bc-${idx}`}
                onBlur={e => {
                  if (!l.produit_id) {
                    const p = produits.find(pp => pp.libelle === e.target.value);
                    if (p) choisirProduit(idx, p);
                  }
                }}
                placeholder={t('factures.line_description')} required
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box',
                  background: C.input, border: `1.5px solid ${l.produit_id ? C.accent : C.border}`,
                  borderRadius: 8, padding: '9px 11px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
              <datalist id={`prod-bc-${idx}`}>
                {produits.map(p => (
                  <option key={p.id} value={p.libelle}>{p.code} · {fmt(p.prix_achat_ht)} {t('common.currency')}</option>
                ))}
              </datalist>
              <input type="number" value={l.quantite} onChange={e => setLigne(idx, 'quantite', e.target.value)}
                placeholder="1" min="0.001" step="any"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', textAlign: 'center' }} />
              <input value={l.unite} onChange={e => setLigne(idx, 'unite', e.target.value)}
                placeholder={t('fournisseurs.unit_placeholder')}
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none' }} />
              <input type="number" value={l.prix_unitaire} onChange={e => setLigne(idx, 'prix_unitaire', e.target.value)}
                placeholder="0" required min="0"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', textAlign: 'right' }} />
              <input type="number" value={l.remise} onChange={e => setLigne(idx, 'remise', e.target.value)}
                placeholder="0" min="0" max="100"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 6px', color: C.text, fontSize: 12, outline: 'none', textAlign: 'center' }} />
              <button type="button" onClick={() => removeLigne(idx)} disabled={form.lignes.length === 1}
                style={{ padding: 8, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', color: C.muted, opacity: form.lignes.length === 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addLigne} style={{
            marginTop: 4, padding: '9px 0', background: 'none',
            border: `1.5px dashed ${C.accent}50`, borderRadius: 9,
            color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
          }}>+ {t('factures.add_line')}</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{t('common.tva')} :</span>
            <input type="number" value={form.taux_tva} onChange={set('taux_tva')}
              style={{ width: 60, background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', color: C.text, fontSize: 12, outline: 'none', textAlign: 'right' }} />
            <span style={{ fontSize: 11, color: C.muted }}>%</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.muted }}>{t('factures.totals_subtotal')} : <strong style={{ color: C.text, fontFamily: 'monospace' }}>{fmt(totaux.st)}</strong></div>
            <div style={{ fontSize: 11, color: C.muted }}>{t('common.tva')} : <strong style={{ color: C.text, fontFamily: 'monospace' }}>{fmt(totaux.tva)}</strong></div>
            <div style={{ fontSize: 16, color: C.accent, fontWeight: 800, fontFamily: 'monospace', marginTop: 4 }}>
              {t('factures.totals_ttc')} : {fmt(totaux.ttc)} {t('common.currency')}
            </div>
          </div>
        </div>

        <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />

        <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{
            padding: '11px 22px', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSubmit(false)} disabled={saving} style={{
              padding: '11px 18px', borderRadius: 10, border: `1.5px solid ${C.accent}`,
              background: 'transparent', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{t('factures.save_draft')}</button>
            <button onClick={() => handleSubmit(true)} disabled={saving} style={{
              padding: '11px 22px', borderRadius: 10, border: 'none',
              background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
              fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Send size={13} /> {saving ? '...' : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── VUE DÉTAIL COMMANDE ───────────────────────────────────────────────────
function CommandeDetail({ id, onBack, C, dark }) {
  const { t } = useTranslation();
  const [cmd, setCmd] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/commandes-achat/${id}`); setCmd(r.data.data); }
    catch { toast.error(t('fournisseurs.error_load')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const transition = async (action) => {
    try {
      await api.post(`/commandes-achat/${id}/${action}`);
      toast.success(t('factures.success_status'));
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('factures.error_status')); }
  };

  if (loading || !cmd) {
    return (
      <div style={{ padding: '32px 36px', background: C.bg, minHeight: '100vh' }}>
        <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back')}</button>
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>{t('common.loading')}</div>
      </div>
    );
  }

  const colors = STATUT_BC_COLORS[cmd.statut];

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back_to_list')}</button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginTop: 18, marginBottom: 22, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{cmd.numero}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                            background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{t(`statut.${cmd.statut}`, { defaultValue: cmd.statut })}</span>
            </div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              <strong style={{ color: C.text }}>{cmd.fournisseur_nom}</strong> · {formatDate(cmd.date_commande)}
              {cmd.date_livraison_prevue && <> · {t('common.due_date')} : {formatDate(cmd.date_livraison_prevue)}</>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cmd.statut === 'brouillon' && (
              <button onClick={() => transition('envoyer')} style={btnPrimary(C, dark)}>
                <Send size={13} /> {t('statut.envoyee')}
              </button>
            )}
            {cmd.statut === 'envoyee' && (
              <button onClick={() => transition('receptionner')} style={btnPrimary(C, dark, C.gold)}>
                <Truck size={13} /> {t('fournisseurs.orders_receive')}
              </button>
            )}
            {(cmd.statut === 'envoyee' || cmd.statut === 'receptionnee') && (
              <button onClick={() => transition('facturer')} style={btnPrimary(C, dark)}>
                <Receipt size={13} /> {t('fournisseurs.orders_convert_expense')}
              </button>
            )}
            {(cmd.statut === 'brouillon' || cmd.statut === 'envoyee') && (
              <button onClick={() => transition('annuler')} style={{ ...btnSec(C), color: C.red, borderColor: `${C.red}50` }}>
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 22 }}>
          {[
            { l: t('factures.totals_subtotal'), v: cmd.sous_total },
            { l: t('common.tva'), v: cmd.montant_tva },
            { l: t('factures.totals_ttc'),    v: cmd.total_ttc, color: C.accent, bold: true },
            { l: t('fournisseurs.orders_lines'),    v: cmd.lignes.length, fmt: 'count' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 14, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontSize: s.bold ? 17 : 15, fontWeight: 800, color: s.color || C.text, fontFamily: 'monospace', marginTop: 5 }}>
                {s.fmt === 'count' ? s.v : fmt(s.v)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t('fournisseurs.orders_lines')}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
              {[
                t('common.description'),
                t('common.product'),
                t('common.quantity'),
                t('factures.line_unit'),
                t('factures.line_unit_price'),
                t('factures.line_discount'),
                t('factures.line_total'),
              ].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmd.lignes.map(l => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '11px 14px', fontSize: 12, color: C.text }}>{l.description}</td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{l.produit_code || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(l.quantite)}</td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{l.unite}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace' }}>{fmt(l.prix_unitaire)}</td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{l.remise > 0 ? `${l.remise}%` : '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{fmt(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cmd.depense_id && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={14} color={C.accent} />
          <span style={{ fontSize: 12, color: C.sub }}>
            {t('fournisseurs.orders_convert_expense')} ✓
          </span>
        </div>
      )}
    </div>
  );
}

const btnPrimary = (C, dark, color) => ({
  padding: '8px 16px', borderRadius: 9, border: 'none',
  background: color || C.accent, color: dark ? '#000' : '#fff',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
});

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET ÉCHÉANCIER
// ═══════════════════════════════════════════════════════════════════════════
function EcheancierTab({ C, dark }) {
  const { t } = useTranslation();
  const [echeances, setEcheances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/fournisseurs/stats').then(r => {
      setEcheances(r.data.data.echeancier || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>{t('common.loading')}</div>;

  const groupes = ['retard', 'urgent', 'proche', 'futur'].map(u => ({
    cle: u,
    items: echeances.filter(e => e.urgence === u),
  })).filter(g => g.items.length > 0);

  if (echeances.length === 0) {
    return (
      <div style={{
        background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: 14,
        padding: '60px 20px', textAlign: 'center',
      }}>
        <CheckCircle size={36} color={C.accent} style={{ margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t('fournisseurs.schedule_empty')}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{t('fournisseurs.no_payments')}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groupes.map(g => {
        const colors = URGENCE_COLORS[g.cle];
        const urgenceLabel = {
          retard: t('fournisseurs.schedule_overdue'),
          urgent: t('fournisseurs.schedule_urgent'),
          proche: t('fournisseurs.schedule_soon'),
          futur:  t('fournisseurs.schedule_later'),
        }[g.cle];
        const total = g.items.reduce((s, e) => s + parseFloat(e.montant_ttc), 0);
        return (
          <div key={g.cle} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: colors.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color={colors.color} />
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.color }}>{urgenceLabel}</span>
                <span style={{ fontSize: 11, color: C.muted }}>({g.items.length} {t('factures.title').toLowerCase()})</span>
              </div>
              <strong style={{ fontFamily: 'monospace', color: colors.color }}>{fmt(total)} {t('common.currency')}</strong>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                  {[
                    t('dashboard.transactions_col_num'),
                    t('common.supplier'),
                    t('common.description'),
                    t('common.emission_date'),
                    t('common.due_date'),
                    t('common.amount'),
                  ].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.items.map(e => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent }}>{e.numero}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.text, fontWeight: 600 }}>{e.fournisseur_nom || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.sub }}>{truncate(e.description, 30)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted }}>{formatDate(e.date_depense)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: colors.color, fontWeight: 700 }}>{formatDate(e.date_echeance)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.red }}>{fmt(e.montant_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
