import { useEffect, useState } from 'react';
import {
  FileText, Download, Lock, AlertTriangle, Check, Calendar, Building2,
  TrendingUp, FileSignature, ChevronDown, BookOpen, Users, Briefcase, Package,
  Wand2, ChevronRight,
} from 'lucide-react';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';

const fontDisplay = '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif';
const fontUI = '"Satoshi", "Cabinet Grotesk", system-ui, sans-serif';
const fontMono = '"JetBrains Mono", ui-monospace, "SF Mono", monospace';

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/,/g, ' ');

const getC = (dark) => dark ? {
  bg: '#0E1116',
  surface: '#151A21',
  card: '#171C24',
  cardElev: '#1B2129',
  border: '#1F252E',
  text: '#E8EAE3',
  sub: '#A9B1BC',
  muted: '#7A8492',
  accent: '#2DBF9C',
  total: '#0F8A6E',
  surligne: '#FEF3C7',
  danger: '#F87171',
  warning: '#FBBF24',
} : {
  bg: '#F7F8F4',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElev: '#FAFBF7',
  border: '#E2E4DC',
  text: '#0E1116',
  sub: '#3C4250',
  muted: '#6B7280',
  accent: '#0F8A6E',
  total: '#0F8A6E',
  surligne: '#FEF3C7',
  danger: '#C03A4A',
  warning: '#B45309',
};

