import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import {
  Plus, Search, X, Download, ArrowRightCircle,
  Check, Ban, Trash2, Clock, Percent,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC, Input, Modal, KpiCard } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';

const DEVIS_STATUTS = ['', 'en_attente', 'accepte', 'refuse', 'expire', 'converti'];

// Badge dédié au cycle de vie commercial du devis (distinct du statut comptable).
// Le libellé est résolu via t('statut.<code>') au rendu.
const DevisBadge = ({ statut }) => {
  const { t, i18n } = useTranslation();
  const COULEURS = {
    en_attente: { bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
    accepte:    { bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
    refuse:     { bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
    expire:     { bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' },
    converti:   { bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
  };
  const cfg = COULEURS[statut] || { bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' };
  const key = `statut.${statut}`;
  const label = statut && i18n.exists(key) ? t(key) : (statut || '—');
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
};

const emptyLigne = { description: '', quantite: 1, unite: 'unité', prix_unitaire: '', remise: 0, produit_id: null };
const emptyForm = {
  client_id: '', type: 'devis', date_emission: new Date().toISOString().split('T')[0],
  date_echeance: '', taux_tva: 18, notes: '', conditions_paiement: 'Devis valable 30 jours',
  lignes: [{ ...emptyLigne }],
};

export default function DevisPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const [devis, setDevis] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [produitsCatalogue, setProduitsCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showConvert, setShowConvert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [convertForm, setConvertForm] = useState({ date_echeance: '', valider_immediatement: false });

  useEffect(() => {
    api.get('/clients?limit=100').then(r => setClients(r.data.data)).catch(() => {});
    api.get('/produits?limit=500').then(r => setProduitsCatalogue(r.data.data)).catch(() => {});
  }, []);

  const fetchStats = useCallback(() => {
    api.get('/devis/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);

  const fetchDevis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/devis?search=${search}&devis_statut=${statut}&page=${page}&limit=15`);
      setDevis(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error(t('devis.error_load')); }
    finally { setLoading(false); }
  }, [search, statut, page, t]);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const updateLigne = (idx, key, val) => setForm(f => {
    const lignes = [...f.lignes];
    lignes[idx] = { ...lignes[idx], [key]: val };
    return { ...f, lignes };
  });
  const addLigne = () => setForm(f => ({ ...f, lignes: [...f.lignes, { ...emptyLigne }] }));
  const removeLigne = (idx) => setForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== idx) }));

  const choisirProduit = (idx, produit) => setForm(f => {
    const lignes = [...f.lignes];
    lignes[idx] = {
      ...lignes[idx], produit_id: produit.id, description: produit.libelle,
      unite: produit.unite || 'unité', prix_unitaire: produit.prix_vente_ht || '',
    };
    return { ...f, lignes };
  });
  const reinitProduit = (idx) => setForm(f => {
    const lignes = [...f.lignes];
    lignes[idx] = { ...lignes[idx], produit_id: null };
    return { ...f, lignes };
  });

  const sousTotal = form.lignes.reduce((s, l) => {
    const q = parseFloat(l.quantite) || 0;
    const pu = parseFloat(l.prix_unitaire) || 0;
    const r = parseFloat(l.remise) || 0;
    return s + q * pu * (1 - r / 100);
  }, 0);
  const tva = sousTotal * (parseFloat(form.taux_tva) / 100);
  const ttc = sousTotal + tva;

  const handleSave = async () => {
    if (!form.client_id) return toast.error(t('factures.error_create'));
    if (form.lignes.some(l => !l.description || !l.prix_unitaire)) return toast.error(t('factures.error_create'));
    setSaving(true);
    try {
      await api.post('/factures', { ...form, valider_immediatement: false });
      toast.success(t('devis.saved'));
      setShowModal(false);
      setForm({ ...emptyForm });
      fetchDevis();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || t('devis.error_create'));
    } finally { setSaving(false); }
  };

  const changerStatut = async (id, devis_statut) => {
    try {
      await api.put(`/devis/${id}/statut`, { devis_statut });
      toast.success(t('factures.success_status'));
      fetchDevis();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || t('factures.error_status'));
    }
  };

  const supprimer = async (id, numero) => {
    if (!window.confirm(t('devis.confirm_delete') + ` (${numero})`)) return;
    try {
      await api.delete(`/devis/${id}`);
      toast.success(t('devis.deleted'));
      fetchDevis();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || t('factures.error_delete'));
    }
  };

  const handleConvert = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/devis/${showConvert.id}/convertir`, convertForm);
      toast.success(`${res.data.data.numero} — ${t('devis.converted')}`);
      setShowConvert(null);
      setConvertForm({ date_echeance: '', valider_immediatement: false });
      fetchDevis();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || t('devis.error_convert'));
    } finally { setSaving(false); }
  };

  const downloadPDF = async (id, numero) => {
    const toastId = toast.loading(t('rapports.export_loading'));
    try {
      const res = await api.get(`/rapports/facture/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.dismiss(toastId);
      toast.success(t('rapports.export_pdf'));
    } catch {
      toast.dismiss(toastId);
      toast.error(t('rapports.error_export'));
    }
  };

  const btnAction = (bg, brd, col) => ({
    padding: '5px 8px', background: bg, border: `1px solid ${brd}`, borderRadius: 7,
    cursor: 'pointer', color: col, display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('devis.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{t('devis.subtitle')}</p>
        </div>
        <button data-onboarding="btn-nouveau" onClick={() => { setForm({ ...emptyForm }); setShowModal(true); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={16} /> {t('devis.new')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div data-onboarding="devis-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard label={t('statut.en_attente')} value={stats.en_attente} sub={`${formatFCFA(stats.montant_pipeline)} ${t('common.currency')}`} icon={Clock} color={C.gold} />
          <KpiCard label={t('statut.accepte')} value={stats.accepte} sub={t('devis.convert_button')} icon={Check} color={C.accent} />
          <KpiCard label={t('statut.converti')} value={stats.converti} sub={`${formatFCFA(stats.montant_converti)} ${t('common.currency')}`} icon={ArrowRightCircle} color={C.blue} />
          <KpiCard label="%" value={`${stats.taux_conversion} %`} sub={t('common.total')} icon={Percent} color={C.purple} />
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('devis.search_placeholder')}
            style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px 9px 32px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div data-onboarding="filtres-statut" style={{ display: 'flex', gap: 6 }}>
          {DEVIS_STATUTS.map(s => (
            <button key={s} onClick={() => { setStatut(s); setPage(1); }} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: statut === s ? C.accent : (dark ? '#161F2E' : C.hover),
              color: statut === s ? (dark ? '#000' : '#fff') : C.muted, transition: 'all 0.15s',
            }}>{s ? t(`statut.${s}`) : t('common.all')}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div data-onboarding="liste-devis" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: dark ? '#0D1220' : C.cardAlt }}>
              {[
                t('devis.col_number'),
                t('devis.col_client'),
                t('devis.col_date'),
                t('devis.col_due'),
                t('devis.col_total_ttc'),
                t('devis.col_status'),
                t('factures.title'),
                t('common.actions'),
              ].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : devis.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('devis.empty')}</td></tr>
            ) : devis.map(d => {
              const estConverti = d.devis_statut === 'converti';
              const figeable = !estConverti;
              return (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}22`, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? '#161F2E' : C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>
                    {d.numero}
                    {d.type === 'proforma' && <span style={{ marginLeft: 6, fontSize: 9, color: C.gold, fontWeight: 700 }}>PRO</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600 }}>{truncate(d.client_nom || '—', 22)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{formatDate(d.date_emission)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: d.devis_statut === 'expire' ? C.red : C.muted }}>
                    {d.date_echeance ? formatDate(d.date_echeance) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{formatFCFA(d.total_ttc)}</td>
                  <td style={{ padding: '12px 14px' }}><DevisBadge statut={d.devis_statut} /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: d.converti_numero ? C.blue : C.muted }}>
                    {d.converti_numero || '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {figeable && d.devis_statut !== 'accepte' && (
                        <button onClick={() => changerStatut(d.id, 'accepte')} title={t('devis.accept_button')}
                          style={btnAction(`${C.accent}20`, `${C.accent}40`, C.accent)}><Check size={13} /></button>
                      )}
                      {figeable && d.devis_statut !== 'refuse' && (
                        <button onClick={() => changerStatut(d.id, 'refuse')} title={t('devis.decline_button')}
                          style={btnAction(`${C.red}20`, `${C.red}40`, C.red)}><Ban size={13} /></button>
                      )}
                      {!estConverti && (
                        <button onClick={() => { setShowConvert(d); setConvertForm({ date_echeance: '', valider_immediatement: false }); }}
                          title={t('devis.convert_button')}
                          style={btnAction(`${C.blue}20`, `${C.blue}40`, C.blue)}><ArrowRightCircle size={13} /></button>
                      )}
                      <button onClick={() => downloadPDF(d.id, d.numero)} title={t('factures.btn_download_pdf')}
                        style={btnAction(C.hover, C.border, C.sub)}><Download size={13} /></button>
                      {!estConverti && (
                        <button onClick={() => supprimer(d.id, d.numero)} title={t('common.delete')}
                          style={btnAction(C.hover, C.border, C.muted)}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted }}>Page {page} sur {pagination.pages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} style={{
                  width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: page === i + 1 ? C.accent : (dark ? '#161F2E' : C.hover),
                  color: page === i + 1 ? (dark ? '#000' : '#fff') : C.muted,
                }}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal nouveau devis */}
      {showModal && (
        <Modal title={form.type === 'devis' ? t('devis.new') : t('devis.new_proforma')}
          onClose={() => { setShowModal(false); setForm({ ...emptyForm }); }} width={720}>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { key: 'devis',    label: 'Devis',    color: C.blue, desc: 'Offre commerciale convertible en facture' },
                { key: 'proforma', label: 'Proforma', color: C.gold, desc: 'Facture provisoire, sans valeur comptable' },
              ].map(({ key, label, color, desc }) => (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${form.type === key ? color : C.border}`,
                  background: form.type === key ? `${color}18` : 'transparent',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: form.type === key ? color : C.muted }}>{label}</div>
                  <div style={{ fontSize: 9, color: form.type === key ? color : C.muted, opacity: 0.85, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            <div style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}40`, borderRadius: 9, padding: '9px 13px', fontSize: 11, color: C.blue }}>
              <strong>Cycle de vie :</strong> un devis créé est « en attente ». Une fois accepté par le client, convertissez-le en facture en un clic — les lignes et montants sont repris automatiquement.
            </div>

            {/* Client + dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Client <span style={{ color: C.accent }}>*</span></label>
                <select value={form.client_id} onChange={set('client_id')} required
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: form.client_id ? C.text : C.muted, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  <option value="">— Sélectionner —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date émission <span style={{ color: C.accent }}>*</span></label>
                <input type="date" value={form.date_emission} onChange={set('date_emission')} required
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valide jusqu'au</label>
                <input type="date" value={form.date_echeance} onChange={set('date_echeance')}
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Lignes */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 6 }}>
                {['Description', 'Qté', 'Unité', 'Prix U. HT', 'Remise%', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {form.lignes.map((l, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <input value={l.description}
                      onChange={e => { updateLigne(idx, 'description', e.target.value); if (l.produit_id) reinitProduit(idx); }}
                      list={`produits-devis-${idx}`} placeholder="Prestation proposée..." required
                      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input,
                        border: `1.5px solid ${l.produit_id ? C.accent : C.border}`, borderRadius: 8, padding: '9px 11px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                      onBlur={e => {
                        if (!l.produit_id) {
                          const p = produitsCatalogue.find(pp => pp.libelle === e.target.value);
                          if (p) choisirProduit(idx, p);
                        }
                      }} />
                    <datalist id={`produits-devis-${idx}`}>
                      {produitsCatalogue.map(p => (
                        <option key={p.id} value={p.libelle}>
                          {p.code} · {new Intl.NumberFormat('fr-FR').format(Math.round(p.prix_vente_ht))} FCFA
                        </option>
                      ))}
                    </datalist>
                    {l.produit_id && (
                      <span title="Lié au catalogue" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: C.accent, color: dark ? '#000' : '#fff' }}>P</span>
                    )}
                  </div>
                  <input type="number" value={l.quantite} onChange={e => updateLigne(idx, 'quantite', e.target.value)}
                    placeholder="1" min="0.001" step="any"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <input value={l.unite} onChange={e => updateLigne(idx, 'unite', e.target.value)}
                    placeholder="unité"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  <input type="number" value={l.prix_unitaire} onChange={e => updateLigne(idx, 'prix_unitaire', e.target.value)}
                    placeholder="0" required min="0"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
                  <input type="number" value={l.remise} onChange={e => updateLigne(idx, 'remise', e.target.value)}
                    placeholder="0" min="0" max="100"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 6px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <button type="button" onClick={() => removeLigne(idx)} disabled={form.lignes.length === 1}
                    style={{ padding: '8px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', color: C.muted, opacity: form.lignes.length === 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLigne} style={{
                marginTop: 4, padding: '9px 0', background: 'none', border: `1.5px dashed ${C.accent}50`,
                borderRadius: 9, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
              }}>+ Ajouter une ligne</button>
            </div>

            {/* Totaux */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 280, background: dark ? '#0D1525' : C.cardAlt, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 8 }}>
                  <span>Sous-total HT</span>
                  <span style={{ fontFamily: 'monospace', color: C.text }}>{formatFCFA(sousTotal)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.sub }}>TVA</span>
                    <select value={form.taux_tva} onChange={set('taux_tva')}
                      style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', color: C.text, fontSize: 11, outline: 'none' }}>
                      <option value={0}>0% (Exonéré)</option>
                      <option value={9}>9% (réduit)</option>
                      <option value={18}>18% (normal)</option>
                    </select>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: C.sub }}>{formatFCFA(tva)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: `1px solid ${C.border}`, paddingTop: 10, color: form.type === 'devis' ? C.blue : C.gold }}>
                  <span>TOTAL TTC</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatFCFA(ttc)} FCFA</span>
                </div>
              </div>
            </div>

            {/* Conditions + notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validité</label>
                <select value={form.conditions_paiement} onChange={set('conditions_paiement')}
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  <option>Devis valable 30 jours</option>
                  <option>Devis valable 60 jours</option>
                  <option>Devis valable 90 jours</option>
                </select>
              </div>
              <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Précisions techniques..." />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { setShowModal(false); setForm({ ...emptyForm }); }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? C.border : (form.type === 'devis' ? C.blue : C.gold),
                color: saving ? C.muted : '#000',
              }}>
                {saving ? 'Création...' : form.type === 'devis' ? 'Créer le Devis' : 'Créer la Proforma'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal conversion en facture */}
      {showConvert && (
        <Modal title={`${t('devis.convert_button')} — ${showConvert.numero}`} onClose={() => setShowConvert(null)} width={440}>
          <div style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}40`, borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
            Une nouvelle facture sera créée pour <strong style={{ color: C.text }}>{showConvert.client_nom}</strong> en
            reprenant les {' '}<strong style={{ color: C.text }}>{formatFCFA(showConvert.total_ttc)} FCFA TTC</strong> du devis.
            Le devis passera au statut « Converti ».
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleConvert(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Date d'échéance de la facture" type="date" value={convertForm.date_echeance}
              onChange={e => setConvertForm(c => ({ ...c, date_echeance: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${convertForm.valider_immediatement ? C.accent : C.border}`, background: convertForm.valider_immediatement ? `${C.accent}10` : 'transparent' }}>
              <input type="checkbox" checked={convertForm.valider_immediatement}
                onChange={e => setConvertForm(c => ({ ...c, valider_immediatement: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: C.accent }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Valider immédiatement la facture</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  Génère l'écriture comptable et les sorties de stock. Sinon, la facture reste en brouillon.
                </div>
              </div>
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowConvert(null)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: saving ? C.border : C.blue, color: saving ? C.muted : '#000', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Conversion...' : 'Convertir en facture'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Onboarding pageKey="devis" />
    </div>
  );
}
