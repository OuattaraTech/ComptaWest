import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import {
  BookOpen, FileSpreadsheet, BookMarked, Scale, Plus, Download,
  Search, ChevronLeft, ChevronRight, Trash2, AlertTriangle,
} from 'lucide-react';

const TABS = [
  { id: 'plan',     label: 'Plan comptable', icon: BookOpen },
  { id: 'journal',  label: 'Journal',        icon: FileSpreadsheet },
  { id: 'gl',       label: 'Grand livre',    icon: BookMarked },
  { id: 'balance',  label: 'Balance',        icon: Scale },
];

const CLASSES = [
  { value: '',  label: 'Toutes les classes' },
  { value: '1', label: 'Classe 1 — Ressources durables' },
  { value: '2', label: 'Classe 2 — Actif immobilisé' },
  { value: '3', label: 'Classe 3 — Stocks' },
  { value: '4', label: 'Classe 4 — Tiers' },
  { value: '5', label: 'Classe 5 — Trésorerie' },
  { value: '6', label: 'Classe 6 — Charges' },
  { value: '7', label: 'Classe 7 — Produits' },
  { value: '8', label: 'Classe 8 — HAO et IS' },
  { value: '9', label: 'Classe 9 — Analytique' },
];

const NATURE_COULEURS = {
  ACTIF:      '#4E8BF5',
  PASSIF:     '#A855F7',
  CHARGE:     '#FF5C6B',
  PRODUIT:    '#00D4AA',
  HAO:        '#F5A623',
  ANALYTIQUE: '#6B7A99',
};

