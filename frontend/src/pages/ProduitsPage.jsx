import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import {
  Plus, Search, Edit2, Trash2, Eye, Package, Box, Wrench,
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, ClipboardCheck,
  ChevronLeft, CheckCircle, BarChart3, TrendingUp, ListChecks,
} from 'lucide-react';

const fmt = (n) => formatFCFA(n, false);
const fmtQ = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(parseFloat(n) || 0);

// Couleurs et icônes par sens ; libellés résolus via t('produits.movement_*') au rendu.
const SENS_COLORS = {
  entree:     { color: '#00A882', icon: ArrowDownCircle },
  sortie:     { color: '#C01833', icon: ArrowUpCircle },
  ajustement: { color: '#A0660A', icon: ListChecks },
};

export default function ProduitsPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const [tab, setTab] = useState('catalogue');
  const [selected, setSelected] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);

  if (selected) return <ProduitDetail id={selected} onBack={() => setSelected(null)} C={C} dark={dark} />;
  if (selectedInv) return <InventaireDetail id={selectedInv} onBack={() => setSelectedInv(null)} C={C} dark={dark} />;

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('produits.title')}</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{t('produits.subtitle')}</p>
      </div>

      <StatsBandeau C={C} dark={dark} />

      <div data-onboarding="tabs" style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {[
          { id: 'catalogue',    label: t('produits.tab_catalog'),   icon: Package },
          { id: 'mouvements',   label: t('produits.tab_movements'), icon: ArrowDownCircle },
          { id: 'inventaires',  label: t('produits.tab_inventory'), icon: ClipboardCheck },
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

      {tab === 'catalogue'   && <CatalogueTab onSelect={setSelected} C={C} dark={dark} />}
      {tab === 'mouvements'  && <MouvementsTab C={C} dark={dark} />}
      {tab === 'inventaires' && <InventairesTab onSelect={setSelectedInv} C={C} dark={dark} />}

      <Onboarding pageKey="produits" />
    </div>
  );
}

