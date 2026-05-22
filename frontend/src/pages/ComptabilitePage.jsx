import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import { useTranslation } from 'react-i18next';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { ReadOnlyBanner } from '../components/Can.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import {
  BookOpen, FileSpreadsheet, BookMarked, Scale, Plus, Download,
  Search, ChevronLeft, ChevronRight, Trash2, AlertTriangle,
  Lock, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, FileText, Sheet, Upload,
} from 'lucide-react';
import ImportExcelModal from '../components/ImportExcelModal.jsx';

// Onglets : id + icône ; le libellé est résolu via t('comptabilite.tab_*') au rendu.
const TABS = [
  { id: 'plan',     i18nKey: 'comptabilite.tab_plan',    icon: BookOpen },
  { id: 'journal',  i18nKey: 'comptabilite.tab_journal', icon: FileSpreadsheet },
  { id: 'gl',       i18nKey: 'comptabilite.tab_gl',      icon: BookMarked },
  { id: 'balance',  i18nKey: 'comptabilite.tab_balance', icon: Scale },
  { id: 'cloture',  i18nKey: 'comptabilite.tab_cloture', icon: Lock },
];

// Classes SYSCOHADA : value + clé i18n du libellé court. Libellé final composé
// au rendu avec t('comptabilite.class_label', { n, label }).
const CLASS_DESCRIPTIONS = {
  '1': { fr: 'Ressources durables',   en: 'Long-term resources' },
  '2': { fr: 'Actif immobilisé',      en: 'Fixed assets' },
  '3': { fr: 'Stocks',                en: 'Inventory' },
  '4': { fr: 'Tiers',                 en: 'Third parties' },
  '5': { fr: 'Trésorerie',            en: 'Treasury' },
  '6': { fr: 'Charges',               en: 'Charges' },
  '7': { fr: 'Produits',              en: 'Revenues' },
  '8': { fr: 'HAO et IS',             en: 'HAO and CIT' },
  '9': { fr: 'Analytique',            en: 'Analytic' },
};

const NATURE_COULEURS = {
  ACTIF:      '#4E8BF5',
  PASSIF:     '#A855F7',
  CHARGE:     '#FF5C6B',
  PRODUIT:    '#00D4AA',
  HAO:        '#F5A623',
  ANALYTIQUE: '#6B7A99',
};