export default function DsfPage() {
  const { dark } = useTheme();
  const { actuelle } = useEntreprise();
  const C = getC(dark);

  const [exercices, setExercices] = useState([]);
  const [exerciceId, setExerciceId] = useState(null);
  const [liasse, setLiasse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('actif');
  const [tele, setTele] = useState(false);

  useEffect(() => {
    api.get('/dsf/exercices').then(r => {
      const list = r.data.data || [];
      setExercices(list);
      // Sélectionne l'exercice clôturé le plus récent, sinon le dernier
      const cloture = list.find(e => e.cloture);
      setExerciceId((cloture || list[0])?.id || null);
    }).catch(() => setExercices([]))
      .finally(() => setLoading(false));
  }, [actuelle?.id]);

  useEffect(() => {
    if (!exerciceId) return;
    setLoading(true);
    api.get(`/dsf/${exerciceId}/data`)
      .then(r => setLiasse(r.data.data))
      .catch(err => toast.error(err.response?.data?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [exerciceId]);

  const telecharger = async (format = 'pdf') => {
    setTele(true);
    try {
      const res = await api.get(`/dsf/${exerciceId}/${format}`, { responseType: 'blob' });
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const blob = new Blob([res.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSF-${actuelle?.nom?.replace(/[^\w-]/g, '_') || 'liasse'}-${liasse?.exercice?.libelle || ''}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Liasse DSF téléchargée (${format.toUpperCase()})`);
    } catch (err) {
      toast.error('Échec du téléchargement');
    } finally {
      setTele(false);
    }
  };

  if (loading && !liasse) {
    return (
      <div style={{ padding: 40, color: C.muted, textAlign: 'center', fontFamily: fontUI }}>
        Chargement de la liasse DSF…
      </div>
    );
  }

  if (exercices.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: fontUI, color: C.text }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 16, background: `${C.warning}20`, color: C.warning, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={28} />
        </div>
        <h2 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 800, margin: 0 }}>Aucun exercice trouvé</h2>
        <p style={{ color: C.sub, marginTop: 8 }}>
          Créez d'abord un exercice comptable depuis <strong>Comptabilité → Clôture</strong> pour générer une DSF.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: fontUI }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(20px, 3vw, 36px) clamp(16px, 4vw, 40px)' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.total})`, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${C.accent}40` }}>
              <FileSignature size={24} strokeWidth={2.4} />
            </div>
            <div>
              <h1 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Liasse fiscale DSF</h1>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
                Modèle SYSCOHADA révisé — Bilan + Compte de résultat
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select value={exerciceId || ''} onChange={(e) => setExerciceId(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: fontUI, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', outline: 'none',
              }}>
              {exercices.map(e => (
                <option key={e.id} value={e.id}>
                  {e.libelle} ({String(e.date_debut).slice(0,10)} → {String(e.date_fin).slice(0,10)}){e.cloture ? ' · clôturé' : ''}
                </option>
              ))}
            </select>
            <button onClick={() => telecharger('csv')} disabled={tele || !liasse} title="Export CSV multi-formulaires (e-DGI)" style={{
              padding: '10px 16px', borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: fontUI, fontWeight: 600, fontSize: 13,
              cursor: tele ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <FileText size={14} /> CSV
            </button>
            <button onClick={() => telecharger('pdf')} disabled={tele || !liasse} style={{
              padding: '10px 18px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent}, ${C.total})`,
              border: 'none', color: '#FFF',
              fontFamily: fontUI, fontWeight: 700, fontSize: 13,
              cursor: tele ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: `0 6px 20px ${C.accent}40`,
            }}>
              <Download size={14} />
              {tele ? 'Génération…' : 'Télécharger PDF'}
            </button>
          </div>
        </div>

        {liasse && (
          <>
            {/* BANDEAU ÉQUILIBRE */}
            <div style={{
              padding: '12px 16px', marginBottom: 24, borderRadius: 11,
              display: 'flex', alignItems: 'center', gap: 12,
              background: Math.abs(liasse.equilibre) > 1 ? `${C.danger}12` : `${C.accent}12`,
              border: `1px solid ${Math.abs(liasse.equilibre) > 1 ? C.danger + '50' : C.accent + '50'}`,
            }}>
              {Math.abs(liasse.equilibre) > 1
                ? <AlertTriangle size={18} color={C.danger} />
                : <Check size={18} color={C.accent} />}
              <div style={{ fontSize: 13, color: C.text }}>
                {Math.abs(liasse.equilibre) > 1
                  ? <>⚠ <strong>Écart de bilan : {fmt(liasse.equilibre)} FCFA</strong> — vérifiez les écritures de l'exercice avant dépôt à la DGI.</>
                  : <><strong>Bilan équilibré</strong> · Actif = Passif = <span style={{ fontFamily: fontMono }}>{fmt(liasse.bilan_actif.total_net)}</span> FCFA</>}
              </div>
            </div>

            {/* SUGGESTIONS DE CLÔTURE AUTO */}
            <SuggestionsClotureBloc C={C} exerciceId={exerciceId} onAppliquees={() => api.get(`/dsf/${exerciceId}/data`).then(r => setLiasse(r.data.data))} />

            {/* MINI-KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiMini C={C} icon={TrendingUp} label="Chiffre d'affaires" valeur={liasse.compte_resultat.indicateurs.chiffre_affaires} accent={C.accent} />
              <KpiMini C={C} icon={BookOpen} label="Valeur ajoutée" valeur={liasse.compte_resultat.indicateurs.valeur_ajoutee} accent={C.warning} />
              <KpiMini C={C} icon={Building2} label="Total bilan" valeur={liasse.bilan_actif.total_net} accent={C.accent} />
              <KpiMini C={C} icon={FileText} label="Résultat net" valeur={liasse.compte_resultat.indicateurs.resultat_net}
                accent={liasse.compte_resultat.indicateurs.resultat_net >= 0 ? C.accent : C.danger} />
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
              {[
                { k: 'actif',     l: 'Bilan ACTIF',         n: 'N°10' },
                { k: 'passif',    l: 'Bilan PASSIF',        n: 'N°11' },
                { k: 'resultat',  l: 'Compte de résultat',  n: 'N°4' },
                { k: 'tafire',    l: 'TAFIRE',              n: 'N°6' },
                { k: 'annexes',   l: 'Annexes',             n: 'N°3-12' },
                { k: 'manuelles', l: 'Annexes manuelles',   n: 'N°5-30' },
              ].map(({ k, l, n }) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  padding: '12px 18px', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${tab === k ? C.accent : 'transparent'}`,
                  color: tab === k ? C.accent : C.sub,
                  fontFamily: fontUI, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: -1,
                }}>
                  <span style={{ fontFamily: fontMono, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: tab === k ? `${C.accent}20` : C.cardElev, color: tab === k ? C.accent : C.muted }}>{n}</span>
                  {l}
                </button>
              ))}
            </div>

            {/* CONTENU */}
            {tab === 'actif'    && <TableauActif C={C} bilan={liasse.bilan_actif} />}
            {tab === 'passif'   && <TableauPassif C={C} bilan={liasse.bilan_passif} />}
            {tab === 'resultat' && <TableauResultat C={C} cr={liasse.compte_resultat} />}
            {tab === 'tafire'   && <TableauTafire C={C} tafire={liasse.tafire} exPrev={liasse.exercice_precedent} />}
            {tab === 'annexes'  && <TableauAnnexes C={C} annexes={liasse.annexes} />}
            {tab === 'manuelles' && <AnnexesManuellesForm C={C} exerciceId={exerciceId} onSaved={() => api.get(`/dsf/${exerciceId}/data`).then(r => setLiasse(r.data.data))} />}
          </>
        )}
      </div>
    </div>
  );
}

function KpiMini({ C, icon: Icon, label, valeur, accent }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: C.card, border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 800, color: C.text, marginTop: 2 }}>
          {fmt(valeur)} <span style={{ fontSize: 9, color: C.muted, fontFamily: fontUI }}>FCFA</span>
        </div>
      </div>
    </div>
  );
}

function TableauActif({ C, bilan }) {
  const cmp = bilan.has_n_moins_un;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: cmp ? 860 : 720 }}>
        <thead>
          <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
            <th style={thStyle(C)}>Réf.</th>
            <th style={thStyle(C)}>Libellé</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Brut</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Amort./Prov.</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Net N</th>
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Net N-1</th>}
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Variation</th>}
          </tr>
        </thead>
        <tbody>
          {bilan.lignes.map((l, idx) => {
            const variation = cmp ? l.net - l.net_n_moins_un : 0;
            return (
              <tr key={idx} style={{
                borderBottom: `1px solid ${C.border}`,
                background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
              }}>
                <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
                <td style={{ ...tdStyle(C), fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 500 }}>{fmt(l.brut)}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 500, color: C.muted }}>{l.amort ? fmt(l.amort) : '—'}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.total ? C.total : C.text }}>{fmt(l.net)}</td>
                {cmp && <td style={{ ...tdStyleN(C), color: C.muted }}>{fmt(l.net_n_moins_un)}</td>}
                {cmp && <td style={{ ...tdStyleN(C), color: variation > 0 ? C.accent : (variation < 0 ? C.danger : C.muted), fontWeight: 600 }}>
                  {variation > 0 ? '+' : ''}{fmt(variation)}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableauPassif({ C, bilan }) {
  const cmp = bilan.has_n_moins_un;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: cmp ? 720 : 580 }}>
        <thead>
          <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
            <th style={thStyle(C)}>Réf.</th>
            <th style={thStyle(C)}>Libellé</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant N</th>
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant N-1</th>}
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Variation</th>}
          </tr>
        </thead>
        <tbody>
          {bilan.lignes.map((l, idx) => {
            const variation = cmp ? l.valeur - l.n_moins_un : 0;
            return (
              <tr key={idx} style={{
                borderBottom: `1px solid ${C.border}`,
                background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
              }}>
                <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
                <td style={{ ...tdStyle(C), paddingLeft: l.niveau === 1 ? 24 : 12, fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.total ? C.total : C.text }}>{fmt(l.valeur)}</td>
                {cmp && <td style={{ ...tdStyleN(C), color: C.muted }}>{fmt(l.n_moins_un)}</td>}
                {cmp && <td style={{ ...tdStyleN(C), color: variation > 0 ? C.accent : (variation < 0 ? C.danger : C.muted), fontWeight: 600 }}>
                  {variation > 0 ? '+' : ''}{fmt(variation)}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableauResultat({ C, cr }) {
  const cmp = cr.has_n_moins_un;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: cmp ? 720 : 580 }}>
        <thead>
          <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
            <th style={thStyle(C)}>Réf.</th>
            <th style={thStyle(C)}>Libellé</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant N</th>
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant N-1</th>}
            {cmp && <th style={{ ...thStyle(C), textAlign: 'right' }}>Variation</th>}
          </tr>
        </thead>
        <tbody>
          {cr.lignes.map((l, idx) => {
            const variation = cmp ? l.valeur - l.n_moins_un : 0;
            return (
              <tr key={idx} style={{
                borderBottom: `1px solid ${C.border}`,
                background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
              }}>
                <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
                <td style={{ ...tdStyle(C), paddingLeft: l.niveau === 1 ? 24 : 12, fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.soustrait ? C.danger : (l.total ? C.total : C.text) }}>
                  {l.soustrait && l.valeur > 0 ? '(' + fmt(l.valeur) + ')' : fmt(l.valeur)}
                </td>
                {cmp && <td style={{ ...tdStyleN(C), color: C.muted }}>
                  {l.soustrait && l.n_moins_un > 0 ? '(' + fmt(l.n_moins_un) + ')' : fmt(l.n_moins_un)}
                </td>}
                {cmp && <td style={{ ...tdStyleN(C), color: variation > 0 ? C.accent : (variation < 0 ? C.danger : C.muted), fontWeight: 600 }}>
                  {variation > 0 ? '+' : ''}{fmt(variation)}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableauTafire({ C, tafire, exPrev }) {
  return (
    <div>
      {tafire.avertissement && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 11,
          background: `${C.warning}14`, border: `1px solid ${C.warning}50`,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12.5, color: C.text,
        }}>
          <AlertTriangle size={16} color={C.warning} />
          {tafire.avertissement}
        </div>
      )}
      {exPrev && !tafire.avertissement && (
        <div style={{
          padding: '10px 14px', marginBottom: 14, borderRadius: 10,
          background: C.cardElev, border: `1px solid ${C.border}`,
          fontSize: 11.5, color: C.sub,
        }}>
          Variations calculées par rapport à l'exercice <strong style={{ color: C.text }}>{exPrev.libelle}</strong>.
          {Math.abs(tafire.ecart || 0) > 1
            ? <> <span style={{ color: C.danger }}>· Écart TAFIRE : {fmt(tafire.ecart)} FCFA</span></>
            : <> <span style={{ color: C.accent }}>· Équilibre vérifié ✓</span></>}
        </div>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: 580 }}>
          <thead>
            <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
              <th style={thStyle(C)}>Réf.</th>
              <th style={thStyle(C)}>Libellé</th>
              <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {tafire.lignes.map((l, idx) => l.section ? (
              <tr key={idx} style={{ background: `${C.accent}10`, borderTop: `1px solid ${C.border}` }}>
                <td colSpan={3} style={{ padding: '12px', fontWeight: 800, color: C.total, letterSpacing: '0.04em' }}>
                  {l.libelle}
                </td>
              </tr>
            ) : (
              <tr key={idx} style={{
                borderBottom: `1px solid ${C.border}`,
                background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
              }}>
                <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
                <td style={{ ...tdStyle(C), paddingLeft: l.niveau === 1 ? 24 : 12, fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
                <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.soustrait ? C.danger : (l.total ? C.total : C.text) }}>
                  {l.valeur === null ? '' : (l.soustrait && l.valeur > 0 ? '(' + fmt(l.valeur) + ')' : fmt(l.valeur))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuggestionsClotureBloc({ C, exerciceId, onAppliquees }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState(new Set());
  const [enregistrement, setEnregistrement] = useState(false);
  const [ouvert, setOuvert] = useState(true);

  useEffect(() => {
    if (!exerciceId) return;
    setLoading(true);
    api.get(`/comptabilite/exercices/${exerciceId}/suggestions-cloture`)
      .then(r => {
        setSuggestions(r.data.data || []);
        // Pré-sélectionne toutes les suggestions avec écriture (pas les alertes)
        const initialSel = new Set();
        for (const s of r.data.data || []) {
          if (s.ecriture) initialSel.add(s.id);
        }
        setSelection(initialSel);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [exerciceId]);

  const toggle = (id) => {
    setSelection(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const appliquer = async () => {
    const aEnregistrer = suggestions.filter(s => selection.has(s.id) && s.ecriture);
    if (aEnregistrer.length === 0) {
      toast.error('Aucune suggestion sélectionnée');
      return;
    }
    setEnregistrement(true);
    try {
      const r = await api.post(`/comptabilite/exercices/${exerciceId}/suggestions-cloture`, { suggestions: aEnregistrer });
      toast.success(r.data.message || 'Écritures enregistrées');
      setSuggestions([]);
      setSelection(new Set());
      onAppliquees && onAppliquees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setEnregistrement(false);
    }
  };

  if (loading) return null;
  if (suggestions.length === 0) return null;

  const aEnregistrerCount = suggestions.filter(s => selection.has(s.id) && s.ecriture).length;

  return (
    <div style={{
      marginBottom: 24, borderRadius: 12,
      background: C.card, border: `1px solid ${C.warning}50`,
      overflow: 'hidden',
    }}>
      <button onClick={() => setOuvert(o => !o)} style={{
        width: '100%', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: `${C.warning}12`, border: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: C.warning, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wand2 size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: fontDisplay }}>
            {suggestions.length} suggestion(s) de clôture pré-DSF
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
            Écritures auto-détectées à passer avant la liasse — provisions douteux, régularisation TVA, alertes.
          </div>
        </div>
        <ChevronRight size={16} color={C.muted} style={{ transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {ouvert && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map((s) => {
              const couleur = s.type === 'alerte' ? C.warning : (s.type === 'provision' ? C.danger : C.accent);
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: 14, background: C.cardElev,
                  border: `1px solid ${selection.has(s.id) ? couleur + '60' : C.border}`,
                  borderRadius: 10, transition: 'border-color 0.15s',
                }}>
                  {s.ecriture && (
                    <input type="checkbox" checked={selection.has(s.id)} onChange={() => toggle(s.id)}
                      style={{ marginTop: 3, cursor: 'pointer', accentColor: couleur }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.titre}</span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                        background: `${couleur}18`, color: couleur,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{s.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{s.explication}</div>
                    {s.ecriture && (
                      <div style={{ marginTop: 8, padding: 10, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, fontSize: 11, fontFamily: fontMono }}>
                        <div style={{ color: C.muted, marginBottom: 4 }}>{s.ecriture.libelle}</div>
                        {s.ecriture.lignes.map((ln, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span><span style={{ color: C.muted }}>{ln.compte}</span> {ln.libelle}</span>
                            <span style={{ color: ln.debit > 0 ? C.danger : C.accent, fontWeight: 700 }}>
                              {ln.debit > 0 ? `D ${fmt(ln.debit)}` : `C ${fmt(ln.credit)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {aEnregistrerCount > 0 && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={appliquer} disabled={enregistrement} style={{
                padding: '10px 18px', borderRadius: 10,
                background: `linear-gradient(135deg, ${C.accent}, ${C.total})`,
                border: 'none', color: '#FFF',
                fontFamily: fontUI, fontWeight: 700, fontSize: 13,
                cursor: enregistrement ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                {enregistrement ? 'Enregistrement…' : `Passer les ${aEnregistrerCount} écriture(s) sélectionnée(s) en OD`}
                {!enregistrement && <Check size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnnexesManuellesForm({ C, exerciceId, onSaved }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(null);

  useEffect(() => {
    api.get(`/dsf/${exerciceId}/annexes-manuelles`)
      .then(r => {
        const out = {};
        for (const [k, v] of Object.entries(r.data.data || {})) {
          out[k] = v ? v.contenu : {};
        }
        setData(out);
      })
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [exerciceId]);

  const save = async (type) => {
    setSavingType(type);
    try {
      await api.put(`/dsf/${exerciceId}/annexes-manuelles/${type}`, { contenu: data[type] || {} });
      toast.success('Annexe enregistrée');
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingType(null);
    }
  };

  const setField = (type, field, value) => {
    setData(d => ({ ...d, [type]: { ...(d[type] || {}), [field]: value } }));
  };
  const setArrayItem = (type, arrayField, idx, item) => {
    setData(d => {
      const arr = [...((d[type] || {})[arrayField] || [])];
      arr[idx] = item;
      return { ...d, [type]: { ...(d[type] || {}), [arrayField]: arr } };
    });
  };
  const addArrayItem = (type, arrayField, defaults) => {
    setData(d => {
      const arr = [...((d[type] || {})[arrayField] || []), defaults];
      return { ...d, [type]: { ...(d[type] || {}), [arrayField]: arr } };
    });
  };
  const removeArrayItem = (type, arrayField, idx) => {
    setData(d => {
      const arr = ((d[type] || {})[arrayField] || []).filter((_, i) => i !== idx);
      return { ...d, [type]: { ...(d[type] || {}), [arrayField]: arr } };
    });
  };

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>Chargement…</div>;

  const inp = {
    padding: '8px 10px', borderRadius: 8,
    background: C.cardElev, border: `1px solid ${C.border}`,
    color: C.text, fontFamily: fontUI, fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: C.sub, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4, display: 'block' };
  const btnPrim = (saving) => ({
    padding: '8px 14px', borderRadius: 8,
    background: `linear-gradient(135deg, ${C.accent}, ${C.total})`,
    border: 'none', color: '#FFF', fontFamily: fontUI, fontSize: 12, fontWeight: 700,
    cursor: saving ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  });
  const btnGhost = {
    padding: '6px 10px', borderRadius: 6,
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.sub, fontFamily: fontUI, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ padding: 14, background: `${C.warning}10`, border: `1px solid ${C.warning}40`, borderRadius: 10, fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>
        Ces annexes ne sont pas calculables depuis la compta. Renseignez-les manuellement pour qu'elles apparaissent dans le PDF et le CSV exportés.
      </div>

      {/* Commissaires aux comptes */}
      <SectionAnnexe C={C} icon={FileSignature} titre="N°15 — Commissaires aux comptes">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Cabinet / Identité</label>
            <input value={data.commissaires_aux_comptes?.noms || ''} onChange={e => setField('commissaires_aux_comptes', 'noms', e.target.value)}
              placeholder="ex: Cabinet X & Associés" style={inp} />
          </div>
          <div>
            <label style={lbl}>Mission</label>
            <input value={data.commissaires_aux_comptes?.mission || ''} onChange={e => setField('commissaires_aux_comptes', 'mission', e.target.value)}
              placeholder="ex: Commissariat aux comptes" style={inp} />
          </div>
          <div>
            <label style={lbl}>Honoraires (FCFA)</label>
            <input type="number" value={data.commissaires_aux_comptes?.honoraires || ''} onChange={e => setField('commissaires_aux_comptes', 'honoraires', Number(e.target.value))}
              placeholder="0" style={inp} />
          </div>
        </div>
        <div style={{ padding: '0 14px 14px', textAlign: 'right' }}>
          <button onClick={() => save('commissaires_aux_comptes')} disabled={savingType === 'commissaires_aux_comptes'} style={btnPrim(savingType === 'commissaires_aux_comptes')}>
            <Check size={12} /> {savingType === 'commissaires_aux_comptes' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </SectionAnnexe>

      {/* Crédit-bail */}
      <SectionAnnexe C={C} icon={Briefcase} titre="N°5 — Crédit-bail / Location-acquisition">
        <div style={{ padding: 14 }}>
          {(data.credit_bail?.contrats || []).map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <input value={c.designation || ''} onChange={e => setArrayItem('credit_bail', 'contrats', i, { ...c, designation: e.target.value })} placeholder="Désignation" style={inp} />
              <input type="number" value={c.duree || ''} onChange={e => setArrayItem('credit_bail', 'contrats', i, { ...c, duree: Number(e.target.value) })} placeholder="Durée (mois)" style={inp} />
              <input type="number" value={c.mensualite || ''} onChange={e => setArrayItem('credit_bail', 'contrats', i, { ...c, mensualite: Number(e.target.value) })} placeholder="Mensualité" style={inp} />
              <input type="number" value={c.restant || ''} onChange={e => setArrayItem('credit_bail', 'contrats', i, { ...c, restant: Number(e.target.value) })} placeholder="Restant (mois)" style={inp} />
              <input type="number" value={c.valeur_residuelle || ''} onChange={e => setArrayItem('credit_bail', 'contrats', i, { ...c, valeur_residuelle: Number(e.target.value) })} placeholder="Val. résiduelle" style={inp} />
              <button onClick={() => removeArrayItem('credit_bail', 'contrats', i)} style={{ ...btnGhost, color: C.danger }}>×</button>
            </div>
          ))}
          <button onClick={() => addArrayItem('credit_bail', 'contrats', { designation: '', duree: 0, mensualite: 0, restant: 0, valeur_residuelle: 0 })} style={{ ...btnGhost, marginTop: 8 }}>+ Ajouter un contrat</button>
        </div>
        <div style={{ padding: '0 14px 14px', textAlign: 'right' }}>
          <button onClick={() => save('credit_bail')} disabled={savingType === 'credit_bail'} style={btnPrim(savingType === 'credit_bail')}>
            <Check size={12} /> Enregistrer
          </button>
        </div>
      </SectionAnnexe>

      {/* Engagements hors bilan */}
      <SectionAnnexe C={C} icon={AlertTriangle} titre="N°27 — Engagements hors bilan">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Avals, cautions, garanties données (FCFA)</label>
            <input type="number" value={data.engagements_hors_bilan?.avals_cautions_garanties_donnees || ''} onChange={e => setField('engagements_hors_bilan', 'avals_cautions_garanties_donnees', Number(e.target.value))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Avals, cautions, garanties reçues (FCFA)</label>
            <input type="number" value={data.engagements_hors_bilan?.avals_cautions_garanties_recues || ''} onChange={e => setField('engagements_hors_bilan', 'avals_cautions_garanties_recues', Number(e.target.value))} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Autres engagements (description libre)</label>
            <textarea value={data.engagements_hors_bilan?.autres || ''} onChange={e => setField('engagements_hors_bilan', 'autres', e.target.value)}
              rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="ex: nantissement, sûretés réelles, contrats en cours…" />
          </div>
        </div>
        <div style={{ padding: '0 14px 14px', textAlign: 'right' }}>
          <button onClick={() => save('engagements_hors_bilan')} disabled={savingType === 'engagements_hors_bilan'} style={btnPrim(savingType === 'engagements_hors_bilan')}>
            <Check size={12} /> Enregistrer
          </button>
        </div>
      </SectionAnnexe>

      {/* Litiges */}
      <SectionAnnexe C={C} icon={AlertTriangle} titre="N°32 — Litiges et risques">
        <div style={{ padding: 14 }}>
          {(data.litiges?.litiges || []).map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <input value={l.partie || ''} onChange={e => setArrayItem('litiges', 'litiges', i, { ...l, partie: e.target.value })} placeholder="Partie adverse" style={inp} />
              <input value={l.nature || ''} onChange={e => setArrayItem('litiges', 'litiges', i, { ...l, nature: e.target.value })} placeholder="Nature du litige" style={inp} />
              <input type="number" value={l.montant_demande || ''} onChange={e => setArrayItem('litiges', 'litiges', i, { ...l, montant_demande: Number(e.target.value) })} placeholder="Montant demandé" style={inp} />
              <input type="number" value={l.provision || ''} onChange={e => setArrayItem('litiges', 'litiges', i, { ...l, provision: Number(e.target.value) })} placeholder="Provision constituée" style={inp} />
              <button onClick={() => removeArrayItem('litiges', 'litiges', i)} style={{ ...btnGhost, color: C.danger }}>×</button>
            </div>
          ))}
          <button onClick={() => addArrayItem('litiges', 'litiges', { partie: '', nature: '', montant_demande: 0, provision: 0 })} style={{ ...btnGhost, marginTop: 8 }}>+ Ajouter un litige</button>
        </div>
        <div style={{ padding: '0 14px 14px', textAlign: 'right' }}>
          <button onClick={() => save('litiges')} disabled={savingType === 'litiges'} style={btnPrim(savingType === 'litiges')}>
            <Check size={12} /> Enregistrer
          </button>
        </div>
      </SectionAnnexe>

      {/* CA par activité */}
      <SectionAnnexe C={C} icon={TrendingUp} titre="N°23 — Ventilation du CA par activité">
        <div style={{ padding: 14 }}>
          {(data.ca_par_activite?.activites || []).map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <input value={a.libelle || ''} onChange={e => setArrayItem('ca_par_activite', 'activites', i, { ...a, libelle: e.target.value })} placeholder="ex: Vente marchandises" style={inp} />
              <input type="number" value={a.montant || ''} onChange={e => setArrayItem('ca_par_activite', 'activites', i, { ...a, montant: Number(e.target.value) })} placeholder="CA (FCFA)" style={inp} />
              <input type="number" value={a.pct || ''} onChange={e => setArrayItem('ca_par_activite', 'activites', i, { ...a, pct: Number(e.target.value) })} placeholder="%" style={inp} />
              <button onClick={() => removeArrayItem('ca_par_activite', 'activites', i)} style={{ ...btnGhost, color: C.danger }}>×</button>
            </div>
          ))}
          <button onClick={() => addArrayItem('ca_par_activite', 'activites', { libelle: '', montant: 0, pct: 0 })} style={{ ...btnGhost, marginTop: 8 }}>+ Ajouter une activité</button>
        </div>
        <div style={{ padding: '0 14px 14px', textAlign: 'right' }}>
          <button onClick={() => save('ca_par_activite')} disabled={savingType === 'ca_par_activite'} style={btnPrim(savingType === 'ca_par_activite')}>
            <Check size={12} /> Enregistrer
          </button>
        </div>
      </SectionAnnexe>
    </div>
  );
}

function TableauAnnexes({ C, annexes }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* N°3A — Immobilisations */}
      <SectionAnnexe C={C} icon={Package} titre="N°3A — Immobilisations (mouvements bruts)">
        {annexes.immobilisations.lignes.length === 0 ? (
          <EmptyAnnexe C={C} text="Aucune immobilisation enregistrée" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI }}>
              <thead>
                <tr style={{ background: `${C.accent}10` }}>
                  <th style={thStyle(C)}>Réf.</th>
                  <th style={thStyle(C)}>Catégorie</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Brut ouverture</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Acquisitions</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Cessions</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Brut clôture</th>
                </tr>
              </thead>
              <tbody>
                {annexes.immobilisations.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...tdStyle(C), fontFamily: fontMono, color: C.muted }}>{l.ref}</td>
                    <td style={tdStyle(C)}>{l.libelle}</td>
                    <td style={tdStyleN(C)}>{fmt(l.brut_ouverture)}</td>
                    <td style={{ ...tdStyleN(C), color: C.accent }}>{fmt(l.acquisitions)}</td>
                    <td style={{ ...tdStyleN(C), color: C.danger }}>{fmt(l.cessions)}</td>
                    <td style={{ ...tdStyleN(C), fontWeight: 700 }}>{fmt(l.brut_cloture)}</td>
                  </tr>
                ))}
                <tr style={{ background: `${C.warning}14` }}>
                  <td style={{ ...tdStyle(C), fontWeight: 800, color: C.total }} colSpan={2}>TOTAL</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800 }}>{fmt(annexes.immobilisations.totaux.brut_ouverture)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800, color: C.accent }}>{fmt(annexes.immobilisations.totaux.acquisitions)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800, color: C.danger }}>{fmt(annexes.immobilisations.totaux.cessions)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800 }}>{fmt(annexes.immobilisations.totaux.brut_cloture)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionAnnexe>

      {/* N°3B — Amortissements */}
      <SectionAnnexe C={C} icon={Calendar} titre="N°3B — Amortissements (mouvements cumulés)">
        {annexes.amortissements.lignes.length === 0 ? (
          <EmptyAnnexe C={C} text="Aucun amortissement enregistré" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI }}>
              <thead>
                <tr style={{ background: `${C.accent}10` }}>
                  <th style={thStyle(C)}>Réf.</th>
                  <th style={thStyle(C)}>Catégorie</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Cumul N-1</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Dotations</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Reprises</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Cumul N</th>
                </tr>
              </thead>
              <tbody>
                {annexes.amortissements.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...tdStyle(C), fontFamily: fontMono, color: C.muted }}>{l.ref}</td>
                    <td style={tdStyle(C)}>{l.libelle}</td>
                    <td style={tdStyleN(C)}>{fmt(l.cumul_ouverture)}</td>
                    <td style={{ ...tdStyleN(C), color: C.danger }}>{fmt(l.dotations)}</td>
                    <td style={{ ...tdStyleN(C), color: C.accent }}>{fmt(l.reprises)}</td>
                    <td style={{ ...tdStyleN(C), fontWeight: 700 }}>{fmt(l.cumul_cloture)}</td>
                  </tr>
                ))}
                <tr style={{ background: `${C.warning}14` }}>
                  <td style={{ ...tdStyle(C), fontWeight: 800, color: C.total }} colSpan={2}>TOTAL</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800 }}>{fmt(annexes.amortissements.totaux.cumul_ouverture)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800, color: C.danger }}>{fmt(annexes.amortissements.totaux.dotations)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800, color: C.accent }}>{fmt(annexes.amortissements.totaux.reprises)}</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800 }}>{fmt(annexes.amortissements.totaux.cumul_cloture)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionAnnexe>

      {/* N°4 — Effectifs */}
      <SectionAnnexe C={C} icon={Users} titre="N°4 — Effectifs">
        {annexes.effectifs ? (
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `${C.accent}20`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontDisplay, fontWeight: 800, fontSize: 24 }}>
              {annexes.effectifs.total_fin_exercice}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Salariés actifs en fin d'exercice</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>{annexes.effectifs.details}</div>
            </div>
          </div>
        ) : (
          <EmptyAnnexe C={C} text="Module Paie non utilisé — effectif à compléter manuellement sur la DSF DGI" />
        )}
      </SectionAnnexe>

      {/* N°10 — Emprunts */}
      <SectionAnnexe C={C} icon={Briefcase} titre="N°10 — Emprunts et dettes financières">
        {annexes.emprunts.lignes.length === 0 ? (
          <EmptyAnnexe C={C} text="Aucun emprunt en cours" />
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI }}>
              <thead>
                <tr style={{ background: `${C.accent}10` }}>
                  <th style={thStyle(C)}>Compte</th>
                  <th style={thStyle(C)}>Libellé</th>
                  <th style={{ ...thStyle(C), textAlign: 'right' }}>Solde restant</th>
                </tr>
              </thead>
              <tbody>
                {annexes.emprunts.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...tdStyle(C), fontFamily: fontMono, color: C.muted }}>{l.compte}</td>
                    <td style={tdStyle(C)}>{l.libelle}</td>
                    <td style={tdStyleN(C)}>{fmt(l.montant)}</td>
                  </tr>
                ))}
                <tr style={{ background: `${C.warning}14` }}>
                  <td style={{ ...tdStyle(C), fontWeight: 800, color: C.total }} colSpan={2}>TOTAL</td>
                  <td style={{ ...tdStyleN(C), fontWeight: 800 }}>{fmt(annexes.emprunts.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionAnnexe>

      {/* N°12 — Créances et dettes */}
      <SectionAnnexe C={C} icon={FileText} titre="N°12 — État des créances et dettes">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, padding: 14 }}>
          {[
            { l: 'Créances clients (41)', v: annexes.creances_dettes.creances_clients, c: C.accent },
            { l: 'Autres créances (42-48)', v: annexes.creances_dettes.autres_creances, c: C.accent },
            { l: 'Dettes fournisseurs (40)', v: annexes.creances_dettes.dettes_fournisseurs, c: C.danger },
            { l: 'Dettes fiscales (44)', v: annexes.creances_dettes.dettes_fiscales, c: C.danger },
            { l: 'Dettes sociales (42-43)', v: annexes.creances_dettes.dettes_sociales, c: C.danger },
            { l: 'Autres dettes (45-47)', v: annexes.creances_dettes.autres_dettes, c: C.danger },
          ].map((item, i) => (
            <div key={i} style={{
              padding: 12, borderRadius: 10,
              background: C.cardElev, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.l}</div>
              <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 800, color: item.c, marginTop: 4 }}>
                {fmt(item.v)} <span style={{ fontSize: 9, color: C.muted, fontFamily: fontUI }}>FCFA</span>
              </div>
            </div>
          ))}
        </div>
      </SectionAnnexe>

      <div style={{ padding: 14, background: `${C.warning}10`, border: `1px solid ${C.warning}40`, borderRadius: 10, fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>
        <strong style={{ color: C.text }}>Annexes manuelles non incluses :</strong> commissaires aux comptes,
        crédit-bail, engagements hors bilan, litiges, ventilation CA par activité.
        Elles devront être complétées directement dans la DSF officielle DGI.
      </div>
    </div>
  );
}

function SectionAnnexe({ C, icon: Icon, titre, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: `${C.accent}08`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={14} color={C.accent} />
        <span style={{ fontSize: 12, fontWeight: 800, color: C.total, letterSpacing: '0.04em' }}>{titre}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyAnnexe({ C, text }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 12.5, fontStyle: 'italic' }}>{text}</div>
  );
}

const thStyle = (C) => ({
  padding: '10px 12px', textAlign: 'left',
  fontSize: 10, fontWeight: 800, color: C.muted,
  letterSpacing: '0.06em', textTransform: 'uppercase',
});
const tdStyle = (C) => ({
  padding: '8px 12px', verticalAlign: 'top',
});
const tdStyleN = (C) => ({
  padding: '8px 12px', textAlign: 'right',
  fontFamily: fontMono,
});
