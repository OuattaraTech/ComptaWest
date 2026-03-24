import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Input, Modal, StatutBadge } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';

const STATUT_CFG = {
  payee:      { label: 'Payée',      bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
  en_attente: { label: 'En attente', bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
  annulee:    { label: 'Annulée',    bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
};

const MODES = ['virement','cash','cheque','mobile_money','carte'];

const emptyForm = {
  categorie_id: '', description: '', fournisseur: '', montant_ht: '',
  taux_tva: 0, date_depense: new Date().toISOString().split('T')[0],
  statut: 'payee', mode_paiement: 'virement', reference: '', notes: '',
};

export default function DepensesPage() {
  const { dark } = useTheme();
  const C = getC(dark);

  const [depenses, setDepenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
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
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [search, filtreCategorie, filtreStatut, page, annee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const montantTVA = (parseFloat(form.montant_ht) || 0) * (parseFloat(form.taux_tva) || 0) / 100;
  const montantTTC = (parseFloat(form.montant_ht) || 0) + montantTVA;

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
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
      if (editId) { await api.put(`/depenses/${editId}`, form); toast.success('Dépense mise à jour'); }
      else { await api.post('/depenses', form); toast.success('Dépense créée'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try { await api.delete(`/depenses/${id}`); toast.success('Supprimée'); fetchData(); }
    catch { toast.error('Erreur suppression'); }
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
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Dépenses</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {pagination.total} dépenses · {formatFCFA(stats?.total_annee || 0, true)} FCFA en {annee}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.red} />
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10,
            border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={15} /> Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Stats visuelles */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: C.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.text }}>Évolution mensuelle {annee}</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.par_mois}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`${formatFCFA(v)} FCFA`, 'Total']} contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                <Bar dataKey="total" fill={C.red} radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: C.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.text }}>Répartition par catégorie</div>
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher..."
            style={{ ...inputStyle, paddingLeft: 32, background: C.card }} />
        </div>
        <select value={filtreCategorie} onChange={e => { setFiltreCategorie(e.target.value); setPage(1); }} style={{ ...inputStyle, background: C.card, width: 'auto' }}>
          <option value="">Toutes les catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        {['','payee','en_attente'].map(s => (
          <button key={s} onClick={() => { setFiltreStatut(s); setPage(1); }} style={{
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtreStatut === s ? C.red : C.border}`,
            background: filtreStatut === s ? `${C.red}15` : 'transparent',
            color: filtreStatut === s ? C.red : C.muted, transition: 'all 0.15s',
          }}>{{ '': 'Tous', payee: 'Payées', en_attente: 'En attente' }[s]}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {['N°', 'Description', 'Catégorie', 'Fournisseur', 'Montant TTC', 'Date', 'Statut', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement...</td></tr>
            ) : depenses.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucune dépense. Commencez à les enregistrer !</td></tr>
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
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(d)} style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                        <Edit2 size={12} />
                      </button>
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
            <span style={{ fontSize: 12, color: C.muted }}>Page {page} / {pagination.pages}</span>
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
        <Modal title={editId ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Catégorie</label>
              <select value={form.categorie_id} onChange={set('categorie_id')} style={{ ...inputStyle }}>
                <option value="">— Sans catégorie —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.nom}</option>)}
              </select>
            </div>
            <Input label="Description" value={form.description} onChange={set('description')} placeholder="Ex: Loyer Bureau - Janvier" required />
            <Input label="Fournisseur" value={form.fournisseur} onChange={set('fournisseur')} placeholder="Orange CI, Landlord..." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Montant HT (FCFA)" type="number" value={form.montant_ht} onChange={set('montant_ht')} placeholder="0" required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TVA (%)</label>
                <select value={form.taux_tva} onChange={set('taux_tva')} style={{ ...inputStyle }}>
                  <option value={0}>0% (exonéré)</option>
                  <option value={9}>9%</option>
                  <option value={18}>18% (standard)</option>
                </select>
              </div>
            </div>
            {parseFloat(form.montant_ht) > 0 && (
              <div style={{ background: dark ? '#0D1525' : '#EEF2F7', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>TVA : {formatFCFA(montantTVA)} FCFA</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.red }}>TTC : {formatFCFA(montantTTC)} FCFA</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Date" type="date" value={form.date_depense} onChange={set('date_depense')} required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mode paiement</label>
                <select value={form.mode_paiement} onChange={set('mode_paiement')} style={{ ...inputStyle }}>
                  {MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</label>
                <select value={form.statut} onChange={set('statut')} style={{ ...inputStyle }}>
                  <option value="payee">Payée</option>
                  <option value="en_attente">En attente</option>
                </select>
              </div>
              <Input label="Référence" value={form.reference} onChange={set('reference')} placeholder="Réf. paiement..." />
            </div>
            <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Notes complémentaires..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Annuler</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.red, color: saving ? C.muted : '#fff',
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Enregistrement...' : editId ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