export default function ComptabilitePage() {
  const { dark } = useTheme();
  const { actuelle } = useEntreprise();
  const C = getC(dark);
  const role = actuelle?.role;
  const peutEcrire = ['proprietaire', 'admin', 'comptable'].includes(role);
  const peutExporter = role === 'proprietaire' || role === 'admin';

  const [tab, setTab] = useState('plan');
  const [showOD, setShowOD] = useState(false);
  const [journaux, setJournaux] = useState([]);

  // Charge la liste des journaux une fois (utile pour le filtre journal et l'OD)
  useEffect(() => {
    api.get('/comptabilite/journaux')
      .then(r => setJournaux(r.data.data))
      .catch(() => {});
  }, []);

  const downloadFEC = async () => {
    const annee = prompt('Année à exporter (FEC) :', String(new Date().getFullYear()));
    if (!annee) return;
    try {
      const res = await api.get(`/comptabilite/fec?annee=${annee}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `FEC_${annee}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`FEC ${annee} téléchargé`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur export FEC');
    }
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookMarked size={22} color={C.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>
              Comptabilité SYSCOHADA
            </h1>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Plan de comptes, écritures, grand livre, balance et export FEC
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {peutEcrire && (
            <button onClick={() => setShowOD(true)} style={btnPrimary(C)}>
              <Plus size={14} /> Nouvelle OD
            </button>
          )}
          {peutExporter && (
            <button onClick={downloadFEC} style={btnSecondary(C)}>
              <Download size={14} /> Export FEC
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? C.text : C.muted,
              background: active ? C.cardAlt : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div data-onboarding="journal">
        {tab === 'plan'    && <PlanComptable C={C} />}
        {tab === 'journal' && <JournalGeneral C={C} journaux={journaux} />}
        {tab === 'gl'      && <GrandLivre C={C} />}
        {tab === 'balance' && <BalanceGenerale C={C} />}
      </div>

      {/* Modale OD */}
      {showOD && (
        <OperationDiverseModal
          C={C}
          journaux={journaux}
          onClose={() => setShowOD(false)}
          onSaved={() => { setShowOD(false); toast.success('Écriture enregistrée'); }}
        />
      )}

      <Onboarding pageKey="comptabilite" />
    </div>
  );
}

// ─── ONGLET 1 : PLAN COMPTABLE ────────────────────────────────────────────
function PlanComptable({ C }) {
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classe, setClasse] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classe) params.set('classe', classe);
      if (search) params.set('search', search);
      const res = await api.get(`/comptabilite/plan?${params.toString()}`);
      setComptes(res.data.data);
    } catch { toast.error('Erreur chargement plan'); }
    finally { setLoading(false); }
  }, [classe, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card C={C}>
      <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <select value={classe} onChange={e => setClasse(e.target.value)} style={selectStyle(C)}>
          {CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par numéro ou libellé"
            style={{ ...selectStyle(C), paddingLeft: 32, width: '100%' }} />
        </div>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {loading ? <Loading C={C} /> : comptes.length === 0 ? <Empty C={C} /> : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: C.cardAlt }}>
                <th style={th(C, 110)}>N° compte</th>
                <th style={th(C)}>Libellé</th>
                <th style={th(C, 100)}>Classe</th>
                <th style={th(C, 110)}>Nature</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map(c => (
                <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{c.numero}</td>
                  <td style={td(C)}>{c.libelle}</td>
                  <td style={{ ...td(C), color: C.muted }}>{c.classe}</td>
                  <td style={td(C)}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 16,
                      background: `${NATURE_COULEURS[c.nature] || C.muted}22`,
                      color: NATURE_COULEURS[c.nature] || C.muted,
                    }}>{c.nature}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

// ─── ONGLET 2 : JOURNAL GÉNÉRAL ───────────────────────────────────────────
function JournalGeneral({ C, journaux }) {
  const [ecritures, setEcritures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [filtres, setFiltres] = useState({ journal_code: '', date_debut: '', date_fin: '', search: '' });
  const [detail, setDetail] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      Object.entries(filtres).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await api.get(`/comptabilite/ecritures?${params.toString()}`);
      setEcritures(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erreur chargement journal'); }
    finally { setLoading(false); }
  }, [page, filtres]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFiltre = (k) => (e) => { setPage(1); setFiltres(f => ({ ...f, [k]: e.target.value })); };

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/comptabilite/ecritures/${id}`);
      setDetail(res.data.data);
    } catch { toast.error('Erreur chargement écriture'); }
  };

  return (
    <>
      <Card C={C}>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, borderBottom: `1px solid ${C.border}` }}>
          <select value={filtres.journal_code} onChange={updateFiltre('journal_code')} style={selectStyle(C)}>
            <option value="">Tous les journaux</option>
            {journaux.map(j => <option key={j.id} value={j.code}>{j.code} — {j.libelle}</option>)}
          </select>
          <input type="date" value={filtres.date_debut} onChange={updateFiltre('date_debut')} style={selectStyle(C)} />
          <input type="date" value={filtres.date_fin} onChange={updateFiltre('date_fin')} style={selectStyle(C)} />
          <input value={filtres.search} onChange={updateFiltre('search')} placeholder="Rechercher" style={selectStyle(C)} />
        </div>
        {loading ? <Loading C={C} /> : ecritures.length === 0 ? <Empty C={C} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 70)}>Journal</th>
                  <th style={th(C, 130)}>N° pièce</th>
                  <th style={th(C, 100)}>Date</th>
                  <th style={th(C)}>Libellé</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Débit</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Crédit</th>
                  <th style={th(C, 90)}>Origine</th>
                </tr>
              </thead>
              <tbody>
                {ecritures.map(e => (
                  <tr key={e.id} onClick={() => openDetail(e.id)}
                    style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    <td style={{ ...td(C), fontWeight: 700, color: C.accent }}>{e.journal_code}</td>
                    <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{e.numero_piece}</td>
                    <td style={{ ...td(C), color: C.muted, fontSize: 11 }}>{formatDate(e.date_ecriture)}</td>
                    <td style={td(C)}>
                      <div>{e.libelle}</div>
                      {e.reference && <div style={{ color: C.muted, fontSize: 10 }}>Réf : {e.reference}</div>}
                    </td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(e.total_debit)}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(e.total_credit)}</td>
                    <td style={{ ...td(C), color: C.muted, fontSize: 10 }}>
                      {e.origine === 'MANUEL' ? 'OD' : (e.origine || '').replace('AUTO_', '').toLowerCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination C={C} page={page} setPage={setPage} pagination={pagination} />
      </Card>

      {detail && <DetailEcritureModal C={C} ecriture={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

// ─── ONGLET 3 : GRAND LIVRE ───────────────────────────────────────────────
function GrandLivre({ C }) {
  const [compte, setCompte] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (e) => {
    e?.preventDefault();
    if (!compte) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ compte });
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin) params.set('date_fin', dateFin);
      const res = await api.get(`/comptabilite/grand-livre?${params.toString()}`);
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur grand livre');
    } finally { setLoading(false); }
  };

  return (
    <Card C={C}>
      <form onSubmit={fetchData} style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <input value={compte} onChange={e => setCompte(e.target.value)}
          placeholder="N° compte (ex : 411 ou 411 pour clients, 6011 pour achats)"
          style={{ ...selectStyle(C), minWidth: 220, flex: 1 }} />
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={selectStyle(C)} />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={selectStyle(C)} />
        <button type="submit" style={btnPrimary(C)}>Afficher</button>
      </form>

      {loading ? <Loading C={C} /> : !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Saisissez un numéro de compte (ou un préfixe) pour afficher le grand livre.
        </div>
      ) : data.lignes.length === 0 ? <Empty C={C} message="Aucune ligne pour ce compte sur la période" /> : (
        <>
          <div style={{ padding: '12px 18px', background: C.cardAlt, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 24, fontSize: 12 }}>
            <div><span style={{ color: C.muted }}>Total débit : </span><strong style={{ color: C.text }}>{formatFCFA(data.totaux.debit)}</strong></div>
            <div><span style={{ color: C.muted }}>Total crédit : </span><strong style={{ color: C.text }}>{formatFCFA(data.totaux.credit)}</strong></div>
            <div><span style={{ color: C.muted }}>Solde : </span><strong style={{ color: data.totaux.solde >= 0 ? C.accent : C.red }}>
              {formatFCFA(Math.abs(data.totaux.solde))} {data.totaux.solde >= 0 ? 'D' : 'C'}
            </strong></div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 100)}>Date</th>
                  <th style={th(C, 90)}>Journal</th>
                  <th style={th(C, 130)}>Pièce</th>
                  <th style={th(C, 90)}>Compte</th>
                  <th style={th(C)}>Libellé</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Débit</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Crédit</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Solde</th>
                </tr>
              </thead>
              <tbody>
                {data.lignes.map(l => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td(C), color: C.muted, fontSize: 11 }}>{formatDate(l.date_ecriture)}</td>
                    <td style={{ ...td(C), fontWeight: 700, color: C.accent }}>{l.journal_code}</td>
                    <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{l.numero_piece}</td>
                    <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace' }}>{l.compte_numero}</td>
                    <td style={td(C)}>{l.ligne_libelle || l.ecriture_libelle}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{l.debit > 0 ? formatFCFA(l.debit) : ''}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{l.credit > 0 ? formatFCFA(l.credit) : ''}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: l.solde >= 0 ? C.accent : C.red }}>
                      {formatFCFA(Math.abs(l.solde))} {l.solde >= 0 ? 'D' : 'C'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── ONGLET 4 : BALANCE GÉNÉRALE ──────────────────────────────────────────
function BalanceGenerale({ C }) {
  const annee = new Date().getFullYear();
  const [dateDebut, setDateDebut] = useState(`${annee}-01-01`);
  const [dateFin, setDateFin] = useState(`${annee}-12-31`);
  const [niveau, setNiveau] = useState('4');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin, niveau });
      const res = await api.get(`/comptabilite/balance?${params.toString()}`);
      setData(res.data.data);
    } catch { toast.error('Erreur balance'); }
    finally { setLoading(false); }
  }, [dateDebut, dateFin, niveau]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card C={C}>
      <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={selectStyle(C)} />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={selectStyle(C)} />
        <select value={niveau} onChange={e => setNiveau(e.target.value)} style={selectStyle(C)}>
          <option value="2">Regroupement à 2 chiffres</option>
          <option value="3">Regroupement à 3 chiffres</option>
          <option value="4">Regroupement à 4 chiffres</option>
          <option value="6">Regroupement détaillé</option>
        </select>
      </div>
      {loading ? <Loading C={C} /> : !data ? null : data.lignes.length === 0 ? <Empty C={C} /> : (
        <>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 100)}>Compte</th>
                  <th style={th(C)}>Libellé</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Total débit</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Total crédit</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Solde déb.</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>Solde créd.</th>
                </tr>
              </thead>
              <tbody>
                {data.lignes.map(l => (
                  <tr key={l.compte} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{l.compte}</td>
                    <td style={td(C)}>{l.libelle}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(l.total_debit)}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(l.total_credit)}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: C.accent }}>
                      {l.solde_debiteur > 0 ? formatFCFA(l.solde_debiteur) : ''}
                    </td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: C.purple }}>
                      {l.solde_crediteur > 0 ? formatFCFA(l.solde_crediteur) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: C.cardAlt, borderTop: `2px solid ${C.border}` }}>
                  <td style={{ ...td(C), fontWeight: 800 }} colSpan={2}>TOTAUX</td>
                  <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(data.totaux.debit)}</td>
                  <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(data.totaux.credit)}</td>
                  <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: C.accent }}>{formatFCFA(data.totaux.solde_debiteur)}</td>
                  <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: C.purple }}>{formatFCFA(data.totaux.solde_crediteur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── DÉTAIL ÉCRITURE (modale) ─────────────────────────────────────────────
function DetailEcritureModal({ C, ecriture, onClose }) {
  const totalDebit  = ecriture.lignes.reduce((s, l) => s + parseFloat(l.debit), 0);
  const totalCredit = ecriture.lignes.reduce((s, l) => s + parseFloat(l.credit), 0);

  return (
    <Modal title={`${ecriture.journal_code} — ${ecriture.numero_piece}`} onClose={onClose} width={780}>
      <div style={{ marginBottom: 16, padding: 12, background: C.cardAlt, borderRadius: 8, fontSize: 12 }}>
        <div style={{ color: C.text, fontWeight: 600 }}>{ecriture.libelle}</div>
        <div style={{ color: C.muted, marginTop: 4 }}>
          {formatDate(ecriture.date_ecriture)}
          {ecriture.reference && ` · Réf ${ecriture.reference}`}
          {ecriture.cree_par_nom && ` · par ${ecriture.cree_par_nom}`}
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={{ background: C.cardAlt }}>
            <th style={th(C, 90)}>Compte</th>
            <th style={th(C)}>Libellé</th>
            <th style={{ ...th(C, 110), textAlign: 'right' }}>Débit</th>
            <th style={{ ...th(C, 110), textAlign: 'right' }}>Crédit</th>
          </tr>
        </thead>
        <tbody>
          {ecriture.lignes.map(l => (
            <tr key={l.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ ...td(C), fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{l.compte_numero}</td>
              <td style={td(C)}>
                <div>{l.libelle}</div>
                {l.compte_libelle && <div style={{ fontSize: 10, color: C.muted }}>{l.compte_libelle}</div>}
              </td>
              <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{parseFloat(l.debit) > 0 ? formatFCFA(l.debit) : ''}</td>
              <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{parseFloat(l.credit) > 0 ? formatFCFA(l.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: C.cardAlt, borderTop: `2px solid ${C.border}` }}>
            <td style={{ ...td(C), fontWeight: 800 }} colSpan={2}>TOTAL</td>
            <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totalDebit)}</td>
            <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}

// ─── MODALE OD MANUELLE ───────────────────────────────────────────────────
const ligneVide = () => ({ compte: '', libelle: '', debit: '', credit: '' });

function OperationDiverseModal({ C, journaux, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [journal, setJournal] = useState('OD');
  const [date, setDate] = useState(today);
  const [libelle, setLibelle] = useState('');
  const [reference, setReference] = useState('');
  const [lignes, setLignes] = useState([ligneVide(), ligneVide()]);
  const [saving, setSaving] = useState(false);

  const totaux = useMemo(() => {
    const td = lignes.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const tc = lignes.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit: td, credit: tc, ecart: Math.round((td - tc) * 100) / 100 };
  }, [lignes]);

  const equilibre = totaux.ecart === 0 && totaux.debit > 0;

  const updateLigne = (i, k, v) => setLignes(L => L.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const ajouterLigne = () => setLignes(L => [...L, ligneVide()]);
  const supprimerLigne = (i) => setLignes(L => L.length <= 2 ? L : L.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!equilibre) return toast.error('Écriture déséquilibrée');
    if (!libelle.trim()) return toast.error('Libellé requis');

    setSaving(true);
    try {
      await api.post('/comptabilite/ecritures', {
        journal_code: journal, date, libelle, reference,
        lignes: lignes
          .filter(l => l.compte && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map(l => ({
            compte: l.compte.trim(),
            libelle: l.libelle || libelle,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur enregistrement');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Nouvelle opération diverse" onClose={onClose} width={840}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Journal</label>
            <select value={journal} onChange={e => setJournal(e.target.value)} style={{ ...selectStyle(C), width: '100%' }}>
              {journaux.map(j => <option key={j.id} value={j.code}>{j.code} — {j.libelle}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl(C)}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...selectStyle(C), width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>Référence</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optionnelle" style={{ ...selectStyle(C), width: '100%' }} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>Libellé*</label>
          <input value={libelle} onChange={e => setLibelle(e.target.value)} required
            style={{ ...selectStyle(C), width: '100%' }} placeholder="Ex : Régularisation TVA déductible novembre" />
        </div>

        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Lignes d'écriture
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 110px 30px', gap: 6 }}>
              <input value={l.compte} onChange={e => updateLigne(i, 'compte', e.target.value)}
                placeholder="N° compte" style={{ ...selectStyle(C), fontFamily: 'ui-monospace, monospace' }} />
              <input value={l.libelle} onChange={e => updateLigne(i, 'libelle', e.target.value)}
                placeholder="Libellé ligne (optionnel)" style={selectStyle(C)} />
              <input type="number" step="0.01" min="0" value={l.debit} onChange={e => updateLigne(i, 'debit', e.target.value)}
                placeholder="Débit" style={{ ...selectStyle(C), textAlign: 'right' }} />
              <input type="number" step="0.01" min="0" value={l.credit} onChange={e => updateLigne(i, 'credit', e.target.value)}
                placeholder="Crédit" style={{ ...selectStyle(C), textAlign: 'right' }} />
              <button type="button" onClick={() => supprimerLigne(i)} disabled={lignes.length <= 2} style={{
                background: 'transparent', border: 'none', color: C.muted, cursor: lignes.length <= 2 ? 'not-allowed' : 'pointer',
                opacity: lignes.length <= 2 ? 0.3 : 1,
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={ajouterLigne} style={{
          background: 'transparent', border: `1px dashed ${C.border}`, color: C.muted,
          padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
        }}>
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Ajouter une ligne
        </button>

        {/* Récap équilibre */}
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: equilibre ? `${C.accent}15` : `${C.gold}15`,
          border: `1px solid ${equilibre ? C.accent : C.gold}40`,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: C.muted }}>Débit : </span><strong style={{ color: C.text, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totaux.debit)}</strong>
              <span style={{ color: C.muted, marginLeft: 16 }}>Crédit : </span><strong style={{ color: C.text, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totaux.credit)}</strong>
            </div>
            <div>
              {equilibre ? (
                <span style={{ color: C.accent, fontWeight: 700 }}>✓ Équilibrée</span>
              ) : (
                <span style={{ color: C.gold, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={14} /> Écart : {formatFCFA(Math.abs(totaux.ecart))}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnSecondary(C)}>Annuler</button>
          <button type="submit" disabled={!equilibre || saving} style={{
            ...btnPrimary(C),
            opacity: !equilibre || saving ? 0.5 : 1,
            cursor: !equilibre || saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── COMPOSANTS UTILITAIRES ───────────────────────────────────────────────
const Card = ({ C, children }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    overflow: 'hidden', boxShadow: C.shadow,
  }}>{children}</div>
);

const Loading = ({ C }) => <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement…</div>;
const Empty = ({ C, message = 'Aucune donnée' }) => <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{message}</div>;

function Pagination({ C, page, setPage, pagination }) {
  if (pagination.pages <= 1) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${C.border}`, background: C.cardAlt,
    }}>
      <span style={{ fontSize: 12, color: C.muted }}>Page {page} sur {pagination.pages} ({pagination.total} écritures)</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pagBtn(C, page === 1)}>
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} style={pagBtn(C, page === pagination.pages)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── STYLES PARTAGÉS ──────────────────────────────────────────────────────
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const th = (C, w) => ({ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', width: w });
const td = (C) => ({ padding: '10px 12px', color: C.text, verticalAlign: 'top' });

const selectStyle = (C) => ({
  background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 8,
  padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none',
  fontFamily: 'inherit',
});

const lbl = (C) => ({
  display: 'block', fontSize: 11, fontWeight: 700, color: C.sub,
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
});

const btnPrimary = (C) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: C.accent, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
});

const btnSecondary = (C) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
});

const pagBtn = (C, disabled) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
  background: 'transparent', color: disabled ? C.muted : C.text,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
});
