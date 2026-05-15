import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { Plus, Search, X, Download, CreditCard, Filter, Edit2, Trash2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC, Input, Modal, StatutBadge } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';

const STATUTS = ['', 'brouillon', 'envoyee', 'en_attente', 'payee', 'retard', 'annulee'];

const emptyLigne = { description: '', quantite: 1, unite: 'unité', prix_unitaire: '', remise: 0, produit_id: null };

const emptyForm = {
  client_id: '', type: 'facture', date_emission: new Date().toISOString().split('T')[0],
  date_echeance: '', taux_tva: 18, notes: '', conditions_paiement: 'Paiement à 30 jours',
  lignes: [{ ...emptyLigne }],
  facture_origine_id: '',
};

export default function FacturesPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [facturesEligibles, setFacturesEligibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showPaiement, setShowPaiement] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);

  const [paiementForm, setPaiementForm] = useState({ montant: '', date_paiement: new Date().toISOString().split('T')[0], mode_paiement: 'virement', reference: '', compte_tresorerie_id: '' });
  const [comptesTresorerie, setComptesTresorerie] = useState([]);
  const [produitsCatalogue, setProduitsCatalogue] = useState([]);

  // Charger les comptes de trésorerie et le catalogue produits
  useEffect(() => {
    api.get('/tresorerie/comptes')
      .then(r => setComptesTresorerie(r.data.data))
      .catch(() => {});
    api.get('/produits?limit=500')
      .then(r => setProduitsCatalogue(r.data.data))
      .catch(() => {});
  }, []);

  // Choix d'un produit du catalogue → remplit auto la ligne
  const choisirProduit = (idx, produit) => {
    setForm(f => {
      const lignes = [...f.lignes];
      lignes[idx] = {
        ...lignes[idx],
        produit_id: produit.id,
        description: produit.libelle,
        unite: produit.unite || 'unité',
        prix_unitaire: produit.prix_vente_ht || '',
      };
      return { ...f, lignes };
    });
  };
  const reinitProduit = (idx) => {
    setForm(f => {
      const lignes = [...f.lignes];
      lignes[idx] = { ...lignes[idx], produit_id: null };
      return { ...f, lignes };
    });
  };

  const fetchFactures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/factures?search=${search}&statut=${statut}&page=${page}&limit=15`);
      setFactures(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error(t('factures.error_load')); }
    finally { setLoading(false); }
  }, [search, statut, page]);

  useEffect(() => { fetchFactures(); }, [fetchFactures]);
  useEffect(() => { api.get('/clients?limit=100').then(r => setClients(r.data.data)).catch(err => console.error('Erreur clients:', err?.response?.data?.message)); }, []);

  // Charger les factures éligibles (= type 'facture') pour le sélecteur d'avoir
  useEffect(() => {
    if (form.type !== 'avoir' || !showModal) return;
    api.get('/factures?type=facture&limit=100')
      .then(r => setFacturesEligibles(r.data.data))
      .catch(err => console.error('Erreur factures éligibles:', err?.response?.data?.message));
  }, [form.type, showModal]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const updateLigne = (idx, key, val) => {
    setForm(f => {
      const lignes = [...f.lignes];
      lignes[idx] = { ...lignes[idx], [key]: val };
      return { ...f, lignes };
    });
  };

  const addLigne = () => setForm(f => ({ ...f, lignes: [...f.lignes, { ...emptyLigne }] }));
  const removeLigne = (idx) => setForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== idx) }));

  const calcSousTotal = () => form.lignes.reduce((s, l) => {
    const q = parseFloat(l.quantite) || 0;
    const pu = parseFloat(l.prix_unitaire) || 0;
    const r = parseFloat(l.remise) || 0;
    return s + q * pu * (1 - r / 100);
  }, 0);

  const sousTotal = calcSousTotal();
  const tva = sousTotal * (parseFloat(form.taux_tva) / 100);
  const ttc = sousTotal + tva;

  const openEdit = async (id) => {
    try {
      const res = await api.get(`/factures/${id}`);
      const f = res.data.data;
      setEditingId(id);
      setForm({
        client_id: f.client_id,
        type: f.type || 'facture',
        date_emission: (f.date_emission || '').split('T')[0] || new Date().toISOString().split('T')[0],
        date_echeance: (f.date_echeance || '').split('T')[0] || '',
        taux_tva: parseFloat(f.taux_tva) || 18,
        notes: f.notes || '',
        conditions_paiement: f.conditions_paiement || 'Paiement à 30 jours',
        facture_origine_id: f.facture_origine_id || '',
        lignes: (f.lignes && f.lignes.length ? f.lignes : [emptyLigne]).map(l => ({
          description: l.description || '',
          quantite: parseFloat(l.quantite) || 1,
          unite: l.unite || 'unité',
          prix_unitaire: parseFloat(l.prix_unitaire) || '',
          remise: parseFloat(l.remise) || 0,
          produit_id: l.produit_id || null,
        })),
      });
      setShowModal(true);
    } catch {
      toast.error(t('factures.error_load'));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async (valider_immediatement) => {
    if (!form.client_id) return toast.error(t('factures.error_create'));
    if (form.type === 'avoir' && !form.facture_origine_id) return toast.error(t('factures.error_create'));
    if (form.lignes.some(l => !l.description || !l.prix_unitaire)) return toast.error(t('factures.error_create'));
    setSaving(true);
    try {
      const payload = { ...form };
      // Ne pas envoyer facture_origine_id pour les autres types
      if (form.type !== 'avoir') delete payload.facture_origine_id;

      if (editingId) {
        await api.put(`/factures/${editingId}`, payload);
        toast.success(t('factures.modified'));
      } else {
        payload.valider_immediatement = valider_immediatement;
        await api.post('/factures', payload);
        toast.success(valider_immediatement ? t('factures.saved_validated') : t('factures.saved_draft'));
      }
      closeModal();
      fetchFactures();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || (editingId ? 'Erreur modification' : 'Erreur création');
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handlePaiement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/factures/${showPaiement.id}/paiement`, paiementForm);
      toast.success(t('factures.success_paiement'));
      setShowPaiement(null);
      fetchFactures();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Erreur paiement';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async (f) => {
    if (!confirm(`Supprimer définitivement le brouillon ${f.numero} ?`)) return;
    try {
      await api.delete(`/factures/${f.id}`);
      toast.success(t('factures.deleted'));
      fetchFactures();
    } catch (err) {
      toast.error(err.response?.data?.message || t('factures.error_delete'));
    }
  };

  const handleStatutChange = async (id, s) => {
    try {
      await api.put(`/factures/${id}/statut`, { statut: s });
      toast.success(t('factures.success_status'));
      fetchFactures();
    } catch { toast.error(t('factures.error_status')); }
  };

  const downloadPDF = async (id, numero) => {
    const toastId = toast.loading(t('rapports.export_loading'));
    try {
      const res = await api.get(`/rapports/facture/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
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

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('factures.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{t('factures.subtitle')}</p>
        </div>
        <button data-onboarding="btn-nouveau" onClick={() => setShowModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10,
          border: 'none', background: C.accent, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={16} /> {t('factures.new')}
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 300px' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('factures.search_placeholder')}
            style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px 9px 32px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div data-onboarding="filtres-statut" style={{ display: 'flex', gap: 6 }}>
          {STATUTS.map(s => (
            <button key={s} onClick={() => { setStatut(s); setPage(1); }} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: statut === s ? C.accent : '#161F2E',
              color: statut === s ? '#000' : C.muted, transition: 'all 0.15s',
            }}>{s ? t(`statut.${s}`) : t('common.all')}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div data-onboarding="liste-factures" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: dark ? '#0D1220' : C.cardAlt }}>
              {[
                t('factures.col_number'),
                t('factures.col_client'),
                t('factures.col_date'),
                t('factures.col_due'),
                t('factures.col_total_ttc'),
                t('factures.col_paid'),
                t('factures.col_status'),
                t('common.actions'),
              ].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : factures.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {t('factures.empty')}
              </td></tr>
            ) : factures.map(f => {
              const reste = parseFloat(f.total_ttc) - parseFloat(f.montant_paye);
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}22`, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161F2E'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>{f.numero}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600 }}>{truncate(f.client_nom || '—', 22)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{formatDate(f.date_emission)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: f.statut === 'retard' ? C.red : C.muted }}>{formatDate(f.date_echeance)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{formatFCFA(f.total_ttc)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', color: parseFloat(f.montant_paye) > 0 ? C.accent : C.muted }}>
                    {parseFloat(f.montant_paye) > 0 ? formatFCFA(f.montant_paye) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}><StatutBadge statut={f.statut} /></td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {/* Modifier (brouillon uniquement) */}
                      {f.statut === 'brouillon' && (
                        <button onClick={() => openEdit(f.id)} title="Modifier la facture"
                          style={{ padding: '5px 8px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                          <Edit2 size={13} />
                        </button>
                      )}
                      {/* Supprimer (brouillon uniquement) */}
                      {f.statut === 'brouillon' && (
                        <button onClick={() => handleDelete(f)} title="Supprimer le brouillon"
                          style={{ padding: '5px 8px', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 7, cursor: 'pointer', color: C.red }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      {/* Enregistrer paiement */}
                      {['en_attente', 'retard', 'envoyee'].includes(f.statut) && (
                        <button onClick={() => { setShowPaiement(f); setPaiementForm(p => ({ ...p, montant: reste.toFixed(0) })); }}
                          title="Enregistrer paiement"
                          style={{ padding: '5px 8px', background: `${C.accent}20`, border: `1px solid ${C.accent}40`, borderRadius: 7, cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 600 }}>
                          <CreditCard size={13} />
                        </button>
                      )}
                      {/* Télécharger PDF */}
                      <button onClick={() => downloadPDF(f.id, f.numero)} title="Télécharger PDF"
                        style={{ padding: '5px 8px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                        <Download size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted }}>{t('common.page')} {page} {t('common.of')} {pagination.pages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} style={{
                  width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: page === i + 1 ? C.accent : '#161F2E',
                  color: page === i + 1 ? '#000' : C.muted,
                }}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal nouvelle facture */}
      {showModal && (
        <Modal title={
            editingId
              ? (form.type === 'avoir' ? t('factures.edit_avoir') : t('factures.edit'))
              : (form.type === 'avoir' ? t('factures.new_avoir') : t('factures.new'))
          }
          onClose={closeModal} width={720}>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Selecteur type SYSCOHADA — les devis/proformas ont leur propre page */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                { key: 'facture',  label: t('factures.type_facture'),  color: C.accent, desc: t('factures.type_facture_desc') },
                { key: 'avoir',    label: t('factures.type_avoir'),    color: C.red,    desc: t('factures.type_avoir_desc') },
              ].map(({ key, label, color, desc }) => (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))} style={{
                  padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${form.type === key ? color : C.border}`,
                  background: form.type === key ? `${color}18` : 'transparent',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: form.type === key ? color : C.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 9, color: form.type === key ? color : C.muted, opacity: 0.8 }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Bandeau contextuel selon type */}
            {form.type === 'avoir' && (
              <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 9, padding: '9px 13px', fontSize: 11, color: C.red }}>
                <strong>Avoir SYSCOHADA :</strong> Annule partiellement ou totalement une facture precedente. Indiquer la reference dans les notes.
              </div>
            )}
            {form.type === 'facture' && (
              <div style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 9, padding: '9px 13px', fontSize: 11, color: C.muted }}>
                Besoin d'un <strong style={{ color: C.blue }}>devis</strong> ou d'une <strong style={{ color: C.blue }}>proforma</strong> ? Rendez-vous sur la page <strong style={{ color: C.blue }}>Devis &amp; Proformas</strong> — un devis accepté se convertit en facture en un clic.
              </div>
            )}

            {/* Client + dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.client')} <span style={{ color: C.accent }}>*</span></label>
                <select value={form.client_id} onChange={set('client_id')} required
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: form.client_id ? C.text : C.muted, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  <option value="">— {t('common.search')} —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.emission_date')} <span style={{ color: C.accent }}>*</span></label>
                <input type="date" value={form.date_emission} onChange={set('date_emission')} required
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('common.due_date')}
                </label>
                <input type="date" value={form.date_echeance} onChange={set('date_echeance')}
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Reference facture origine pour avoirs (obligatoire SYSCOHADA) */}
            {form.type === 'avoir' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('factures.field_facture_origine')} <span style={{ color: C.red }}>*</span>
                </label>
                <select value={form.facture_origine_id} onChange={set('facture_origine_id')} required
                  style={{ background: C.input, border: `1.5px solid ${C.red}50`, borderRadius: 9, padding: '10px 12px', color: form.facture_origine_id ? C.text : C.muted, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  <option value="">— {t('factures.select_facture_origine')} —</option>
                  {facturesEligibles
                    .filter(f => !form.client_id || f.client_id === form.client_id)
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.numero} — {f.client_nom || '—'} ({parseFloat(f.total_ttc).toLocaleString('fr-FR')} FCFA)
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>
                  Obligatoire pour conformité SYSCOHADA. La liste se restreint au client sélectionné si renseigné.
                </span>
              </div>
            )}

            {/* En-tete colonnes */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 6 }}>
                {[
                  t('common.description'),
                  t('common.quantity'),
                  t('factures.line_unit'),
                  form.type === 'avoir' ? t('factures.line_credit_price') : t('factures.line_unit_price'),
                  t('factures.line_discount'),
                  ''
                ].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>

              {form.lignes.map((l, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 0.8fr) 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <input value={l.description}
                      onChange={e => { updateLigne(idx, 'description', e.target.value); if (l.produit_id) reinitProduit(idx); }}
                      list={`produits-${idx}`}
                      placeholder={form.type === 'avoir' ? t('factures.line_credit_description') : t('factures.line_description')} required
                      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box',
                        background: C.input,
                        border: `1.5px solid ${l.produit_id ? C.accent : C.border}`,
                        borderRadius: 8, padding: '9px 11px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                      onBlur={e => {
                        // Si la saisie correspond exactement à un produit du catalogue → auto-fill
                        if (!l.produit_id) {
                          const p = produitsCatalogue.find(pp => pp.libelle === e.target.value);
                          if (p) choisirProduit(idx, p);
                        }
                      }} />
                    <datalist id={`produits-${idx}`}>
                      {produitsCatalogue.map(p => (
                        <option key={p.id} value={p.libelle}>
                          {p.code} · {new Intl.NumberFormat('fr-FR').format(Math.round(p.prix_vente_ht))} FCFA{p.type === 'produit' ? ` · stock ${p.stock_actuel}` : ''}
                        </option>
                      ))}
                    </datalist>
                    {l.produit_id && (
                      <span title="Lié au catalogue"
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                          background: C.accent, color: dark ? '#000' : '#fff',
                        }}>P</span>
                    )}
                  </div>
                  <input type="number" value={l.quantite} onChange={e => updateLigne(idx, 'quantite', e.target.value)}
                    placeholder="1" min="0.001" step="any"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <input value={l.unite} onChange={e => updateLigne(idx, 'unite', e.target.value)}
                    placeholder="unite"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  <input type="number" value={l.prix_unitaire} onChange={e => updateLigne(idx, 'prix_unitaire', e.target.value)}
                    placeholder="0" required min="0"
                    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: C.input, border: `1.5px solid ${form.type === 'avoir' ? C.red + '60' : C.border}`, borderRadius: 8, padding: '9px 8px', color: form.type === 'avoir' ? C.red : C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
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
                marginTop: 4, padding: '9px 0', background: 'none',
                border: `1.5px dashed ${C.accent}50`, borderRadius: 9,
                color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
              }}>
                + {t('factures.add_line')}
              </button>
            </div>

            {/* Totaux */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 280, background: dark ? '#0D1525' : C.cardAlt, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 8 }}>
                  <span>{t('factures.totals_subtotal')}</span>
                  <span style={{ fontFamily: 'monospace', color: C.text }}>{formatFCFA(sousTotal)} {t('common.currency')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.sub }}>{t('common.tva')}</span>
                    <select value={form.taux_tva} onChange={set('taux_tva')}
                      style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', color: C.text, fontSize: 11, outline: 'none' }}>
                      <option value={0}>0% (Exonere)</option>
                      <option value={9}>9% (reduit)</option>
                      <option value={18}>18% (normal)</option>
                    </select>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: C.sub }}>{formatFCFA(tva)} {t('common.currency')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: `1px solid ${C.border}`, paddingTop: 10,
                  color: form.type === 'avoir' ? C.red : C.accent }}>
                  <span>{t('factures.totals_ttc').toUpperCase()}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatFCFA(ttc)} {t('common.currency')}</span>
                </div>
              </div>
            </div>

            {/* Conditions et notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {form.type === 'avoir' ? t('factures.field_motif_avoir') : t('factures.field_conditions')}
                </label>
                <select value={form.conditions_paiement} onChange={set('conditions_paiement')}
                  style={{ background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {form.type === 'avoir' ? <>
                    <option>Remboursement par virement</option>
                    <option>Credit sur prochaine facture</option>
                    <option>Retour marchandise</option>
                    <option>Erreur de facturation</option>
                    <option>Geste commercial</option>
                  </> : <>
                    <option>Paiement a 30 jours</option>
                    <option>Paiement a 45 jours</option>
                    <option>Paiement a 60 jours</option>
                    <option>Paiement a la livraison</option>
                    <option>Paiement comptant</option>
                    <option>50% commande, 50% livraison</option>
                  </>}
                </select>
              </div>
              <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />
            </div>

            {/* Brouillon vs validation */}
            <div style={{ fontSize: 11, color: C.muted, padding: '8px 12px', background: `${C.accent}08`, border: `1px solid ${C.border}`, borderRadius: 8, lineHeight: 1.5 }}>
              {t('factures.draft_info')}
              <br />
              {t('factures.validate_info')}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={closeModal}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>

              {editingId ? (
                <button type="button" onClick={() => handleSave(false)} disabled={saving}
                  style={{
                    flex: 3, padding: '11px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    background: saving ? C.border : C.accent,
                    color: saving ? C.muted : '#000',
                  }}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => handleSave(false)} disabled={saving}
                    style={{
                      flex: 1.5, padding: '11px 0', borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: 'transparent',
                      color: saving ? C.muted : C.sub,
                      fontSize: 13, fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                    {saving ? '...' : t('factures.save_draft')}
                  </button>
                  <button type="button" onClick={() => handleSave(true)} disabled={saving}
                    style={{
                      flex: 1.5, padding: '11px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      background: saving ? C.border : form.type === 'avoir' ? C.red : C.accent,
                      color: saving ? C.muted : '#000',
                    }}>
                    {saving ? t('factures.creating') : form.type === 'avoir' ? t('factures.save_and_validate_avoir') : t('factures.save_and_validate')}
                  </button>
                </>
              )}
            </div>
          </form>
        </Modal>
      )}

            {/* Modal paiement */}
      {showPaiement && (
        <Modal title={t('factures.paiement_title', { numero: showPaiement.numero })} onClose={() => setShowPaiement(null)} width={420}>
          <div style={{ background: C.hover, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('factures.paiement_remaining').toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.red, fontFamily: 'monospace' }}>
              {formatFCFA(parseFloat(showPaiement.total_ttc) - parseFloat(showPaiement.montant_paye))} {t('common.currency')}
            </div>
          </div>
          <form onSubmit={handlePaiement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label={t('factures.paiement_amount')} type="number" value={paiementForm.montant} onChange={e => setPaiementForm(p => ({ ...p, montant: e.target.value }))} required />
            <Input label={t('factures.paiement_date')} type="date" value={paiementForm.date_paiement} onChange={e => setPaiementForm(p => ({ ...p, date_paiement: e.target.value }))} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('factures.paiement_mode')}</label>
              <select value={paiementForm.mode_paiement} onChange={e => setPaiementForm(p => ({ ...p, mode_paiement: e.target.value, compte_tresorerie_id: '' }))}
                style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                {['virement', 'cash', 'cheque', 'mobile_money', 'carte'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('factures.paiement_account')}</label>
              <select value={paiementForm.compte_tresorerie_id} onChange={e => setPaiementForm(p => ({ ...p, compte_tresorerie_id: e.target.value }))}
                style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                <option value="">{t('factures.paiement_default_account')}</option>
                {comptesTresorerie
                  .filter(c => {
                    const m = paiementForm.mode_paiement;
                    const typeAttendu = m === 'cash' ? 'caisse' : m === 'mobile_money' ? 'mobile_money' : 'banque';
                    return c.type === typeAttendu;
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nom}{c.operateur ? ` (${c.operateur})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <Input label={t('factures.paiement_reference')} value={paiementForm.reference} onChange={e => setPaiementForm(p => ({ ...p, reference: e.target.value }))} placeholder={t('factures.paiement_reference_placeholder')} />
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowPaiement(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: C.accent, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? t('factures.paiement_saving') : t('factures.paiement_confirm')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Onboarding pageKey="factures" />
    </div>
  );
}