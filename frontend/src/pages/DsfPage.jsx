import { useEffect, useState } from 'react';
import {
  FileText, Download, Lock, AlertTriangle, Check, Calendar, Building2,
  TrendingUp, FileSignature, ChevronDown, BookOpen, Users, Briefcase, Package,
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
                { k: 'actif',    l: 'Bilan ACTIF',          n: 'N°10' },
                { k: 'passif',   l: 'Bilan PASSIF',         n: 'N°11' },
                { k: 'resultat', l: 'Compte de résultat',   n: 'N°4' },
                { k: 'tafire',   l: 'TAFIRE',               n: 'N°6' },
                { k: 'annexes',  l: 'Annexes',              n: 'N°3-12' },
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
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: 720 }}>
        <thead>
          <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
            <th style={thStyle(C)}>Réf.</th>
            <th style={thStyle(C)}>Libellé</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Brut</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Amort./Prov.</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {bilan.lignes.map((l, idx) => (
            <tr key={idx} style={{
              borderBottom: `1px solid ${C.border}`,
              background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
            }}>
              <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
              <td style={{ ...tdStyle(C), fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
              <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 500 }}>{fmt(l.brut)}</td>
              <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 500, color: C.muted }}>{l.amort ? fmt(l.amort) : '—'}</td>
              <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.total ? C.total : C.text }}>{fmt(l.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauPassif({ C, bilan }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fontUI, minWidth: 580 }}>
        <thead>
          <tr style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.border}` }}>
            <th style={thStyle(C)}>Réf.</th>
            <th style={thStyle(C)}>Libellé</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Montant net</th>
          </tr>
        </thead>
        <tbody>
          {bilan.lignes.map((l, idx) => (
            <tr key={idx} style={{
              borderBottom: `1px solid ${C.border}`,
              background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
            }}>
              <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
              <td style={{ ...tdStyle(C), paddingLeft: l.niveau === 1 ? 24 : 12, fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
              <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.total ? C.total : C.text }}>{fmt(l.valeur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauResultat({ C, cr }) {
  return (
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
          {cr.lignes.map((l, idx) => (
            <tr key={idx} style={{
              borderBottom: `1px solid ${C.border}`,
              background: l.surligne ? `${C.warning}12` : (l.total ? C.cardElev : 'transparent'),
            }}>
              <td style={{ ...tdStyle(C), fontFamily: fontMono, color: l.total ? C.total : C.muted, fontWeight: l.total ? 800 : 600 }}>{l.ref}</td>
              <td style={{ ...tdStyle(C), paddingLeft: l.niveau === 1 ? 24 : 12, fontWeight: l.total ? 700 : 500, color: l.total ? C.text : C.sub }}>{l.libelle}</td>
              <td style={{ ...tdStyleN(C), fontWeight: l.total ? 800 : 600, color: l.soustrait ? C.danger : (l.total ? C.total : C.text) }}>
                {l.soustrait && l.valeur > 0 ? '(' + fmt(l.valeur) + ')' : fmt(l.valeur)}
              </td>
            </tr>
          ))}
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
