import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import {
  Plus, Search, Edit2, Trash2, Download, Eye, Package, Building2,
  TrendingDown, AlertCircle, CheckCircle, XCircle, ChevronLeft,
  Calendar, Calculator, FileText, ArrowDownCircle,
} from 'lucide-react';

const STATUT_CFG = {
  en_service: { label: 'En service',   bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
  amorti:     { label: 'Amorti',       bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
  cede:       { label: 'Cédé',         bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
  rebut:      { label: 'Rebut',        bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' },
  vole_perdu: { label: 'Vol/Perte',    bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
};

const fmt = (n) => formatFCFA(n, false);

export default function ImmobilisationsPage() {
  const { dark } = useTheme();
  const C = getC(dark);

  const [tab, setTab] = useState('liste');
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <ImmoDetail id={selected} onBack={() => setSelected(null)} C={C} dark={dark} />;
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Immobilisations</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Registre des actifs · amortissements SYSCOHADA · cessions
          </p>
        </div>
      </div>

      <StatsBandeau annee={annee} setAnnee={setAnnee} C={C} dark={dark} />

      <div data-onboarding="tabs" style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {[
          { id: 'liste',     label: 'Registre',        icon: Package },
          { id: 'dotations', label: 'Plan & dotations', icon: Calculator },
        ].map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? C.text : C.muted,
              background: active ? C.cardAlt : 'transparent',
              cursor: 'pointer',
            }}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'liste'     && <RegistreTab onSelect={setSelected} C={C} dark={dark} />}
      {tab === 'dotations' && <DotationsTab annee={annee} setAnnee={setAnnee} C={C} dark={dark} />}

      <Onboarding pageKey="immobilisations" />
    </div>
  );
}

// ─── KPI BANDEAU ──────────────────────────────────────────────────────────
function StatsBandeau({ annee, setAnnee, C, dark }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get(`/immobilisations/stats?annee=${annee}`)
      .then(r => setStats(r.data.data))
      .catch(() => {});
  }, [annee]);

  if (!stats) return null;

  return (
    <div data-onboarding="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
      {[
        { label: 'Valeur brute', val: stats.valeur_brute, unit: 'FCFA', color: C.accent, icon: Package, sub: `${stats.nb_en_service} en service` },
        { label: 'Amortissements cumulés', val: stats.cumul_amortissements, unit: 'FCFA', color: C.red, icon: TrendingDown, sub: 'depuis l\'origine' },
        { label: 'Valeur nette comptable', val: stats.vnc_totale, unit: 'FCFA', color: C.blue, icon: Building2, sub: 'au bilan' },
        { label: `Dotation ${annee}`, val: stats.dotation_annee, unit: 'FCFA', color: C.gold, icon: Calendar, sub: 'cumulée année' },
      ].map((k, i) => (
        <div key={i} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '18px 20px', position: 'relative', overflow: 'hidden',
          boxShadow: C.shadow,
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 55, height: 55,
            background: `radial-gradient(circle at top right, ${k.color}25, transparent 70%)`,
            borderRadius: '0 14px 0 55px',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{k.label}</span>
            <k.icon size={14} color={k.color} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
            {new Intl.NumberFormat('fr-FR').format(Math.round(k.val))}
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{k.unit}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET REGISTRE
// ═══════════════════════════════════════════════════════════════════════════
function RegistreTab({ onSelect, C, dark }) {
  const [immos, setImmos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('en_service');
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/immobilisations?search=${encodeURIComponent(search)}&statut=${statut}&limit=100`);
      setImmos(res.data.data);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [search, statut]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 0 240px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            style={{ width: '100%', background: C.card, border: `1.5px solid ${C.border}`,
              borderRadius: 10, padding: '10px 12px 10px 36px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        {[
          { v: 'en_service', l: 'En service' },
          { v: 'amorti',     l: 'Amortis' },
          { v: 'cede',       l: 'Cédés' },
          { v: 'tous',       l: 'Tous' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setStatut(v)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${statut === v ? C.accent : C.border}`,
            background: statut === v ? `${C.accent}15` : 'transparent',
            color: statut === v ? C.accent : C.muted,
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button data-onboarding="btn-nouveau" onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> Nouvelle immobilisation
        </button>
      </div>

      <div data-onboarding="liste" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {['N°', 'Libellé', 'Catégorie', 'Acquise', 'Val. brute', 'Cumul amort.', 'VNC', 'Statut', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement...</td></tr>
            ) : immos.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {search ? 'Aucun résultat' : 'Aucune immobilisation. Cliquez sur « Nouvelle immobilisation ».'}
              </td></tr>
            ) : immos.map(i => {
              const cfg = STATUT_CFG[i.statut] || STATUT_CFG.en_service;
              return (
                <tr key={i.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                  onClick={() => onSelect(i.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{i.numero_inventaire}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{i.libelle}</div>
                    {i.fournisseur && <div style={{ fontSize: 10, color: C.muted }}>{i.fournisseur}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{i.categorie_libelle || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted }}>{formatDate(i.date_acquisition)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                    {fmt(i.valeur_acquisition)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.red }}>
                    −{fmt(i.cumul_amortissements)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.blue }}>
                    {fmt(i.vnc_actuelle)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Eye size={13} color={C.muted} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ImmobilisationFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); toast.success('Immobilisation créée'); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VUE DÉTAIL D'UNE IMMOBILISATION
// ═══════════════════════════════════════════════════════════════════════════
function ImmoDetail({ id, onBack, C, dark }) {
  const [immo, setImmo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCession, setShowCession] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/immobilisations/${id}`);
      setImmo(r.data.data);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadPDF = async () => {
    const toastId = toast.loading('Génération PDF...');
    try {
      const res = await api.get(`/immobilisations/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = `Amortissement_${immo.numero_inventaire}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      toast.dismiss(toastId); toast.success('Téléchargé');
    } catch { toast.dismiss(toastId); toast.error('Erreur PDF'); }
  };

  if (loading || !immo) {
    return (
      <div style={{ padding: '32px 36px', background: C.bg, minHeight: '100vh' }}>
        <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> Retour</button>
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>Chargement...</div>
      </div>
    );
  }

  const cfg = STATUT_CFG[immo.statut] || STATUT_CFG.en_service;
  const cumul = (immo.dotations || []).reduce((s, d) => s + parseFloat(d.dotation), 0);
  const vnc = parseFloat(immo.valeur_acquisition) - cumul;

  // Combine plan théorique + dotations passées
  const dotsByAnnee = Object.fromEntries((immo.dotations || []).map(d => [d.annee, d]));
  const planAffiche = (immo.plan_theorique || []).map(p => ({ ...p, passe: !!dotsByAnnee[p.annee], dotation_id: dotsByAnnee[p.annee]?.id }));

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      <button onClick={onBack} style={btnRetour(C)}><ChevronLeft size={14} /> Retour au registre</button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginTop: 18, marginBottom: 22, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={26} color={C.accent} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{immo.libelle}</h1>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                N° {immo.numero_inventaire}{immo.categorie_libelle ? ` · ${immo.categorie_libelle}` : ''}
                {immo.fournisseur ? ` · ${immo.fournisseur}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleDownloadPDF} style={btnSec(C)}><Download size={13} /> PDF</button>
            {immo.statut === 'en_service' && (
              <button onClick={() => setShowCession(true)} style={{
                padding: '8px 16px', borderRadius: 9, border: 'none',
                background: C.gold, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <ArrowDownCircle size={13} /> Sortir du registre
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 22 }}>
          {[
            { label: 'Valeur d\'acquisition', val: immo.valeur_acquisition, color: C.accent },
            { label: 'Amort. cumulés',        val: cumul,                   color: C.red },
            { label: 'VNC actuelle',          val: vnc,                     color: C.blue },
            { label: 'Val. résiduelle',       val: immo.valeur_residuelle,  color: C.muted },
          ].map((s, i) => (
            <div key={i} style={{ padding: 14, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'monospace', marginTop: 5 }}>
                {fmt(s.val)} <span style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>FCFA</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginTop: 16, padding: '12px 14px', background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
          {[
            { l: 'Acquise le',         v: formatDate(immo.date_acquisition) },
            { l: 'Mise en service',    v: formatDate(immo.date_mise_en_service) },
            { l: 'Durée',              v: immo.duree_annees ? `${immo.duree_annees} ans` : '—' },
            { l: 'Méthode',            v: immo.methode === 'degressif' ? `Dégressif×${immo.coefficient_degressif}` : 'Linéaire' },
            { l: 'Compte SYSCOHADA',   v: immo.compte_actif },
          ].map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{f.l}</div>
              <div style={{ fontSize: 12, color: C.text, marginTop: 3, fontFamily: i === 4 ? 'monospace' : 'inherit' }}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan d'amortissement */}
      {immo.amortissable ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Plan d'amortissement</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Les dotations « passées » ont déjà été enregistrées en comptabilité.
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                {['Année', 'Jours', 'Taux', 'VNC début', 'Dotation', 'Cumul amort.', 'VNC fin', 'État'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planAffiche.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                  Pas de plan calculable
                </td></tr>
              ) : planAffiche.map((p, idx) => (
                <tr key={idx} style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: p.passe ? `${C.accent}06` : 'transparent',
                }}>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: p.passe ? 700 : 500, color: C.text }}>{p.annee}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{p.jours_amortis}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{p.taux}%</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(p.vnc_debut)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: p.passe ? C.accent : C.text }}>
                    {fmt(p.dotation)}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.red }}>{fmt(p.cumul_amortissements)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.blue }}>{fmt(p.vnc_fin)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {p.passe
                      ? <CheckCircle size={14} color={C.accent} />
                      : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '32px 20px', textAlign: 'center', color: C.muted, fontSize: 13,
        }}>
          Immobilisation non amortissable (terrain, fonds de commerce…)
        </div>
      )}

      {showCession && (
        <CessionModal immo={immo}
          onClose={() => setShowCession(false)}
          onDone={() => { setShowCession(false); fetchData(); toast.success('Sortie enregistrée'); }}
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

// ═══════════════════════════════════════════════════════════════════════════
// MODAL CRÉATION / ÉDITION
// ═══════════════════════════════════════════════════════════════════════════
function ImmobilisationFormModal({ onClose, onSaved, C, dark }) {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    libelle: '', description: '', categorie_id: '',
    date_acquisition: new Date().toISOString().split('T')[0],
    date_mise_en_service: '',
    valeur_acquisition: '', valeur_residuelle: 0,
    duree_annees: '', methode: 'lineaire',
    fournisseur: '', reference_facture: '',
    emplacement: '', affecte_a: '', numero_serie: '',
  });

  useEffect(() => {
    api.get('/immobilisations/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Quand on choisit une catégorie, on pré-remplit durée et méthode
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
    if (!form.libelle || !form.date_acquisition || !form.valeur_acquisition) {
      toast.error('Libellé, date et valeur requis'); return;
    }
    setSaving(true);
    try {
      await api.post('/immobilisations', form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  const cat = categories.find(c => c.id === form.categorie_id);

  return (
    <Modal title="Nouvelle immobilisation" onClose={onClose} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Libellé *" value={form.libelle} onChange={set('libelle')} placeholder="Ordinateur portable Dell XPS 15" required />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Catégorie *</label>
          <select value={form.categorie_id} onChange={e => handleCategorie(e.target.value)} style={selectStyle} required>
            <option value="">— Sélectionner —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.libelle} ({c.duree_annees > 0 ? `${c.duree_annees} ans ${c.methode === 'degressif' ? 'dégressif' : 'linéaire'}` : 'non amortissable'}) · {c.compte_actif}
              </option>
            ))}
          </select>
          {cat && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Compte actif <strong style={{ color: C.text, fontFamily: 'monospace' }}>{cat.compte_actif}</strong>
              {cat.compte_amortissement && <> · Amort. <strong style={{ color: C.text, fontFamily: 'monospace' }}>{cat.compte_amortissement}</strong></>}
              {!cat.amortissable && <span style={{ color: C.gold }}> · non amortissable</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Date d'acquisition *" type="date" value={form.date_acquisition} onChange={set('date_acquisition')} required />
          <Input label="Mise en service" type="date" value={form.date_mise_en_service} onChange={set('date_mise_en_service')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label="Valeur d'acquisition HT (FCFA) *" type="number" value={form.valeur_acquisition} onChange={set('valeur_acquisition')} placeholder="1200000" required />
          <Input label="Valeur résiduelle" type="number" value={form.valeur_residuelle} onChange={set('valeur_residuelle')} placeholder="0" />
        </div>

        {cat?.amortissable !== false && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Durée (années)" type="number" value={form.duree_annees} onChange={set('duree_annees')} placeholder={cat?.duree_annees || ''} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Méthode</label>
              <select value={form.methode} onChange={set('methode')} style={selectStyle}>
                <option value="lineaire">Linéaire (SYSCOHADA standard)</option>
                <option value="degressif">Dégressif (matériel productif)</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Fournisseur" value={form.fournisseur} onChange={set('fournisseur')} placeholder="Nom du fournisseur" />
          <Input label="N° facture" value={form.reference_facture} onChange={set('reference_facture')} placeholder="FACT-2026-..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input label="Emplacement" value={form.emplacement} onChange={set('emplacement')} placeholder="Siège, salle informatique..." />
          <Input label="Affecté à" value={form.affecte_a} onChange={set('affecte_a')} placeholder="Service, employé..." />
          <Input label="N° série" value={form.numero_serie} onChange={set('numero_serie')} />
        </div>

        <Input label="Description (optionnelle)" value={form.description} onChange={set('description')} placeholder="Notes complémentaires..." />

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : 'Créer l\'immobilisation'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL CESSION / REBUT
// ═══════════════════════════════════════════════════════════════════════════
function CessionModal({ immo, onClose, onDone, C, dark }) {
  const cumul = (immo.dotations || []).reduce((s, d) => s + parseFloat(d.dotation), 0);
  const vnc = parseFloat(immo.valeur_acquisition) - cumul;

  const [form, setForm] = useState({
    statut: 'cede', date_sortie: new Date().toISOString().split('T')[0],
    valeur_cession: '', motif: '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const valCession = parseFloat(form.valeur_cession) || 0;
  const plusMoinsValue = valCession - vnc;

  const handleSubmit = async () => {
    if (!form.date_sortie) { toast.error('Date requise'); return; }
    setSaving(true);
    try {
      await api.post(`/immobilisations/${immo.id}/cession`, {
        ...form,
        valeur_cession: form.statut === 'cede' ? valCession : 0,
      });
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={`Sortie · ${immo.libelle}`} onClose={onClose} width={500}>
      <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '14px 16px', borderRadius: 10, marginBottom: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>VNC actuelle</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.blue, fontFamily: 'monospace' }}>
          {fmt(vnc)} FCFA
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Type de sortie</label>
          <select value={form.statut} onChange={set('statut')} style={selectStyle}>
            <option value="cede">Cession (vente)</option>
            <option value="rebut">Mise au rebut (destruction)</option>
            <option value="vole_perdu">Vol / Perte</option>
          </select>
        </div>

        <Input label="Date de sortie *" type="date" value={form.date_sortie} onChange={set('date_sortie')} required />

        {form.statut === 'cede' && (
          <>
            <Input label="Prix de cession (FCFA)" type="number" value={form.valeur_cession} onChange={set('valeur_cession')} placeholder="0" />
            {valCession > 0 && (
              <div style={{
                background: plusMoinsValue >= 0 ? `${C.accent}10` : `${C.red}10`,
                border: `1px solid ${plusMoinsValue >= 0 ? C.accent : C.red}30`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                  {plusMoinsValue >= 0 ? 'Plus-value de cession' : 'Moins-value de cession'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: plusMoinsValue >= 0 ? C.accent : C.red }}>
                  {plusMoinsValue >= 0 ? '+' : ''}{fmt(plusMoinsValue)} FCFA
                </div>
              </div>
            )}
          </>
        )}

        <Input label="Motif / commentaire" value={form.motif} onChange={set('motif')} placeholder="Vente à client X, panne définitive..." />

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.gold, color: saving ? C.muted : '#000',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '...' : 'Confirmer la sortie'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET DOTATIONS (génération annuelle)
// ═══════════════════════════════════════════════════════════════════════════
function DotationsTab({ annee, setAnnee, C, dark }) {
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState(null);

  const lancer = async () => {
    if (!confirm(`Générer les dotations d'amortissement pour l'exercice ${annee} ? Toutes les immobilisations actives seront amorties.`)) return;
    setLoading(true);
    setResultat(null);
    try {
      const res = await api.post('/immobilisations/dotations/generer', { annee: parseInt(annee) });
      setResultat(res.data.data);
      toast.success(`${res.data.data.crees} dotation(s) créée(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '22px 24px', boxShadow: C.shadow, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: `${C.gold}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calculator size={22} color={C.gold} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Clôture d'exercice : dotations aux amortissements</h2>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              Génère automatiquement la dotation annuelle de chaque immobilisation amortissable + une écriture comptable au journal OD.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Exercice à clôturer</label>
            <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
          </div>
          <button data-onboarding="btn-dotations" onClick={lancer} disabled={loading} style={{
            padding: '12px 24px', borderRadius: 10, border: 'none',
            background: loading ? C.border : C.accent, color: loading ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Calculator size={14} /> {loading ? 'Calcul en cours...' : `Générer les dotations ${annee}`}
          </button>
        </div>

        {resultat && (
          <div style={{
            marginTop: 18, padding: '14px 16px', borderRadius: 11,
            background: dark ? '#0D1220' : C.cardAlt, border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Créées</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.accent, marginTop: 4 }}>{resultat.crees}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ignorées</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.muted, marginTop: 4 }}>{resultat.ignores}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total immobilisations</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 4 }}>{resultat.total_immobilisations}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dotation totale</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, fontFamily: 'monospace', marginTop: 4 }}>{fmt(resultat.total_dotation)} FCFA</div>
              </div>
            </div>
            {resultat.erreurs?.length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: `${C.red}15`, border: `1px solid ${C.red}30` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>
                  ⚠ {resultat.erreurs.length} avertissement(s)
                </div>
                {resultat.erreurs.slice(0, 3).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.muted }}>
                    {e.immo || e.etape} : {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11,
        padding: '14px 16px', border: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.text }}>Comment ça fonctionne :</strong> à chaque clôture annuelle, ComptaWest calcule la dotation due de chaque immobilisation en service selon sa méthode (linéaire ou dégressif) et son prorata temporis. Pour la 1re année, seuls les jours après mise en service sont comptés. Une <strong>écriture comptable globale au journal OD</strong> est générée automatiquement : <strong style={{ fontFamily: 'monospace' }}>681</strong> au débit / <strong style={{ fontFamily: 'monospace' }}>28x</strong> au crédit. Vous pouvez relancer pour mettre à jour : les dotations existantes ne seront pas dupliquées.
      </div>
    </div>
  );
}