export default function ComptabilitePage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const { actuelle } = useEntreprise();
  const { can } = usePermissions();
  const C = getC(dark);
  // Permissions issues de la matrice : créer une OD demande ecritures.create,
  // l'export FEC et la clôture demandent cloture.read/create (EC + admin).
  const peutEcrire = can('ecritures', 'create');
  const peutExporter = can('cloture', 'read');

  const [tab, setTab] = useState('plan');
  const [showOD, setShowOD] = useState(false);
  const [journaux, setJournaux] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [importType, setImportType] = useState(null);  // 'plan_comptable' | 'balance_ouverture' | 'ecritures_historiques'
  const [importOpen, setImportOpen] = useState(false);

  // Charge la liste des journaux une fois (utile pour le filtre journal et l'OD)
  useEffect(() => {
    api.get('/comptabilite/journaux')
      .then(r => setJournaux(r.data.data))
      .catch(() => {});
  }, []);

  // Téléchargement générique pour les 4 exports comptables. `kind` cible
  // l'état (« journal » ou « grand-livre »), `format` choisit txt ou
  // excel, `prettyName` sert au nom de fichier proposé au navigateur.
  const downloadExport = async (kind, format, prettyName) => {
    const annee = prompt(t('comptabilite.fec_prompt'), String(new Date().getFullYear()));
    if (!annee) return;
    setExportOpen(false);
    try {
      const res = await api.get(`/comptabilite/${kind}/${format}?annee=${annee}`, { responseType: 'blob' });
      const ext = format === 'excel' ? 'xlsx' : 'txt';
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${prettyName}_${annee}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('comptabilite.export_done', { name: prettyName, year: annee }));
    } catch (err) {
      toast.error(err.response?.data?.message || t('comptabilite.fec_error'));
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
              {t('comptabilite.title')}
            </h1>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {t('comptabilite.subtitle')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {peutEcrire && (
            <button onClick={() => setShowOD(true)} style={btnPrimary(C)}>
              <Plus size={14} /> {t('comptabilite.new_od')}
            </button>
          )}
          {peutEcrire && (
            <ImportMenu C={C} dark={dark} t={t} onPick={(type) => { setImportType(type); setImportOpen(true); }} />
          )}
          {peutExporter && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setExportOpen(o => !o)} style={btnSecondary(C)}>
                <Download size={14} />
                {t('comptabilite.export_menu')}
                <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: exportOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {exportOpen && (
                <>
                  {/* Overlay invisible : un clic n'importe où ferme le menu */}
                  <div onClick={() => setExportOpen(false)} style={{
                    position: 'fixed', inset: 0, zIndex: 20,
                  }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 21,
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: 6, minWidth: 260,
                    boxShadow: dark ? '0 16px 36px rgba(0,0,0,0.45)' : '0 14px 30px rgba(14,17,22,0.14)',
                  }}>
                    <div style={menuLabel(C)}>{t('comptabilite.tab_journal')}</div>
                    <button onClick={() => downloadExport('journal', 'txt',   'Journal')}      style={menuItem(C)}>
                      <FileText size={14} color={C.muted} /> {t('comptabilite.export_format_txt')}
                    </button>
                    <button onClick={() => downloadExport('journal', 'excel', 'Journal')}      style={menuItem(C)}>
                      <Sheet size={14} color={C.accent} /> {t('comptabilite.export_format_excel')}
                    </button>
                    <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />
                    <div style={menuLabel(C)}>{t('comptabilite.tab_gl')}</div>
                    <button onClick={() => downloadExport('grand-livre', 'txt',   'Grand-Livre')} style={menuItem(C)}>
                      <FileText size={14} color={C.muted} /> {t('comptabilite.export_format_txt')}
                    </button>
                    <button onClick={() => downloadExport('grand-livre', 'excel', 'Grand-Livre')} style={menuItem(C)}>
                      <Sheet size={14} color={C.accent} /> {t('comptabilite.export_format_excel')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ReadOnlyBanner module="ecritures" />

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {TABS.map(item => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? C.text : C.muted,
              background: active ? C.cardAlt : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {t(item.i18nKey)}
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
        {tab === 'cloture' && <ClotureExercices C={C} peutEcrire={peutEcrire} />}
      </div>

      {/* Modale OD */}
      {showOD && (
        <OperationDiverseModal
          C={C}
          journaux={journaux}
          onClose={() => setShowOD(false)}
          onSaved={() => { setShowOD(false); toast.success(t('comptabilite.od_created')); }}
        />
      )}

      <Onboarding pageKey="comptabilite" />

      <ImportExcelModal
        type={importType}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { /* l'utilisateur ferme manuellement après avoir vu le récap ;
                          la liste se rechargera à l'ouverture de l'onglet concerné. */ }}
      />
    </div>
  );
}

// Menu d'import des 3 imports comptables (plan, balance, écritures
// historiques). Inspiré du menu d'export, mais avec icône Upload.
function ImportMenu({ C, dark, t, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={btnSecondary(C)}>
        <Upload size={14} />
        {t('imports.btn_import')}
        <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 21,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 6, minWidth: 280,
            boxShadow: dark ? '0 16px 36px rgba(0,0,0,0.45)' : '0 14px 30px rgba(14,17,22,0.14)',
          }}>
            <button onClick={() => { setOpen(false); onPick('plan_comptable'); }} style={menuItem(C)}>
              <BookOpen size={14} color={C.accent} /> {t('imports.title_plan_comptable')}
            </button>
            <button onClick={() => { setOpen(false); onPick('balance_ouverture'); }} style={menuItem(C)}>
              <Scale size={14} color={C.accent} /> {t('imports.title_balance_ouverture')}
            </button>
            <button onClick={() => { setOpen(false); onPick('ecritures_historiques'); }} style={menuItem(C)}>
              <FileSpreadsheet size={14} color={C.accent} /> {t('imports.title_ecritures_historiques')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ONGLET 1 : PLAN COMPTABLE ────────────────────────────────────────────
function PlanComptable({ C }) {
  const { t, i18n } = useTranslation();
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
    } catch { toast.error(t('common.loading_error')); }
    finally { setLoading(false); }
  }, [classe, search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Construit la liste des options de classe selon la langue active.
  const classOptions = [{ value: '', label: t('comptabilite.all_classes') }];
  for (const n of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    const label = i18n.language?.startsWith('en') ? CLASS_DESCRIPTIONS[n].en : CLASS_DESCRIPTIONS[n].fr;
    classOptions.push({ value: n, label: t('comptabilite.class_label', { n, label }) });
  }

  return (
    <Card C={C}>
      <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <select value={classe} onChange={e => setClasse(e.target.value)} style={selectStyle(C)}>
          {classOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('comptabilite.search_account')}
            style={{ ...selectStyle(C), paddingLeft: 32, width: '100%' }} />
        </div>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {loading ? <Loading C={C} /> : comptes.length === 0 ? <Empty C={C} message={t('comptabilite.empty_plan')} /> : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: C.cardAlt }}>
                <th style={th(C, 110)}>{t('comptabilite.col_account')}</th>
                <th style={th(C)}>{t('comptabilite.col_label')}</th>
                <th style={th(C, 100)}>{t('comptabilite.col_class')}</th>
                <th style={th(C, 110)}>{t('comptabilite.col_nature')}</th>
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
  const { t, i18n } = useTranslation();
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
    } catch { toast.error(t('common.loading_error')); }
    finally { setLoading(false); }
  }, [page, filtres, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFiltre = (k) => (e) => { setPage(1); setFiltres(f => ({ ...f, [k]: e.target.value })); };

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/comptabilite/ecritures/${id}`);
      setDetail(res.data.data);
    } catch { toast.error(t('common.loading_error')); }
  };

  // Résout le libellé de l'origine d'une écriture (MANUEL ou AUTO_*).
  const labelOrigine = (origine) => {
    if (!origine || origine === 'MANUEL') return 'OD';
    const key = `comptabilite.origin_${origine.toLowerCase()}`;
    return i18n.exists(key) ? t(key) : origine.replace('AUTO_', '').toLowerCase();
  };

  return (
    <>
      <Card C={C}>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, borderBottom: `1px solid ${C.border}` }}>
          <select value={filtres.journal_code} onChange={updateFiltre('journal_code')} style={selectStyle(C)}>
            <option value="">{t('comptabilite.all_journals')}</option>
            {journaux.map(j => <option key={j.id} value={j.code}>{j.code} — {j.libelle}</option>)}
          </select>
          <input type="date" value={filtres.date_debut} onChange={updateFiltre('date_debut')} style={selectStyle(C)} />
          <input type="date" value={filtres.date_fin} onChange={updateFiltre('date_fin')} style={selectStyle(C)} />
          <input value={filtres.search} onChange={updateFiltre('search')} placeholder={t('comptabilite.search_journal')} style={selectStyle(C)} />
        </div>
        {loading ? <Loading C={C} /> : ecritures.length === 0 ? <Empty C={C} message={t('comptabilite.empty_journal')} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 70)}>{t('comptabilite.col_journal')}</th>
                  <th style={th(C, 130)}>{t('comptabilite.col_piece')}</th>
                  <th style={th(C, 100)}>{t('comptabilite.col_date')}</th>
                  <th style={th(C)}>{t('comptabilite.col_label')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_debit')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_credit')}</th>
                  <th style={th(C, 90)}>{t('comptabilite.col_origine')}</th>
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
                      {e.reference && <div style={{ color: C.muted, fontSize: 10 }}>{t('common.reference')} : {e.reference}</div>}
                    </td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(e.total_debit)}</td>
                    <td style={{ ...td(C), textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(e.total_credit)}</td>
                    <td style={{ ...td(C), color: C.muted, fontSize: 10 }}>
                      {labelOrigine(e.origine)}
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
  const { t } = useTranslation();
  const [compte, setCompte] = useState('');
  // Bornage par défaut sur l'exercice courant. Sans ce filtre, le backend
  // renvoie toutes les écritures (toutes années confondues) et le solde
  // progressif additionne l'AN d'ouverture de N+1 par-dessus le solde de
  // clôture de N — ce qui « double » le solde affiché en haut de tableau.
  // Même pattern que BalanceGenerale plus bas.
  const annee = new Date().getFullYear();
  const [dateDebut, setDateDebut] = useState(`${annee}-01-01`);
  const [dateFin, setDateFin] = useState(`${annee}-12-31`);
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
      toast.error(err.response?.data?.message || t('comptabilite.gl_error'));
    } finally { setLoading(false); }
  };

  return (
    <Card C={C}>
      <form onSubmit={fetchData} style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <input value={compte} onChange={e => setCompte(e.target.value)}
          placeholder={t('comptabilite.gl_search_placeholder')}
          style={{ ...selectStyle(C), minWidth: 220, flex: 1 }} />
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={selectStyle(C)} />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={selectStyle(C)} />
        <button type="submit" style={btnPrimary(C)}>{t('common.show')}</button>
      </form>

      {loading ? <Loading C={C} /> : !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          {t('comptabilite.gl_prompt')}
        </div>
      ) : data.lignes.length === 0 ? <Empty C={C} message={t('comptabilite.gl_empty')} /> : (
        <>
          <div style={{ padding: '12px 18px', background: C.cardAlt, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 24, fontSize: 12 }}>
            <div><span style={{ color: C.muted }}>{t('comptabilite.total_debit')} : </span><strong style={{ color: C.text }}>{formatFCFA(data.totaux.debit)}</strong></div>
            <div><span style={{ color: C.muted }}>{t('comptabilite.total_credit')} : </span><strong style={{ color: C.text }}>{formatFCFA(data.totaux.credit)}</strong></div>
            <div><span style={{ color: C.muted }}>{t('comptabilite.solde')} : </span><strong style={{ color: data.totaux.solde >= 0 ? C.accent : C.red }}>
              {formatFCFA(Math.abs(data.totaux.solde))} {data.totaux.solde >= 0 ? t('comptabilite.debit_short') : t('comptabilite.credit_short')}
            </strong></div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 100)}>{t('comptabilite.col_date')}</th>
                  <th style={th(C, 90)}>{t('comptabilite.col_journal')}</th>
                  <th style={th(C, 130)}>{t('comptabilite.col_piece_short')}</th>
                  <th style={th(C, 90)}>{t('comptabilite.col_account')}</th>
                  <th style={th(C)}>{t('comptabilite.col_label')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_debit')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_credit')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.solde')}</th>
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
                      {formatFCFA(Math.abs(l.solde))} {l.solde >= 0 ? t('comptabilite.debit_short') : t('comptabilite.credit_short')}
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
  const { t } = useTranslation();
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
    } catch { toast.error(t('comptabilite.balance_error')); }
    finally { setLoading(false); }
  }, [dateDebut, dateFin, niveau, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card C={C}>
      <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={selectStyle(C)} />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={selectStyle(C)} />
        <select value={niveau} onChange={e => setNiveau(e.target.value)} style={selectStyle(C)}>
          <option value="2">{t('comptabilite.level_2')}</option>
          <option value="3">{t('comptabilite.level_3')}</option>
          <option value="4">{t('comptabilite.level_4')}</option>
          <option value="6">{t('comptabilite.level_detail')}</option>
        </select>
      </div>
      {loading ? <Loading C={C} /> : !data ? null : data.lignes.length === 0 ? <Empty C={C} /> : (
        <>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: C.cardAlt }}>
                  <th style={th(C, 100)}>{t('comptabilite.col_account')}</th>
                  <th style={th(C)}>{t('comptabilite.col_label')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.total_debit')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.total_credit')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.solde_debiteur')}</th>
                  <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.solde_crediteur')}</th>
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
                  <td style={{ ...td(C), fontWeight: 800 }} colSpan={2}>{t('comptabilite.totals')}</td>
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
  const { t } = useTranslation();
  const totalDebit  = ecriture.lignes.reduce((s, l) => s + parseFloat(l.debit), 0);
  const totalCredit = ecriture.lignes.reduce((s, l) => s + parseFloat(l.credit), 0);

  return (
    <Modal title={`${ecriture.journal_code} — ${ecriture.numero_piece}`} onClose={onClose} width={780}>
      <div style={{ marginBottom: 16, padding: 12, background: C.cardAlt, borderRadius: 8, fontSize: 12 }}>
        <div style={{ color: C.text, fontWeight: 600 }}>{ecriture.libelle}</div>
        <div style={{ color: C.muted, marginTop: 4 }}>
          {formatDate(ecriture.date_ecriture)}
          {ecriture.reference && ` · ${t('common.reference')} ${ecriture.reference}`}
          {ecriture.cree_par_nom && ` · ${t('common.by')} ${ecriture.cree_par_nom}`}
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={{ background: C.cardAlt }}>
            <th style={th(C, 90)}>{t('comptabilite.col_account')}</th>
            <th style={th(C)}>{t('comptabilite.col_label')}</th>
            <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_debit')}</th>
            <th style={{ ...th(C, 110), textAlign: 'right' }}>{t('comptabilite.col_credit')}</th>
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
            <td style={{ ...td(C), fontWeight: 800 }} colSpan={2}>{t('comptabilite.total')}</td>
            <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totalDebit)}</td>
            <td style={{ ...td(C), textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}

// ─── MODALE OD MANUELLE ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// CLÔTURE D'EXERCICE
// ═══════════════════════════════════════════════════════════════════════════
function ClotureExercices({ C, peutEcrire }) {
  const { t } = useTranslation();
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/comptabilite/exercices');
      setExercices(r.data.data);
    } catch { toast.error(t('comptabilite.fy_load_error')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { charger(); }, [charger]);

  if (selected) {
    return <ClotureDetail exercice={selected} C={C} peutEcrire={peutEcrire}
                          onBack={() => setSelected(null)}
                          onCloture={() => { setSelected(null); charger(); }} />;
  }

  if (loading) return <Loading C={C} />;

  return (
    <div>
      <Card C={C}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t('comptabilite.fy_title')}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
            {t('comptabilite.fy_intro')}
          </div>
        </div>
        {exercices.length === 0 ? (
          <Empty C={C} message={t('comptabilite.fy_empty')} />
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                <th style={th(C)}>{t('comptabilite.col_label')}</th>
                <th style={th(C)}>{t('comptabilite.col_period')}</th>
                <th style={th(C)}>{t('comptabilite.col_status')}</th>
                <th style={th(C)}>{t('comptabilite.col_closed_on')}</th>
                <th style={{ ...th(C), textAlign: 'right' }}>{t('comptabilite.col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {exercices.map(ex => (
                <tr key={ex.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ ...td(C), fontWeight: 700 }}>{ex.libelle}</td>
                  <td style={{ ...td(C), fontSize: 11, color: C.muted }}>
                    {formatDate(ex.date_debut)} → {formatDate(ex.date_fin)}
                  </td>
                  <td style={td(C)}>
                    {ex.cloture ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: `${C.muted}20`, color: C.muted, fontSize: 10, fontWeight: 700 }}>
                        <Lock size={11} /> {t('comptabilite.status_closed')}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: `${C.accent}20`, color: C.accent, fontSize: 10, fontWeight: 700 }}>
                        {t('comptabilite.status_open')}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td(C), fontSize: 11, color: C.muted }}>
                    {ex.date_cloture ? formatDate(ex.date_cloture) : '—'}
                  </td>
                  <td style={{ ...td(C), textAlign: 'right' }}>
                    {!ex.cloture && peutEcrire && (
                      <button onClick={() => setSelected(ex)} style={{
                        padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.accent}40`,
                        background: `${C.accent}15`, color: C.accent, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer',
                      }}>
                        {t('comptabilite.prepare_closing')} →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function ClotureDetail({ exercice, C, peutEcrire, onBack, onCloture }) {
  const { t } = useTranslation();
  const [checks, setChecks] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/comptabilite/exercices/${exercice.id}/pre-cloture`);
      setChecks(r.data.data.checks);
      setInfo(r.data.data.exercice);
    } catch (err) {
      toast.error(err.response?.data?.message || t('comptabilite.checks_load_error'));
    } finally { setLoading(false); }
  }, [exercice.id, t]);

  useEffect(() => { charger(); }, [charger]);

  const bloquants = checks.filter(c => c.niveau === 'error').length;
  const warnings = checks.filter(c => c.niveau === 'warning').length;
  const resultat = checks.find(c => c.code === 'RESULTAT_PREVISIONNEL')?.data;

  const cloturer = async () => {
    if (!confirm(t('comptabilite.cloture_confirm', { libelle: exercice.libelle }))) return;
    setSaving(true);
    try {
      const r = await api.post(`/comptabilite/exercices/${exercice.id}/cloturer`);
      const e = r.data.data.ecritures_generees;
      toast.success(t('comptabilite.cloture_success', {
        libelle: exercice.libelle,
        a: e.solde_charges || '—',
        b: e.solde_produits || '—',
        c: e.a_nouveau || '—',
      }));
      onCloture();
    } catch (err) {
      toast.error(err.response?.data?.message || t('comptabilite.cloture_error'));
    } finally { setSaving(false); }
  };

  if (loading || !info) return <Loading C={C} />;

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
        border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
      }}><ChevronLeft size={14} /> {t('common.back')}</button>

      <Card C={C}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{t('comptabilite.cloture_of', { libelle: info.libelle })}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {t('comptabilite.col_period')} {formatDate(info.date_debut)} → {formatDate(info.date_fin)}
              </div>
            </div>
            {resultat && (
              <div style={{
                padding: '10px 16px', borderRadius: 10,
                background: resultat.resultat >= 0 ? `${C.accent}15` : '#FF5C6B15',
                border: `1px solid ${resultat.resultat >= 0 ? C.accent : '#FF5C6B'}30`,
              }}>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {t('comptabilite.estimated_result')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: resultat.resultat >= 0 ? C.accent : '#FF5C6B' }}>
                  {formatFCFA(resultat.resultat)} <span style={{ fontSize: 10, fontWeight: 500 }}>FCFA</span>
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>
                  {t('comptabilite.products_short')} {formatFCFA(resultat.totalProduits)} − {t('comptabilite.charges_short')} {formatFCFA(resultat.totalCharges)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '8px 0' }}>
          {checks.map((c, i) => {
            const Icon = c.niveau === 'ok' ? CheckCircle2 : c.niveau === 'error' ? XCircle : AlertCircle;
            const color = c.niveau === 'ok' ? C.accent : c.niveau === 'error' ? '#FF5C6B' : '#F5A623';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 22px', borderBottom: i < checks.length - 1 ? `1px solid ${C.border}22` : 'none',
              }}>
                <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, fontSize: 13, color: C.text }}>{c.message}</div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px 22px', background: C.cardAlt, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
            <strong style={{ color: C.text }}>{t('comptabilite.cloture_effects_title')} :</strong> {t('comptabilite.cloture_effects_body', { libelle: info.libelle })}
          </div>
          {peutEcrire && (
            <button onClick={cloturer} disabled={bloquants > 0 || saving} style={{
              padding: '11px 22px', borderRadius: 10, border: 'none',
              background: (bloquants > 0 || saving) ? C.border : '#FF5C6B',
              color: (bloquants > 0 || saving) ? C.muted : '#fff',
              fontSize: 13, fontWeight: 700,
              cursor: (bloquants > 0 || saving) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Lock size={14} />
              {saving ? t('comptabilite.cloture_in_progress')
                : bloquants > 0 ? t('comptabilite.cloture_fix_blockers', { n: bloquants })
                : warnings > 0 ? t('comptabilite.cloture_despite_warnings', { n: warnings })
                : t('comptabilite.cloture_action', { libelle: info.libelle })}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

const ligneVide = () => ({ compte: '', libelle: '', debit: '', credit: '' });

function OperationDiverseModal({ C, journaux, onClose, onSaved }) {
  const { t } = useTranslation();
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
    if (!equilibre) return toast.error(t('comptabilite.od_unbalanced_short'));
    if (!libelle.trim()) return toast.error(t('comptabilite.label_required'));

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
      toast.error(err.response?.data?.message || t('comptabilite.save_error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={t('comptabilite.od_new_title')} onClose={onClose} width={840}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>{t('comptabilite.col_journal')}</label>
            <select value={journal} onChange={e => setJournal(e.target.value)} style={{ ...selectStyle(C), width: '100%' }}>
              {journaux.map(j => <option key={j.id} value={j.code}>{j.code} — {j.libelle}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl(C)}>{t('comptabilite.col_date')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...selectStyle(C), width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>{t('common.reference')}</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder={t('common.optional')} style={{ ...selectStyle(C), width: '100%' }} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>{t('comptabilite.col_label')}*</label>
          <input value={libelle} onChange={e => setLibelle(e.target.value)} required
            style={{ ...selectStyle(C), width: '100%' }} placeholder={t('comptabilite.od_label_placeholder')} />
        </div>

        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('comptabilite.od_lines')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 110px 30px', gap: 6 }}>
              <input value={l.compte} onChange={e => updateLigne(i, 'compte', e.target.value)}
                placeholder={t('comptabilite.col_account')} style={{ ...selectStyle(C), fontFamily: 'ui-monospace, monospace' }} />
              <input value={l.libelle} onChange={e => updateLigne(i, 'libelle', e.target.value)}
                placeholder={t('comptabilite.od_line_label')} style={selectStyle(C)} />
              <input type="number" step="0.01" min="0" value={l.debit} onChange={e => updateLigne(i, 'debit', e.target.value)}
                placeholder={t('comptabilite.col_debit')} style={{ ...selectStyle(C), textAlign: 'right' }} />
              <input type="number" step="0.01" min="0" value={l.credit} onChange={e => updateLigne(i, 'credit', e.target.value)}
                placeholder={t('comptabilite.col_credit')} style={{ ...selectStyle(C), textAlign: 'right' }} />
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
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('comptabilite.add_line')}
        </button>

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: equilibre ? `${C.accent}15` : `${C.gold}15`,
          border: `1px solid ${equilibre ? C.accent : C.gold}40`,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: C.muted }}>{t('comptabilite.col_debit')} : </span><strong style={{ color: C.text, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totaux.debit)}</strong>
              <span style={{ color: C.muted, marginLeft: 16 }}>{t('comptabilite.col_credit')} : </span><strong style={{ color: C.text, fontFamily: 'ui-monospace, monospace' }}>{formatFCFA(totaux.credit)}</strong>
            </div>
            <div>
              {equilibre ? (
                <span style={{ color: C.accent, fontWeight: 700 }}>✓ {t('comptabilite.od_balanced_label')}</span>
              ) : (
                <span style={{ color: C.gold, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={14} /> {t('comptabilite.od_gap')} : {formatFCFA(Math.abs(totaux.ecart))}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnSecondary(C)}>{t('common.cancel')}</button>
          <button type="submit" disabled={!equilibre || saving} style={{
            ...btnPrimary(C),
            opacity: !equilibre || saving ? 0.5 : 1,
            cursor: !equilibre || saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? t('common.saving') : t('common.save')}
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

const Loading = ({ C }) => {
  const { t } = useTranslation();
  return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('common.loading')}…</div>;
};
const Empty = ({ C, message }) => {
  const { t } = useTranslation();
  return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{message || t('common.no_data')}</div>;
};

function Pagination({ C, page, setPage, pagination }) {
  const { t } = useTranslation();
  if (pagination.pages <= 1) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${C.border}`, background: C.cardAlt,
    }}>
      <span style={{ fontSize: 12, color: C.muted }}>{t('comptabilite.pagination', { page, pages: pagination.pages, total: pagination.total })}</span>
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

// Menu déroulant des exports : item cliquable + petit label de section.
const menuItem = (C) => ({
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '9px 12px', borderRadius: 7,
  border: 'none', background: 'transparent', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: C.text,
  textAlign: 'left', transition: 'background 0.15s',
});

const menuLabel = (C) => ({
  padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: C.muted,
  letterSpacing: '0.08em', textTransform: 'uppercase',
});

const pagBtn = (C, disabled) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
  background: 'transparent', color: disabled ? C.muted : C.text,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
});
