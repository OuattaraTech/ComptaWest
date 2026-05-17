import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Input, Modal, StatutBadge, AlerteSolde, evaluerSortie } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { Can, ReadOnlyBanner } from '../components/Can.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plus, Search, Trash2, Edit2, Package, Camera } from 'lucide-react';
import ScannerFacture from '../components/ScannerFacture.jsx';
import { useNavigate } from 'react-router-dom';
import { FournisseurFormModal } from './FournisseursPage.jsx';

const STATUT_CFG = {
  payee:      { labelKey: 'depenses.status_paid',      bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
  en_attente: { labelKey: 'depenses.status_pending',   bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
  annulee:    { labelKey: 'depenses.status_cancelled', bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
};

const MODES = ['virement','cash','cheque','mobile_money','carte'];

const emptyForm = {
  categorie_id: '', description: '', fournisseur: '', fournisseur_id: null, montant_ht: '',
  taux_tva: 0, date_depense: new Date().toISOString().split('T')[0],
  statut: 'payee', mode_paiement: 'virement', reference: '', notes: '',
  compte_tresorerie_id: '',
};

export default function DepensesPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();

  // Bouton "convertir en immobilisation" pour les dépenses notables (>500 000 FCFA)
  const [showImmoModal, setShowImmoModal] = useState(null);  // dépense en cours de conversion

  const [depenses, setDepenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [comptesTresorerie, setComptesTresorerie] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showFournForm, setShowFournForm] = useState(false);
  const [fournPrefilNom, setFournPrefilNom] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, cRes] = await Promise.all([
        api.get(`/depenses?search=${search}&categorie_id=${filtreCategorie}&statut=${filtreStatut}&page=${page}&limit=15`),
        api.get(`/depenses/stats?annee=${annee}`),
        api.get('/depenses/categories'),
      ]);
      setDepenses(dRes.data.data);
      setPagination(dRes.data.pagination);
      setStats(sRes.data.data);
      setCategories(cRes.data.data);
    } catch { toast.error(t('depenses.error_load')); }
    finally { setLoading(false); }
  }, [search, filtreCategorie, filtreStatut, page, annee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/tresorerie/comptes').then(r => setComptesTresorerie(r.data.data)).catch(() => {});
    api.get('/fournisseurs?limit=300').then(r => setFournisseurs(r.data.data)).catch(() => {});
  }, []);

  // Si on arrive ici depuis le scanner OCR du tableau de bord, on retrouve
  // les champs extraits dans sessionStorage et on ouvre directement le
  // formulaire pré-rempli. Ne s'exécute qu'une fois (puis on efface).
  useEffect(() => {
    const raw = sessionStorage.getItem('cw_ocr_prefill');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      prefillFromOcr(data);
    } catch {}
    sessionStorage.removeItem('cw_ocr_prefill');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rechargerFournisseurs = async () => {
    try { const r = await api.get('/fournisseurs?limit=300'); setFournisseurs(r.data.data); }
    catch {}
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const montantTVA = (parseFloat(form.montant_ht) || 0) * (parseFloat(form.taux_tva) || 0) / 100;
  const montantTTC = (parseFloat(form.montant_ht) || 0) + montantTVA;

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };

  // Scan d'une facture/reçu : ouvre une modale d'OCR, et au retour
  // pré-remplit le formulaire de dépense avec les champs extraits.
  const [showScanner, setShowScanner] = useState(false);
  const prefillFromOcr = (data) => {
    setEditId(null);
    setForm({
      ...emptyForm,
      description: data.fournisseur_nom
        ? `Achat ${data.fournisseur_nom}${data.numero ? ` · ${data.numero}` : ''}`
        : (data.numero ? `Facture ${data.numero}` : ''),
      fournisseur: data.fournisseur_nom || '',
      fournisseur_id: null,
      montant_ht: data.montant_ht ? String(data.montant_ht) : '',
      taux_tva: data.taux_tva || 18,
      date_depense: data.date || new Date().toISOString().split('T')[0],
      reference: data.numero || '',
      notes: data.fournisseur_ifu ? `IFU : ${data.fournisseur_ifu}` : '',
      statut: 'en_attente',
    });
    setShowModal(true);
  };
  const openEdit = (d) => {
    setEditId(d.id);
    setForm({
      categorie_id: d.categorie_id || '', description: d.description, fournisseur: d.fournisseur || '',
      montant_ht: d.montant_ht, taux_tva: d.taux_tva, date_depense: d.date_depense?.split('T')[0] || '',
      statut: d.statut, mode_paiement: d.mode_paiement, reference: d.reference || '', notes: d.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.put(`/depenses/${editId}`, form); toast.success(t('depenses.modified')); }
      else { await api.post('/depenses', form); toast.success(t('depenses.created')); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('common.error_generic')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('depenses.confirm_delete'))) return;
    try { await api.delete(`/depenses/${id}`); toast.success(t('depenses.deleted')); fetchData(); }
    catch { toast.error(t('depenses.error_delete')); }
  };

  const inputStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', width: '100%', cursor: 'pointer',
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('depenses.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {pagination.total} {t('depenses.title').toLowerCase()} · {formatFCFA(stats?.total_annee || 0, true)} {t('common.currency')} · {annee}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.red} />
          <Can module="depenses" action="create">
            <button onClick={() => setShowScanner(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10,
              border: `1.5px solid ${C.accent}`, background: 'transparent', color: C.accent,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <Camera size={15} /> {t('ocr.btn_scan')}
            </button>
            <button data-onboarding="btn-nouveau" onClick={openCreate} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10,
              border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <Plus size={15} /> {t('depenses.new')}
            </button>
          </Can>
        </div>
      </div>

      <ReadOnlyBanner module="depenses" />

      {/* Stats visuelles */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: C.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.text }}>{t('dashboard.evolution')} {annee}</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.par_mois}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`${formatFCFA(v)} ${t('common.currency')}`, t('common.total')]} contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                <Bar dataKey="total" fill={C.red} radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: C.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.text }}>{t('rapports.chart_charges_sub')}</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={stats.par_categorie.filter(c => c.total > 0)} cx="50%" cy="50%" outerRadius={55} dataKey="total" stroke="none">
                    {stats.par_categorie.filter(c => c.total > 0).map((e, i) => <Cell key={i} fill={e.couleur || '#6B7A99'} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 130 }}>
                {stats.par_categorie.filter(c => c.total > 0).slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.couleur || '#6B7A99', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.sub }}>{truncate(c.nom, 18)}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.couleur || C.muted }}>{c.pourcentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div data-onboarding="filtres-statut" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('depenses.search_placeholder')}
            style={{ ...inputStyle, paddingLeft: 32, background: C.card }} />
        </div>
        <select value={filtreCategorie} onChange={e => { setFiltreCategorie(e.target.value); setPage(1); }} style={{ ...inputStyle, background: C.card, width: 'auto' }}>
          <option value="">{t('common.all')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        {[
          { v: '',           label: t('common.all')       },
          { v: 'payee',      label: t('depenses.status_paid')    },
          { v: 'en_attente', label: t('depenses.status_pending') },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => { setFiltreStatut(v); setPage(1); }} style={{
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtreStatut === v ? C.red : C.border}`,
            background: filtreStatut === v ? `${C.red}15` : 'transparent',
            color: filtreStatut === v ? C.red : C.muted, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div data-onboarding="liste-depenses" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('dashboard.transactions_col_num'),
                t('depenses.col_description'),
                t('depenses.col_category'),
                t('depenses.col_supplier'),
                t('depenses.col_amount_ttc'),
                t('depenses.col_date'),
                t('depenses.col_status'),
                '',
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('depenses.loading')}</td></tr>
            ) : depenses.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('depenses.no_data_text')}</td></tr>
            ) : depenses.map(d => {
              const s = STATUT_CFG[d.statut] || STATUT_CFG.payee;
              return (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.numero}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: C.text }}>{truncate(d.description, 28)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {d.categorie_nom
                      ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: `${d.categorie_couleur}20`, color: d.categorie_couleur, fontWeight: 600 }}>{truncate(d.categorie_nom, 16)}</span>
                      : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.sub }}>{truncate(d.fournisseur || '—', 16)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.red }}>-{formatFCFA(d.montant_ttc)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted }}>{formatDate(d.date_depense)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{t(s.labelKey)}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(d)} style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                        <Edit2 size={12} />
                      </button>
                      {parseFloat(d.montant_ttc) >= 500000 && !d.notes?.includes('Convertie en immo') && (
                        <button onClick={() => setShowImmoModal(d)}
                          title={t('depenses.convert_immo_tooltip')}
                          style={{ padding: '5px 7px', background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 7, cursor: 'pointer', color: C.gold }}>
                          <Package size={12} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(d.id)} style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination.pages > 1 && (
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: dark ? 'transparent' : C.cardAlt }}>
            <span style={{ fontSize: 12, color: C.muted }}>{t('depenses.pagination_info', { page, pages: pagination.pages })}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} style={{
                  width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${page === i + 1 ? C.red : C.border}`,
                  background: page === i + 1 ? `${C.red}15` : 'transparent',
                  color: page === i + 1 ? C.red : C.muted,
                }}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editId ? t('depenses.edit') : t('depenses.new')} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.category')}</label>
              <select value={form.categorie_id} onChange={set('categorie_id')} style={{ ...inputStyle }}>
                <option value="">{t('depenses.none_category')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.nom}</option>)}
              </select>
            </div>
            <Input label={t('depenses.field_description')} value={form.description} onChange={set('description')} placeholder={t('depenses.placeholder_description')} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('common.supplier')}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input value={form.fournisseur}
                    onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value, fournisseur_id: null }))}
                    onBlur={e => {
                      // Auto-link si match exact avec un fournisseur du catalogue
                      const f0 = fournisseurs.find(x => x.nom === e.target.value);
                      if (f0) setForm(f => ({ ...f, fournisseur_id: f0.id, fournisseur: f0.nom }));
                    }}
                    list="fournisseurs-list" placeholder={t('depenses.placeholder_fournisseur')}
                    style={{
                      width: '100%', background: C.input,
                      border: `1.5px solid ${form.fournisseur_id ? C.accent : C.border}`,
                      borderRadius: 9, padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                    }} />
                  <datalist id="fournisseurs-list">
                    {fournisseurs.map(f => <option key={f.id} value={f.nom}>{f.code} · {f.code_auxiliaire}</option>)}
                  </datalist>
                  {form.fournisseur_id && (
                    <span style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                      background: C.accent, color: dark ? '#000' : '#fff',
                    }}>{t('depenses.badge_fiche')}</span>
                  )}
                </div>
                <button type="button" onClick={() => { setFournPrefilNom(form.fournisseur); setShowFournForm(true); }}
                  title={t('depenses.create_supplier_tooltip')}
                  style={{
                    padding: '0 14px', borderRadius: 9, border: `1.5px solid ${C.accent}50`,
                    background: `${C.accent}15`, color: C.accent, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                  }}>
                  <Plus size={13} />
                </button>
              </div>
              {form.fournisseur && !form.fournisseur_id && fournisseurs.length > 0 && (
                <div style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>
                  {t('depenses.tip_create_supplier')}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('depenses.field_amount_ht')} type="number" value={form.montant_ht} onChange={set('montant_ht')} placeholder="0" required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('depenses.tva_label')}</label>
                <select value={form.taux_tva} onChange={set('taux_tva')} style={{ ...inputStyle }}>
                  <option value={0}>{t('depenses.tva_exonere')}</option>
                  <option value={9}>{t('depenses.tva_normal')}</option>
                  <option value={18}>{t('depenses.tva_standard')}</option>
                </select>
              </div>
            </div>
            {parseFloat(form.montant_ht) > 0 && (
              <div style={{ background: dark ? '#0D1525' : '#EEF2F7', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>{t('depenses.tva_amount_label', { amount: formatFCFA(montantTVA) })}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.red }}>{t('depenses.ttc_amount_label', { amount: formatFCFA(montantTTC) })}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('depenses.field_date')} type="date" value={form.date_depense} onChange={set('date_depense')} required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.payment_mode')}</label>
                <select value={form.mode_paiement}
                  onChange={(e) => setForm(f => ({ ...f, mode_paiement: e.target.value, compte_tresorerie_id: '' }))}
                  style={{ ...inputStyle }}>
                  {MODES.map(m => <option key={m} value={m}>{t(`fournisseurs.mode_${m}`)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.status')}</label>
                <select value={form.statut} onChange={set('statut')} style={{ ...inputStyle }}>
                  <option value="payee">{t('depenses.status_paid')}</option>
                  <option value="en_attente">{t('depenses.status_pending')}</option>
                </select>
              </div>
              <Input label={t('common.reference')} value={form.reference} onChange={set('reference')} placeholder={t('depenses.payment_ref_placeholder')} />
            </div>
            {form.statut === 'payee' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.treasury_account')}</label>
                <select value={form.compte_tresorerie_id} onChange={set('compte_tresorerie_id')} style={{ ...inputStyle }}>
                  <option value="">{t('depenses.default_account')}</option>
                  {comptesTresorerie
                    .filter(c => {
                      const typeAttendu = form.mode_paiement === 'cash' ? 'caisse'
                        : form.mode_paiement === 'mobile_money' ? 'mobile_money'
                        : 'banque';
                      return c.type === typeAttendu;
                    })
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nom}{c.operateur ? ` (${c.operateur})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {/* Contrôle de solde : seulement pour une nouvelle dépense payée avec compte explicite */}
            {form.statut === 'payee' && !editId && form.compte_tresorerie_id && (
              <AlerteSolde
                compte={comptesTresorerie.find(c => c.id === form.compte_tresorerie_id)}
                montant={montantTTC} />
            )}
            <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />
            {(() => {
              // Blocage si dépense payée + compte explicite insuffisant (nouvelle dépense seulement)
              const compteSel = comptesTresorerie.find(c => c.id === form.compte_tresorerie_id);
              const bloque = form.statut === 'payee' && !editId && compteSel
                && evaluerSortie(compteSel, montantTTC).bloquant;
              return (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{
                    flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                    background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>{t('common.cancel')}</button>
                  <button type="submit" disabled={saving || bloque} style={{
                    flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                    background: (saving || bloque) ? C.border : C.red, color: (saving || bloque) ? C.muted : '#fff',
                    fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
                  }}>
                    {saving ? t('depenses.saving') : bloque ? t('depenses.error_create') : editId ? t('common.edit') : t('depenses.save_button')}
                  </button>
                </div>
              );
            })()}
          </form>
        </Modal>
      )}

      {showFournForm && (
        <FournisseurFormModal initialNom={fournPrefilNom}
          onClose={() => setShowFournForm(false)}
          onSaved={(f) => {
            setShowFournForm(false);
            rechargerFournisseurs();
            setForm(s => ({ ...s, fournisseur: f.nom, fournisseur_id: f.id }));
            toast.success(t('depenses.toast_supplier_created'));
          }}
          C={C} dark={dark} />
      )}

      {showImmoModal && (
        <ConversionImmoModal depense={showImmoModal}
          onClose={() => setShowImmoModal(null)}
          onDone={(immo) => {
            setShowImmoModal(null);
            toast.success(t('depenses.toast_immo_created', { numero: immo.numero_inventaire }));
            fetchData();
            // Optionnel : naviguer vers l'immo créée
            navigate(`/immobilisations`);
          }}
          C={C} dark={dark} />
      )}

      <ScannerFacture
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onExtraction={prefillFromOcr}
      />

      <Onboarding pageKey="depenses" />
    </div>
  );
}

// ─── Modal : convertir une dépense en immobilisation ────────────────────
function ConversionImmoModal({ depense, onClose, onDone, C, dark }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    categorie_id: '',
    libelle: depense.description,
    date_acquisition: depense.date_depense?.slice(0, 10) || new Date().toISOString().split('T')[0],
    duree_annees: '',
    methode: 'lineaire',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/immobilisations/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCategorie = (catId) => {
    setForm(f => {
      const cat = categories.find(c => c.id === catId);
      return {
        ...f,
        categorie_id: catId,
        duree_annees: cat?.duree_annees || f.duree_annees,
        methode: cat?.methode || f.methode,
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.categorie_id) { toast.error(t('depenses.err_category_required')); return; }
    setSaving(true);
    try {
      const res = await api.post(`/immobilisations/depuis-depense/${depense.id}`, form);
      onDone(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('depenses.err_generic'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  const cat = categories.find(c => c.id === form.categorie_id);

  return (
    <Modal title={t('depenses.convert_modal_title')} onClose={onClose} width={520}>
      <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 10,
                     padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('depenses.origin_expense_label')}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{depense.description}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
          {depense.fournisseur && `${depense.fournisseur} · `}
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.gold }}>
            {new Intl.NumberFormat('fr-FR').format(Math.round(parseFloat(depense.montant_ht) || parseFloat(depense.montant_ttc)))} {t('common.currency')}
          </span>
          {' '}{t('depenses.origin_acquisition_value')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label={t('depenses.field_immo_label')} value={form.libelle} onChange={set('libelle')} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('depenses.field_immo_category')}</label>
          <select value={form.categorie_id} onChange={e => handleCategorie(e.target.value)} style={selectStyle} required>
            <option value="">{t('depenses.select_placeholder')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.libelle} ({c.duree_annees > 0 ? `${c.duree_annees} ${t('depenses.years_unit')}` : t('depenses.not_amortizable')}) · {c.compte_actif}
              </option>
            ))}
          </select>
          {cat && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {t('depenses.field_immo_compte_actif')} <strong style={{ color: C.text, fontFamily: 'monospace' }}>{cat.compte_actif}</strong>
            </div>
          )}
        </div>

        <Input label={t('depenses.field_immo_date_acq')} type="date" value={form.date_acquisition} onChange={set('date_acquisition')} />

        {cat?.amortissable !== false && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('depenses.field_immo_duration')} type="number" value={form.duree_annees} onChange={set('duree_annees')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('depenses.field_immo_method')}</label>
              <select value={form.methode} onChange={set('methode')} style={selectStyle}>
                <option value="lineaire">{t('depenses.method_linear')}</option>
                <option value="degressif">{t('depenses.method_degressive')}</option>
              </select>
            </div>
          </div>
        )}

        <div style={{
          fontSize: 11, color: C.muted, lineHeight: 1.55, padding: '10px 12px',
          background: dark ? '#0D1220' : C.cardAlt, borderRadius: 8,
        }}>
          {t('depenses.convert_info')}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.gold, color: saving ? C.muted : '#000',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : t('depenses.btn_convert')}</button>
        </div>
      </div>
    </Modal>
  );
}