// ─── KPI BANDEAU ──────────────────────────────────────────────────────────
function StatsBandeau({ C, dark }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/produits/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);
  if (!stats) return null;

  return (
    <div data-onboarding="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
      {[
        { label: t('produits.stat_total_products'),  val: stats.nb_produits,         color: C.accent, icon: Box,           sub: `${stats.nb_services} ${t('produits.type_service').toLowerCase()}` },
        { label: t('produits.stat_stock_value'),     val: stats.valeur_stock_totale, color: C.blue,   icon: Package,       sub: 'CMP' },
        { label: t('produits.stat_low_stock'),       val: stats.nb_alertes,          color: C.gold,   icon: AlertTriangle, sub: t('common.tva').replace('TVA','') },
        { label: t('common.no_data'),                val: stats.nb_ruptures,         color: C.red,    icon: AlertTriangle, sub: 'stock = 0' },
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
            {typeof k.val === 'number' ? new Intl.NumberFormat('fr-FR').format(Math.round(k.val)) : k.val}
            {typeof k.val === 'number' && k.val > 1000 && <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{t('common.currency')}</span>}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET CATALOGUE
// ═══════════════════════════════════════════════════════════════════════════
function CatalogueTab({ onSelect, C, dark }) {
  const { t } = useTranslation();
  const [produits, setProduits] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [alerte, setAlerte] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, limit: '100' });
      if (type) params.set('type', type);
      if (alerte) params.set('alerte', 'true');
      const res = await api.get(`/produits?${params}`);
      setProduits(res.data.data);
    } catch { toast.error(t('produits.error_load')); }
    finally { setLoading(false); }
  }, [search, type, alerte, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (p) => {
    if (!confirm(t('produits.confirm_archive', { libelle: p.libelle }))) return;
    try { await api.delete(`/produits/${p.id}`); toast.success(t('produits.archived')); fetchData(); }
    catch { toast.error(t('produits.error_save')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 0 240px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('produits.search_placeholder')}
            style={{ width: '100%', background: C.card, border: `1.5px solid ${C.border}`,
              borderRadius: 10, padding: '10px 12px 10px 36px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        {[
          { v: '',         l: t('common.all') },
          { v: 'produit',  l: t('produits.type_product') },
          { v: 'service',  l: t('produits.type_service') },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setType(v)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${type === v ? C.accent : C.border}`,
            background: type === v ? `${C.accent}15` : 'transparent',
            color: type === v ? C.accent : C.muted,
          }}>{l}</button>
        ))}
        <button onClick={() => setAlerte(a => !a)} style={{
          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          border: `1.5px solid ${alerte ? C.gold : C.border}`,
          background: alerte ? `${C.gold}15` : 'transparent',
          color: alerte ? C.gold : C.muted, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertTriangle size={12} /> {t('produits.stat_low_stock')}
        </button>
        <div style={{ flex: 1 }} />
        <button data-onboarding="btn-nouveau" onClick={() => { setEditing(null); setShowForm(true); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> {t('produits.new')}
        </button>
      </div>

      <div data-onboarding="liste" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('produits.col_code'),
                t('produits.col_label'),
                t('common.category'),
                t('produits.col_type'),
                t('produits.col_price_sale'),
                t('produits.col_stock'),
                t('produits.col_price_buy'),
                t('produits.col_stock_value'),
                '',
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : produits.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {search || type || alerte ? t('clients.no_results') : t('produits.empty')}
              </td></tr>
            ) : produits.map(p => {
              const stock = parseFloat(p.stock_actuel) || 0;
              const seuil = parseFloat(p.seuil_alerte);
              const enAlerte = p.type === 'produit' && seuil && stock <= seuil;
              const rupture = p.type === 'produit' && stock <= 0;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                  onClick={() => onSelect(p.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{p.code}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{truncate(p.libelle, 32)}</div>
                    {p.reference_externe && <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{p.reference_externe}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{p.categorie_libelle || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                                  background: p.type === 'produit' ? `${C.accent}18` : `${C.purple}18`,
                                  color: p.type === 'produit' ? C.accent : C.purple }}>
                      {p.type === 'produit' ? <><Box size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('produits.type_product')}</> : <><Wrench size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('produits.type_service')}</>}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                    {fmt(p.prix_vente_ht)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {p.type === 'service' ? <span style={{ fontSize: 11, color: C.muted }}>—</span> : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                                      color: rupture ? C.red : enAlerte ? C.gold : C.text }}>
                          {fmtQ(stock)} {p.unite}
                        </span>
                        {rupture && <AlertTriangle size={12} color={C.red} />}
                        {!rupture && enAlerte && <AlertTriangle size={12} color={C.gold} />}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>
                    {p.type === 'service' ? '—' : fmt(p.cmp)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.blue, fontWeight: 600 }}>
                    {p.type === 'service' ? '—' : fmt(p.valeur_stock)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditing(p); setShowForm(true); }}
                        style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDelete(p)}
                        style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProduitFormModal produit={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); toast.success(editing ? t('produits.saved') : t('produits.created')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

// ─── MODAL CRÉATION / ÉDITION PRODUIT ─────────────────────────────────────
function ProduitFormModal({ produit, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(produit || {
    code: '', libelle: '', description: '', type: 'produit', categorie_id: '',
    prix_vente_ht: '', prix_achat_ht: '', taux_tva: 18, unite: 'unité',
    stock_initial: 0, seuil_alerte: '', methode_valorisation: 'CMP',
    reference_externe: '', fournisseur_principal: '',
  });

  useEffect(() => {
    api.get('/produits/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleCategorie = (catId) => {
    setForm(f => {
      const cat = categories.find(c => c.id === catId);
      return {
        ...f,
        categorie_id: catId,
        type: cat?.type || f.type,
        taux_tva: cat?.taux_tva || f.taux_tva,
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.libelle) { toast.error(t('produits.field_label')); return; }
    setSaving(true);
    try {
      if (produit) {
        await api.put(`/produits/${produit.id}`, form);
      } else {
        await api.post('/produits', form);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('produits.error_save'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={produit ? `${t('produits.edit')} — ${produit.libelle}` : t('produits.new')} onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Input label={t('common.code')} value={form.code} onChange={set('code')} placeholder="P-0001" />
          <Input label={`${t('produits.field_label')} *`} value={form.libelle} onChange={set('libelle')} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('common.category')}</label>
            <select value={form.categorie_id || ''} onChange={e => handleCategorie(e.target.value)} style={selectStyle}>
              <option value="">— {t('common.search')} —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.libelle} ({c.type})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('produits.field_type')} *</label>
            <select value={form.type} onChange={set('type')} style={selectStyle} disabled={!!produit}>
              <option value="produit">{t('produits.type_product')}</option>
              <option value="service">{t('produits.type_service')}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input label={t('produits.field_price_sale')} type="number" value={form.prix_vente_ht} onChange={set('prix_vente_ht')} placeholder="0" />
          <Input label={t('produits.field_price_buy')} type="number" value={form.prix_achat_ht} onChange={set('prix_achat_ht')} placeholder="0" />
          <Input label={t('produits.field_tva_rate')} type="number" value={form.taux_tva} onChange={set('taux_tva')} placeholder="18" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('produits.field_unit')} value={form.unite} onChange={set('unite')} placeholder="kg, h, ..." />
          <Input label={t('common.reference')} value={form.reference_externe} onChange={set('reference_externe')} />
        </div>

        {form.type === 'produit' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label={t('produits.field_initial_stock')} type="number" value={form.stock_initial}
                onChange={set('stock_initial')} placeholder="0" />
              <Input label={t('produits.field_min_stock')} type="number" value={form.seuil_alerte} onChange={set('seuil_alerte')} placeholder="10" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('produits.col_price_buy')}</label>
                <select value={form.methode_valorisation} onChange={set('methode_valorisation')} style={selectStyle}>
                  <option value="CMP">CMP (SYSCOHADA)</option>
                  <option value="FIFO">FIFO</option>
                </select>
              </div>
            </div>
            <Input label={t('common.supplier')} value={form.fournisseur_principal} onChange={set('fournisseur_principal')} />
          </>
        )}

        <Input label={t('produits.field_description')} value={form.description} onChange={set('description')} />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : produit ? t('common.save') : t('produits.create_button')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VUE DÉTAIL PRODUIT
// ═══════════════════════════════════════════════════════════════════════════
function ProduitDetail({ id, onBack, C, dark }) {
  const { t } = useTranslation();
  const [produit, setProduit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMvt, setShowMvt] = useState(null);  // 'entree' | 'sortie' | 'ajustement'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/produits/${id}`);
      setProduit(r.data.data);
    } catch { toast.error(t('produits.error_load')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !produit) {
    return (
      <div style={{ padding: '32px 36px', background: C.bg, minHeight: '100vh' }}>
        <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back')}</button>
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>{t('common.loading')}</div>
      </div>
    );
  }

  const stock = parseFloat(produit.stock_actuel) || 0;
  const seuil = parseFloat(produit.seuil_alerte);
  const enAlerte = produit.type === 'produit' && seuil && stock <= seuil;
  const rupture = produit.type === 'produit' && stock <= 0;

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back_to_list')}</button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginTop: 18, marginBottom: 22, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14,
              background: produit.type === 'produit' ? `${C.accent}18` : `${C.purple}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {produit.type === 'produit' ? <Package size={26} color={C.accent} /> : <Wrench size={26} color={C.purple} />}
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{produit.libelle}</h1>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {t('common.code')} <strong style={{ color: C.accent, fontFamily: 'monospace' }}>{produit.code}</strong>
                {produit.categorie_libelle ? ` · ${produit.categorie_libelle}` : ''}
                {produit.reference_externe ? ` · ${produit.reference_externe}` : ''}
              </p>
              {produit.description && <p style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{produit.description}</p>}
            </div>
          </div>
          {produit.type === 'produit' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setShowMvt('entree')} style={{ ...btnSec(C), borderColor: `${C.accent}50`, color: C.accent }}>
                <ArrowDownCircle size={13} /> {t('produits.movement_in')}
              </button>
              <button onClick={() => setShowMvt('sortie')} style={{ ...btnSec(C), borderColor: `${C.red}50`, color: C.red }}>
                <ArrowUpCircle size={13} /> {t('produits.movement_out')}
              </button>
              <button onClick={() => setShowMvt('ajustement')} style={btnSec(C)}>
                <ListChecks size={13} /> {t('produits.movement_adjustment')}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 22 }}>
          {[
            produit.type === 'produit'
              ? { label: t('produits.col_stock'), val: `${fmtQ(stock)} ${produit.unite}`,
                  color: rupture ? C.red : enAlerte ? C.gold : C.accent, fmt: 'text' }
              : { label: t('produits.field_type'), val: t('produits.type_service'), color: C.purple, fmt: 'text' },
            { label: t('produits.field_price_sale'), val: produit.prix_vente_ht, color: C.text },
            { label: t('produits.field_price_buy'),  val: produit.prix_achat_ht, color: C.muted },
            produit.type === 'produit'
              ? { label: t('produits.col_stock_value'), val: produit.valeur_stock, color: C.blue, sub: `CMP ${fmt(produit.cmp)}` }
              : { label: t('common.tva'),                val: `${produit.taux_tva}%`, color: C.muted, fmt: 'text' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 14, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'monospace', marginTop: 5 }}>
                {s.fmt === 'text' ? s.val : fmt(s.val)}
                {s.fmt !== 'text' && <span style={{ fontSize: 9, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{t('common.currency')}</span>}
              </div>
              {s.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Mouvements */}
      {produit.type === 'produit' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t('produits.movements_title')}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                {[
                  t('produits.movements_col_date'),
                  t('produits.movements_col_sense'),
                  t('produits.movements_col_source'),
                  t('common.description'),
                  t('produits.movements_col_quantity'),
                  t('produits.movements_col_unit_value'),
                  t('produits.movements_col_total'),
                  t('produits.col_stock'),
                ].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(produit.mouvements || []).length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('produits.movements_empty')}</td></tr>
              ) : produit.mouvements.map(m => {
                const sc = SENS_COLORS[m.sens] || SENS_COLORS.entree;
                const Icon = sc.icon;
                const sensLabel = m.sens === 'entree' ? t('produits.movement_in') : m.sens === 'sortie' ? t('produits.movement_out') : t('produits.movement_adjustment');
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{formatDate(m.date_mouvement)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: sc.color }}>
                        <Icon size={12} /> {sensLabel}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 10, color: C.muted }}>
                      {m.source_type}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: C.text, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.libelle}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: sc.color }}>
                      {m.sens === 'entree' ? '+' : m.sens === 'sortie' ? '−' : '±'}{fmtQ(m.quantite)}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(m.prix_unitaire)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.text }}>{fmt(m.valeur_totale)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.blue }}>{fmtQ(m.stock_apres)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showMvt && (
        <MouvementFormModal produit={produit} sens={showMvt}
          onClose={() => setShowMvt(null)}
          onSaved={() => { setShowMvt(null); fetchData(); toast.success(t('produits.saved')); }}
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

// ─── MODAL MOUVEMENT MANUEL ───────────────────────────────────────────────
function MouvementFormModal({ produit, sens, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    quantite: '', prix_unitaire: sens === 'entree' ? produit.prix_achat_ht : '',
    date_mouvement: new Date().toISOString().split('T')[0],
    libelle: '', reference: '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.quantite || (sens !== 'ajustement' && parseFloat(form.quantite) <= 0)) {
      toast.error(t('produits.field_quantity')); return;
    }
    setSaving(true);
    try {
      await api.post(`/produits/${produit.id}/mouvement`, { sens, ...form });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('produits.error_save'));
    } finally { setSaving(false); }
  };

  const titre = sens === 'entree' ? t('produits.movement_in') : sens === 'sortie' ? t('produits.movement_out') : t('produits.movement_adjustment');

  return (
    <Modal title={`${titre} · ${produit.libelle}`} onClose={onClose} width={460}>
      <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '12px 14px', borderRadius: 10, marginBottom: 14, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: C.muted }}>{t('produits.col_stock')}</span>
          <strong style={{ color: C.text, fontFamily: 'monospace' }}>{fmtQ(produit.stock_actuel)} {produit.unite}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: C.muted }}>CMP</span>
          <strong style={{ color: C.text, fontFamily: 'monospace' }}>{fmt(produit.cmp)} {t('common.currency')}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label={`${t('produits.field_quantity')} *`}
            type="number" value={form.quantite} onChange={set('quantite')} placeholder="0" required />
          <Input label={t('common.date')} type="date" value={form.date_mouvement} onChange={set('date_mouvement')} />
        </div>
        {sens === 'entree' && (
          <Input label={t('produits.field_unit_value')} type="number" value={form.prix_unitaire} onChange={set('prix_unitaire')} placeholder={produit.prix_achat_ht} />
        )}
        <Input label={t('produits.field_libelle')} value={form.libelle} onChange={set('libelle')} />
        <Input label={t('common.reference')} value={form.reference} onChange={set('reference')} />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : t('common.save')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET MOUVEMENTS (journal global)
// ═══════════════════════════════════════════════════════════════════════════
function MouvementsTab({ C, dark }) {
  const { t } = useTranslation();
  const [mouvements, setMouvements] = useState([]);
  const [sens, setSens] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: '50' });
      if (sens) params.set('sens', sens);
      const res = await api.get(`/produits/stocks/mouvements?${params}`);
      setMouvements(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error(t('produits.error_load')); }
    finally { setLoading(false); }
  }, [sens, page, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: '',           l: t('common.all') },
          { v: 'entree',     l: t('produits.movement_in') },
          { v: 'sortie',     l: t('produits.movement_out') },
          { v: 'ajustement', l: t('produits.movement_adjustment') },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => { setSens(v); setPage(1); }} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${sens === v ? C.accent : C.border}`,
            background: sens === v ? `${C.accent}15` : 'transparent',
            color: sens === v ? C.accent : C.muted,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('produits.movements_col_date'),
                t('produits.movements_col_product'),
                t('produits.movements_col_sense'),
                t('produits.movements_col_source'),
                t('common.description'),
                t('produits.movements_col_quantity'),
                t('produits.movements_col_unit_value'),
                t('produits.movements_col_total'),
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : mouvements.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('produits.movements_empty')}</td></tr>
            ) : mouvements.map(m => {
              const sc = SENS_COLORS[m.sens] || SENS_COLORS.entree;
              const Icon = sc.icon;
              const sensLabel = m.sens === 'entree' ? t('produits.movement_in') : m.sens === 'sortie' ? t('produits.movement_out') : t('produits.movement_adjustment');
              return (
                <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{formatDate(m.date_mouvement)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{truncate(m.produit_libelle, 26)}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{m.produit_code}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: sc.color }}>
                      <Icon size={12} /> {sensLabel}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 10, color: C.muted }}>{m.source_type}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: C.text, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.libelle}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: sc.color }}>
                    {m.sens === 'entree' ? '+' : m.sens === 'sortie' ? '−' : '±'}{fmtQ(m.quantite)} {m.unite}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(m.prix_unitaire)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.text, fontWeight: 600 }}>{fmt(m.valeur_totale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination.pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.muted }}>{t('common.page')} {page} {t('common.of')} {pagination.pages} · {pagination.total}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} style={{
                  width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${page === i + 1 ? C.accent : C.border}`,
                  background: page === i + 1 ? `${C.accent}15` : 'transparent',
                  color: page === i + 1 ? C.accent : C.muted,
                }}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET INVENTAIRES
// ═══════════════════════════════════════════════════════════════════════════
function InventairesTab({ onSelect, C, dark }) {
  const { t } = useTranslation();
  const [inventaires, setInventaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/produits/inventaires');
      setInventaires(res.data.data);
    } catch { toast.error(t('produits.error_load')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSupprimer = async (id) => {
    if (!confirm(t('produits.confirm_archive', { libelle: '' }))) return;
    try { await api.delete(`/produits/inventaires/${id}`); fetchData(); toast.success(t('produits.archived')); }
    catch (err) { toast.error(err.response?.data?.message || t('produits.error_save')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          {inventaires.length} {t('produits.tab_inventory').toLowerCase()}
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> {t('produits.inventory_new')}
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('dashboard.transactions_col_num'),
                t('produits.inventory_col_date'),
                t('produits.inventory_col_label'),
                t('produits.inventory_col_lines'),
                t('common.total'),
                t('common.amount'),
                t('produits.inventory_col_ecart'),
                t('produits.inventory_col_status'),
                '',
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : inventaires.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {t('produits.inventory_empty')}
              </td></tr>
            ) : inventaires.map(inv => (
              <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onClick={() => onSelect(inv.id)}
                onMouseEnter={e => e.currentTarget.style.background = C.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>{inv.numero}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{formatDate(inv.date_inventaire)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.sub }}>{inv.libelle || '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', color: C.text }}>{inv.nb_articles}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(inv.valeur_theorique)}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.text }}>{fmt(inv.valeur_physique)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                            color: parseFloat(inv.ecart_total) === 0 ? C.muted : parseFloat(inv.ecart_total) > 0 ? C.accent : C.red }}>
                  {parseFloat(inv.ecart_total) > 0 ? '+' : ''}{fmt(inv.ecart_total)}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                background: inv.statut === 'valide' ? `${C.accent}20` : `${C.gold}20`,
                                color: inv.statut === 'valide' ? C.accent : C.gold }}>
                    {inv.statut === 'valide' ? t('produits.inventory_status_valide') : inv.statut === 'brouillon' ? t('produits.inventory_status_brouillon') : t('statut.annulee')}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                  {inv.statut === 'brouillon' && (
                    <button onClick={() => handleSupprimer(inv.id)}
                      style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateInventaireModal
          onClose={() => setShowCreate(false)}
          onSaved={(inv) => { setShowCreate(false); fetchData(); onSelect(inv.id); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

function CreateInventaireModal({ onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    date_inventaire: new Date().toISOString().split('T')[0],
    libelle: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await api.post('/produits/inventaires', form);
      toast.success(`${res.data.data.numero} — ${t('produits.created')}`);
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('produits.error_save'));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={t('produits.inventory_new')} onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, padding: '12px 14px', background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
          {t('produits.inventory_subtitle')}
        </div>
        <Input label={`${t('produits.inventory_field_date')} *`} type="date" value={form.date_inventaire}
          onChange={e => setForm(f => ({ ...f, date_inventaire: e.target.value }))} required />
        <Input label={t('produits.inventory_field_label')} value={form.libelle}
          onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} />
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : t('produits.inventory_new')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── VUE DÉTAIL INVENTAIRE (saisie stock physique) ─────────────────────────
function InventaireDetail({ id, onBack, C, dark }) {
  const { t } = useTranslation();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Map id → stock_physique (édition locale)
  const [edits, setEdits] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/produits/inventaires/${id}`);
      setInv(r.data.data);
      const e = {};
      for (const l of r.data.data.lignes) e[l.id] = parseFloat(l.stock_physique);
      setEdits(e);
    } catch { toast.error(t('produits.error_load')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const lignes = Object.entries(edits).map(([lid, val]) => ({ id: lid, stock_physique: parseFloat(val) || 0 }));
      await api.put(`/produits/inventaires/${id}/lignes`, { lignes });
      toast.success(t('produits.saved'));
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('produits.error_save')); }
    finally { setSaving(false); }
  };

  const handleValider = async () => {
    if (!confirm(t('produits.inventory_confirm_validate'))) return;
    setSaving(true);
    try {
      await handleSave();
      await api.post(`/produits/inventaires/${id}/valider`);
      toast.success(t('produits.inventory_validated'));
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('produits.error_save')); }
    finally { setSaving(false); }
  };

  if (loading || !inv) {
    return (
      <div style={{ padding: '32px 36px', background: C.bg, minHeight: '100vh' }}>
        <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back')}</button>
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>{t('common.loading')}</div>
      </div>
    );
  }

  const editable = inv.statut === 'brouillon';

  // Calcul des totaux affichés (basés sur les valeurs éditées)
  const totaux = useMemo(() => {
    let theo = 0, phy = 0, nbEcart = 0;
    for (const l of inv.lignes) {
      const cmp = parseFloat(l.cmp);
      const t = parseFloat(l.stock_theorique);
      const p = parseFloat(edits[l.id] ?? l.stock_physique);
      theo += t * cmp;
      phy += p * cmp;
      if (Math.abs(p - t) > 0.001) nbEcart++;
    }
    return { theo, phy, ecart: phy - theo, nbEcart };
  }, [inv, edits]);

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> {t('common.back_to_list')}</button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '22px 26px', marginTop: 18, marginBottom: 20, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{inv.numero} · {inv.libelle}</h1>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              {t('produits.inventory_field_date')} : {formatDate(inv.date_inventaire)} · {inv.lignes.length}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editable && (
              <>
                <button onClick={handleSave} disabled={saving} style={btnSec(C)}>
                  {t('common.save')}
                </button>
                <button onClick={handleValider} disabled={saving} style={{
                  padding: '8px 16px', borderRadius: 9, border: 'none',
                  background: C.accent, color: dark ? '#000' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckCircle size={13} /> {t('produits.inventory_validate')}
                </button>
              </>
            )}
            {!editable && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8,
                            background: `${C.accent}18`, color: C.accent }}>
                ✓ {t('produits.inventory_status_valide')} {formatDate(inv.date_validation)}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 18 }}>
          {[
            { label: t('produits.inventory_col_stock_theory'), val: totaux.theo, color: C.muted },
            { label: t('produits.inventory_col_stock_real'),  val: totaux.phy,  color: C.text },
            { label: t('produits.inventory_col_value_difference'),     val: totaux.ecart, color: totaux.ecart === 0 ? C.muted : totaux.ecart > 0 ? C.accent : C.red },
            { label: t('produits.inventory_col_difference'), val: totaux.nbEcart, fmt: 'text', color: C.gold },
          ].map((s, i) => (
            <div key={i} style={{ padding: 12, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: 'monospace', marginTop: 4 }}>
                {s.fmt === 'text' ? s.val : `${s.val > 0 ? '+' : ''}${fmt(s.val)}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('produits.col_code'),
                t('produits.inventory_col_product'),
                t('produits.inventory_col_stock_theory'),
                t('produits.inventory_col_stock_real'),
                t('produits.inventory_col_difference'),
                t('produits.col_price_buy'),
                t('produits.inventory_col_value_difference'),
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inv.lignes.map(l => {
              const theo = parseFloat(l.stock_theorique);
              const phy = parseFloat(edits[l.id] ?? l.stock_physique);
              const ecart = phy - theo;
              const cmp = parseFloat(l.cmp);
              return (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}`, background: Math.abs(ecart) > 0.001 ? `${C.gold}08` : 'transparent' }}>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent }}>{l.produit_code}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.text }}>{l.produit_libelle}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: C.muted }}>{fmtQ(theo)} {l.unite}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="number" value={edits[l.id] ?? l.stock_physique}
                      onChange={e => setEdits(s => ({ ...s, [l.id]: e.target.value }))}
                      disabled={!editable} step="0.001"
                      style={{
                        width: 110, background: C.input, border: `1px solid ${C.border}`,
                        borderRadius: 7, padding: '6px 10px', color: C.text, fontSize: 12,
                        fontFamily: 'monospace', textAlign: 'right', outline: 'none',
                      }} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                              color: ecart === 0 ? C.muted : ecart > 0 ? C.accent : C.red }}>
                    {ecart > 0 ? '+' : ''}{fmtQ(ecart)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(cmp)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                              color: ecart === 0 ? C.muted : ecart > 0 ? C.accent : C.red }}>
                    {ecart > 0 ? '+' : ''}{fmt(ecart * cmp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
