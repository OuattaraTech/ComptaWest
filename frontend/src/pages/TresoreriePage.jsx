import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input, AlerteSolde, evaluerSortie } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import {
  Wallet, Smartphone, Banknote, Plus, Upload, ArrowDownCircle,
  ArrowUpCircle, ChevronLeft, Link2, Unlink, Trash2, ArrowLeftRight,
  CheckCircle, AlertCircle, FileSpreadsheet, Eye,
} from 'lucide-react';

const TYPE_CONFIG = {
  banque:       { label: 'Banque',       icon: Banknote,   color: '#4E8BF5' },
  mobile_money: { label: 'Mobile Money', icon: Smartphone, color: '#A855F7' },
  caisse:       { label: 'Caisse',       icon: Wallet,     color: '#F5A623' },
};

const fmt = (n) => formatFCFA(n, false);

export default function TresoreriePage() {
  const { dark } = useTheme();
  const C = getC(dark);

  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compteActif, setCompteActif] = useState(null);  // null = vue liste, sinon vue détail
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfert, setShowTransfert] = useState(false);

  const fetchComptes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tresorerie/comptes');
      setComptes(res.data.data);
    } catch { toast.error('Erreur chargement des comptes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchComptes(); }, [fetchComptes]);

  // Vue détail d'un compte
  if (compteActif) {
    return (
      <DetailCompte
        compte={compteActif}
        onBack={() => { setCompteActif(null); fetchComptes(); }}
        C={C} dark={dark}
      />
    );
  }

  // ── Totaux par type
  const totauxParType = comptes.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = { total: 0, nb: 0 };
    acc[c.type].total += parseFloat(c.solde_actuel) || 0;
    acc[c.type].nb += 1;
    return acc;
  }, {});

  const totalGlobal = comptes.reduce((s, c) => s + (parseFloat(c.solde_actuel) || 0), 0);

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Trésorerie</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Comptes bancaires · Mobile Money · Caisses
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-onboarding="btn-transfert" onClick={() => setShowTransfert(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
            border: `1.5px solid ${C.border}`, background: 'transparent',
            color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <ArrowLeftRight size={14} /> Transfert
          </button>
          <button data-onboarding="btn-nouveau" onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
            border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={15} /> Nouveau compte
          </button>
        </div>
      </div>

      {/* KPI : solde global + par type */}
      <div data-onboarding="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.accent}20, ${C.accent}05)`,
          border: `1.5px solid ${C.accent}40`, borderRadius: 14, padding: '20px 22px',
        }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Solde total
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: 'monospace' }}>
            {fmt(totalGlobal)} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>FCFA</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{comptes.length} compte(s) actif(s)</div>
        </div>
        {['banque', 'mobile_money', 'caisse'].map(t => {
          const cfg = TYPE_CONFIG[t];
          const tot = totauxParType[t] || { total: 0, nb: 0 };
          const Icon = cfg.icon;
          return (
            <div key={t} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '20px 22px', position: 'relative', overflow: 'hidden',
              boxShadow: C.shadow,
            }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: 60, height: 60,
                background: `radial-gradient(circle at top right, ${cfg.color}25, transparent 70%)`,
                borderRadius: '0 14px 0 60px',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {cfg.label}
                </span>
                <Icon size={15} color={cfg.color} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
                {fmt(tot.total)}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{tot.nb} compte(s)</div>
            </div>
          );
        })}
      </div>

      {/* Liste comptes par type */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>Chargement...</div>
      ) : comptes.length === 0 ? (
        <div style={{
          background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: 16,
          padding: '60px 20px', textAlign: 'center',
        }}>
          <Wallet size={36} color={C.muted} style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            Aucun compte de trésorerie
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            Créez votre premier compte pour suivre vos flux d'argent.
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '10px 22px', borderRadius: 10, border: 'none',
            background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>+ Créer un compte</button>
        </div>
      ) : (
        <div data-onboarding="liste-comptes" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {['banque', 'mobile_money', 'caisse'].map(type => {
            const list = comptes.filter(c => c.type === type);
            if (list.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;
            return (
              <section key={type}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Icon size={16} color={cfg.color} />
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {cfg.label}
                  </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {list.map(c => (
                    <CompteCard key={c.id} compte={c} onClick={() => setCompteActif(c)} C={C} dark={dark} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CompteFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchComptes(); toast.success('Compte créé'); }}
          C={C} dark={dark}
        />
      )}
      {showTransfert && (
        <TransfertModal
          comptes={comptes}
          onClose={() => setShowTransfert(false)}
          onSaved={() => { setShowTransfert(false); fetchComptes(); toast.success('Transfert effectué'); }}
          C={C} dark={dark}
        />
      )}

      <Onboarding pageKey="tresorerie" />
    </div>
  );
}

// ─── Carte compte ──────────────────────────────────────────────────────────
function CompteCard({ compte, onClick, C, dark }) {
  const cfg = TYPE_CONFIG[compte.type];
  const Icon = cfg.icon;
  const solde = parseFloat(compte.solde_actuel) || 0;
  const nbAlertes = parseInt(compte.nb_non_rapproches || 0);

  return (
    <div onClick={onClick} style={{
      background: C.card, border: `1.5px solid ${compte.par_defaut ? cfg.color + '60' : C.border}`,
      borderRadius: 14, padding: 18, cursor: 'pointer',
      boxShadow: C.shadow, transition: 'all 0.15s', position: 'relative',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = cfg.color; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = compte.par_defaut ? cfg.color + '60' : C.border; }}
    >
      {compte.par_defaut && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: `${cfg.color}20`, color: cfg.color,
        }}>Par défaut</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={cfg.color} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {compte.nom}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            {compte.operateur || cfg.label}{compte.numero_compte ? ` · ${compte.numero_compte.slice(-4).padStart(8, '*')}` : ''}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: solde >= 0 ? C.text : C.red, fontFamily: 'monospace' }}>
        {fmt(solde)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{compte.devise || 'FCFA'}</span>
      </div>
      {nbAlertes > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.gold }}>
          <AlertCircle size={12} /> {nbAlertes} mouvement(s) non rapproché(s)
        </div>
      )}
    </div>
  );
}

// ─── Modal création / édition de compte ────────────────────────────────────
function CompteFormModal({ onClose, onSaved, C, dark, compte: editing }) {
  const [operateurs, setOperateurs] = useState({ banque: [], mobile_money: [], caisse: [] });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(editing || {
    nom: '', type: 'mobile_money', operateur: '', numero_compte: '',
    titulaire: '', devise: 'XOF', solde_initial: 0, par_defaut: false,
    decouvert_autorise: false, decouvert_max: 0,
  });

  useEffect(() => {
    api.get('/tresorerie/operateurs').then(r => setOperateurs(r.data.data)).catch(() => {});
  }, []);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/tresorerie/comptes/${editing.id}`, form);
      } else {
        await api.post('/tresorerie/comptes', form);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur enregistrement');
    } finally { setSaving(false); }
  };

  const operateursDisponibles = operateurs[form.type] || [];
  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={editing ? 'Modifier le compte' : 'Nouveau compte de trésorerie'} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Type */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Type de compte
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {['banque', 'mobile_money', 'caisse'].map(t => {
              const cfg = TYPE_CONFIG[t];
              const Icon = cfg.icon;
              const active = form.type === t;
              return (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t, operateur: '' }))}
                  disabled={!!editing}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 9,
                    border: `1.5px solid ${active ? cfg.color : C.border}`,
                    background: active ? `${cfg.color}15` : 'transparent',
                    color: active ? cfg.color : C.muted,
                    fontSize: 12, fontWeight: 600, cursor: editing ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: editing ? 0.7 : 1,
                  }}>
                  <Icon size={13} /> {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input label="Nom du compte" value={form.nom} onChange={set('nom')}
          placeholder={form.type === 'mobile_money' ? 'Wave principal' : 'Compte courant BICICI'} required />

        {/* Opérateur */}
        {operateursDisponibles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {form.type === 'banque' ? 'Banque' : form.type === 'mobile_money' ? 'Opérateur' : 'Emplacement'}
            </label>
            <select value={form.operateur || ''} onChange={set('operateur')} style={selectStyle}>
              <option value="">— Sélectionner —</option>
              {operateursDisponibles.map(op => (
                <option key={op.code} value={op.code}>{op.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={form.type === 'mobile_money' ? 'Numéro mobile' : 'Numéro / IBAN'}
            value={form.numero_compte || ''} onChange={set('numero_compte')}
            placeholder={form.type === 'mobile_money' ? '+225 07 00 00 00 00' : 'CI00 0000 0000 0000'} />
          <Input label="Titulaire" value={form.titulaire || ''} onChange={set('titulaire')} placeholder="Nom du titulaire" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Solde initial" type="number" value={form.solde_initial}
            onChange={set('solde_initial')} placeholder="0" />
          <Input label="Devise" value={form.devise || 'XOF'} onChange={set('devise')} placeholder="XOF" />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '8px 0' }}>
          <input type="checkbox" checked={!!form.par_defaut}
            onChange={e => setForm(f => ({ ...f, par_defaut: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: C.accent }} />
          <span style={{ fontSize: 12, color: C.sub }}>
            Définir comme compte par défaut pour les {TYPE_CONFIG[form.type].label.toLowerCase()}
          </span>
        </label>

        {/* Découvert : pertinent surtout pour les banques */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}` }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.decouvert_autorise}
              onChange={e => setForm(f => ({ ...f, decouvert_autorise: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: C.accent }} />
            <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>
              Autoriser le découvert
              {form.type !== 'banque' && <span style={{ color: C.gold }}> (déconseillé pour {TYPE_CONFIG[form.type].label.toLowerCase()})</span>}
            </span>
          </label>
          {form.decouvert_autorise && (
            <div style={{ marginTop: 10 }}>
              <Input label="Découvert maximum autorisé (FCFA)" type="number"
                value={form.decouvert_max} onChange={set('decouvert_max')} placeholder="0" />
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                Le solde ne pourra pas descendre sous −{new Intl.NumberFormat('fr-FR').format(parseFloat(form.decouvert_max) || 0)} {form.devise || 'FCFA'}.
              </div>
            </div>
          )}
          {!form.decouvert_autorise && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>
              Blocage strict : aucune sortie ne pourra rendre le solde négatif.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer le compte'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal transfert inter-comptes ─────────────────────────────────────────
function TransfertModal({ comptes, onClose, onSaved, C, dark }) {
  const [form, setForm] = useState({
    compte_source_id: '', compte_destination_id: '', montant: '',
    date_operation: new Date().toISOString().split('T')[0],
    libelle: '', reference: '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.compte_source_id || !form.compte_destination_id) {
      toast.error('Sélectionnez les deux comptes'); return;
    }
    if (form.compte_source_id === form.compte_destination_id) {
      toast.error('Les comptes doivent être différents'); return;
    }
    if (!parseFloat(form.montant) || parseFloat(form.montant) <= 0) {
      toast.error('Montant invalide'); return;
    }
    setSaving(true);
    try {
      await api.post('/tresorerie/transfert', form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur transfert');
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title="Transfert entre comptes" onClose={onClose} width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Depuis le compte
          </label>
          <select value={form.compte_source_id} onChange={set('compte_source_id')} style={selectStyle} required>
            <option value="">— Sélectionner —</option>
            {comptes.map(c => (
              <option key={c.id} value={c.id}>
                {c.nom} · {fmt(c.solde_actuel)} {c.devise}
              </option>
            ))}
          </select>
        </div>
        <div style={{ textAlign: 'center', color: C.muted }}>
          <ArrowLeftRight size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Vers le compte
          </label>
          <select value={form.compte_destination_id} onChange={set('compte_destination_id')} style={selectStyle} required>
            <option value="">— Sélectionner —</option>
            {comptes.filter(c => c.id !== form.compte_source_id).map(c => (
              <option key={c.id} value={c.id}>{c.nom} · {c.devise}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Montant" type="number" value={form.montant} onChange={set('montant')} placeholder="100000" required />
          <Input label="Date" type="date" value={form.date_operation} onChange={set('date_operation')} />
        </div>
        <Input label="Libellé (optionnel)" value={form.libelle} onChange={set('libelle')} placeholder="Approvisionnement caisse" />
        <Input label="Référence (optionnelle)" value={form.reference} onChange={set('reference')} placeholder="Ref bancaire" />

        {(() => {
          const compteSource = comptes.find(c => c.id === form.compte_source_id);
          if (!compteSource) return null;
          return <AlerteSolde compte={compteSource} montant={form.montant} />;
        })()}

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          {(() => {
            const compteSource = comptes.find(c => c.id === form.compte_source_id);
            const bloque = compteSource ? evaluerSortie(compteSource, form.montant).bloquant : false;
            return (
              <button type="submit" disabled={saving || bloque} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
              }}>{saving ? 'Transfert...' : bloque ? 'Solde insuffisant' : 'Confirmer le transfert'}</button>
            );
          })()}
        </div>
      </form>
    </Modal>
  );
}

// ─── Vue détail d'un compte ────────────────────────────────────────────────
function DetailCompte({ compte: compteInit, onBack, C, dark }) {
  const cfg = TYPE_CONFIG[compteInit.type];
  const Icon = cfg.icon;

  const [compte, setCompte] = useState(compteInit);
  const [mouvements, setMouvements] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [filtres, setFiltres] = useState({ sens: '', statut_rapprochement: '' });
  const [loading, setLoading] = useState(true);
  const [showMouvement, setShowMouvement] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReleves, setShowReleves] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: '20' });
      if (filtres.sens) params.set('sens', filtres.sens);
      if (filtres.statut_rapprochement) params.set('statut_rapprochement', filtres.statut_rapprochement);
      const [m, c] = await Promise.all([
        api.get(`/tresorerie/comptes/${compte.id}/mouvements?${params}`),
        api.get(`/tresorerie/comptes/${compte.id}`),
      ]);
      setMouvements(m.data.data);
      setPagination(m.data.pagination);
      setCompte(c.data.data);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [compte.id, page, filtres]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteMouvement = async (id) => {
    if (!confirm('Supprimer ce mouvement ?')) return;
    try {
      await api.delete(`/tresorerie/mouvements/${id}`);
      toast.success('Mouvement supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur suppression');
    }
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
        border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 18,
      }}>
        <ChevronLeft size={14} /> Retour
      </button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginBottom: 22, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={26} color={cfg.color} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>{compte.nom}</h1>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {cfg.label}{compte.operateur ? ` · ${compte.operateur}` : ''}
                {compte.numero_compte ? ` · ${compte.numero_compte}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowEdit(true)} style={btnSec(C)}>Modifier</button>
            {compte.type !== 'caisse' && (
              <>
                <button onClick={() => setShowReleves(true)} style={btnSec(C)}>
                  <FileSpreadsheet size={13} /> Relevés
                </button>
                <button onClick={() => setShowImport(true)} style={btnSec(C)}>
                  <Upload size={13} /> Importer
                </button>
              </>
            )}
            <button onClick={() => setShowMouvement(true)} style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Plus size={13} /> Mouvement
            </button>
          </div>
        </div>

        {/* Stats du compte */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
          {[
            { label: 'Solde actuel',    val: compte.solde_actuel, color: parseFloat(compte.solde_actuel) >= 0 ? cfg.color : C.red },
            { label: 'Total entrées',   val: compte.total_entrees, color: C.accent },
            { label: 'Total sorties',   val: compte.total_sorties, color: C.red },
            { label: 'Solde rapproché', val: compte.solde_rapproche, color: C.blue, sub: `${compte.nb_non_rapproches || 0} non rapproché(s)` },
          ].map((stat, i) => (
            <div key={i} style={{ padding: 14, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: stat.color, fontFamily: 'monospace', marginTop: 5 }}>
                {fmt(stat.val)}
              </div>
              {stat.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{stat.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { v: '',        l: 'Tous' },
          { v: 'entree',  l: 'Entrées' },
          { v: 'sortie',  l: 'Sorties' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => { setFiltres(f => ({ ...f, sens: v })); setPage(1); }} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtres.sens === v ? cfg.color : C.border}`,
            background: filtres.sens === v ? `${cfg.color}15` : 'transparent',
            color: filtres.sens === v ? cfg.color : C.muted, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
        <div style={{ width: 1, background: C.border, margin: '0 4px' }} />
        {[
          { v: '',               l: 'Tout statut' },
          { v: 'non_rapproche',  l: 'Non rapprochés' },
          { v: 'rapproche',      l: 'Rapprochés' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => { setFiltres(f => ({ ...f, statut_rapprochement: v })); setPage(1); }} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtres.statut_rapprochement === v ? C.accent : C.border}`,
            background: filtres.statut_rapprochement === v ? `${C.accent}15` : 'transparent',
            color: filtres.statut_rapprochement === v ? C.accent : C.muted,
          }}>{l}</button>
        ))}
      </div>

      {/* Tableau mouvements */}
      <div data-onboarding="liste-mouvements" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {['Date', 'Libellé', 'Référence', 'Source', 'Sens', 'Montant', 'Rapproché', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement...</td></tr>
            ) : mouvements.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucun mouvement</td></tr>
            ) : mouvements.map(m => (
              <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.sub }}>{formatDate(m.date_operation)}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: C.text, fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.libelle}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{m.reference || '—'}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: C.hover, color: C.muted }}>
                    {{ paiement_facture: 'Facture', depense: 'Dépense', manuel: 'Manuel', transfert: 'Transfert', releve: 'Relevé' }[m.source_type] || m.source_type}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {m.sens === 'entree'
                    ? <ArrowDownCircle size={14} color={C.accent} />
                    : <ArrowUpCircle size={14} color={C.red} />}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                            color: m.sens === 'entree' ? C.accent : C.red }}>
                  {m.sens === 'entree' ? '+' : '−'}{fmt(m.montant)}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {m.statut_rapprochement === 'rapproche'
                    ? <CheckCircle size={14} color={C.accent} />
                    : <span style={{ fontSize: 10, color: C.muted }}>—</span>}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {(m.source_type === 'manuel' || m.source_type === 'transfert')
                    && m.statut_rapprochement !== 'rapproche' && (
                    <button onClick={() => handleDeleteMouvement(m.id)} style={{
                      padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`,
                      borderRadius: 7, cursor: 'pointer', color: C.muted,
                    }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.muted }}>Page {page} sur {pagination.pages} · {pagination.total} mouvements</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[...Array(Math.min(pagination.pages, 6))].map((_, i) => (
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

      {showMouvement && (
        <MouvementFormModal compte={compte} onClose={() => setShowMouvement(false)}
          onSaved={() => { setShowMouvement(false); fetchData(); toast.success('Mouvement enregistré'); }}
          C={C} dark={dark} />
      )}
      {showImport && (
        <ImportReleveModal compte={compte} onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); setShowReleves(true); fetchData(); }}
          C={C} dark={dark} />
      )}
      {showReleves && (
        <RelevesModal compte={compte} onClose={() => { setShowReleves(false); fetchData(); }} C={C} dark={dark} />
      )}
      {showEdit && (
        <CompteFormModal compte={compte} onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchData(); toast.success('Compte mis à jour'); }}
          C={C} dark={dark} />
      )}

      <Onboarding pageKey="tresorerie-detail" />
    </div>
  );
}

const btnSec = (C) => ({
  padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${C.border}`,
  background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
});

// ─── Modal saisie mouvement manuel ─────────────────────────────────────────
function MouvementFormModal({ compte, onClose, onSaved, C, dark }) {
  const [form, setForm] = useState({
    sens: 'entree', montant: '', libelle: '', reference: '',
    date_operation: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.libelle.trim()) { toast.error('Libellé requis'); return; }
    if (!parseFloat(form.montant) || parseFloat(form.montant) <= 0) { toast.error('Montant invalide'); return; }
    setSaving(true);
    try {
      await api.post(`/tresorerie/comptes/${compte.id}/mouvements`, form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur enregistrement');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Mouvement · ${compte.nom}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'entree', l: 'Encaissement (+)', icon: ArrowDownCircle, color: C.accent },
            { v: 'sortie', l: 'Décaissement (−)', icon: ArrowUpCircle, color: C.red },
          ].map(({ v, l, icon: Icon, color }) => (
            <button key={v} type="button" onClick={() => setForm(f => ({ ...f, sens: v }))} style={{
              flex: 1, padding: '11px 0', borderRadius: 9,
              border: `1.5px solid ${form.sens === v ? color : C.border}`,
              background: form.sens === v ? `${color}15` : 'transparent',
              color: form.sens === v ? color : C.muted,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon size={14} /> {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label="Montant" type="number" value={form.montant} onChange={set('montant')} placeholder="0" required />
          <Input label="Date" type="date" value={form.date_operation} onChange={set('date_operation')} />
        </div>
        <Input label="Libellé" value={form.libelle} onChange={set('libelle')} placeholder="Description du mouvement" required />
        <Input label="Référence (optionnelle)" value={form.reference} onChange={set('reference')} placeholder="N° transaction" />

        {form.sens === 'sortie' && <AlerteSolde compte={compte} montant={form.montant} />}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          {(() => {
            const bloque = form.sens === 'sortie' && evaluerSortie(compte, form.montant).bloquant;
            return (
              <button type="submit" disabled={saving || bloque} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
              }}>{saving ? '...' : bloque ? 'Solde insuffisant' : 'Enregistrer'}</button>
            );
          })()}
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal import de relevé ────────────────────────────────────────────────
function ImportReleveModal({ compte, onClose, onSaved, C, dark }) {
  const [contenu, setContenu] = useState('');
  const [fichierNom, setFichierNom] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFichierNom(file.name);
    const reader = new FileReader();
    reader.onload = () => setContenu(reader.result || '');
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!contenu.trim()) { toast.error('Sélectionnez un fichier CSV'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/tresorerie/comptes/${compte.id}/releves`, {
        contenu_csv: contenu, fichier_nom: fichierNom || 'releve.csv',
      });
      toast.success(`${res.data.data.nb_lignes} ligne(s) importée(s)`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur import');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Importer un relevé · ${compte.nom}`} onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10,
          padding: '14px 16px', border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Format attendu
          </div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            Fichier <strong>CSV</strong> (séparateur point-virgule, virgule ou tabulation).<br />
            En-têtes reconnues : <strong>Date</strong>, <strong>Libellé</strong>, <strong>Débit</strong>, <strong>Crédit</strong>
            ou <strong>Montant</strong> (+ <em>Référence</em>, <em>Date valeur</em> optionnels).<br />
            Dates acceptées : JJ/MM/AAAA ou AAAA-MM-JJ.
          </div>
        </div>

        <label style={{
          display: 'block', padding: '40px 20px', borderRadius: 12,
          border: `2px dashed ${C.border}`, textAlign: 'center', cursor: 'pointer',
          background: dark ? '#0D1220' : '#F8FAFC',
        }}>
          <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile}
            style={{ display: 'none' }} />
          <Upload size={26} color={C.accent} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {fichierNom || 'Cliquez pour choisir un fichier CSV'}
          </div>
          {fichierNom && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Cliquez pour changer · {Math.round(contenu.length / 1024)} Ko
            </div>
          )}
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Annuler</button>
          <button type="button" onClick={handleImport} disabled={loading || !contenu} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: (loading || !contenu) ? C.border : C.accent,
            color: (loading || !contenu) ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: (loading || !contenu) ? 'not-allowed' : 'pointer',
          }}>{loading ? 'Import en cours...' : 'Importer le relevé'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal liste des relevés + rapprochement ───────────────────────────────
function RelevesModal({ compte, onClose, C, dark }) {
  const [releves, setReleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releveActif, setReleveActif] = useState(null);

  const fetchReleves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tresorerie/comptes/${compte.id}/releves`);
      setReleves(res.data.data);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [compte.id]);

  useEffect(() => { fetchReleves(); }, [fetchReleves]);

  const handleDeleteReleve = async (id) => {
    if (!confirm('Supprimer ce relevé ? Les rapprochements seront annulés.')) return;
    try {
      await api.delete(`/tresorerie/releves/${id}`);
      toast.success('Relevé supprimé');
      fetchReleves();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  if (releveActif) {
    return (
      <RapprochementModal releveId={releveActif}
        onClose={() => { setReleveActif(null); fetchReleves(); }}
        onFini={() => { setReleveActif(null); fetchReleves(); }}
        C={C} dark={dark} />
    );
  }

  return (
    <Modal title={`Relevés bancaires · ${compte.nom}`} onClose={onClose} width={680}>
      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>Chargement...</div>
      ) : releves.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Aucun relevé importé pour ce compte.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {releves.map(r => {
            const matches = parseInt(r.nb_matches) || 0;
            const total = parseInt(r.nb_total) || 0;
            const pct = total > 0 ? Math.round((matches / total) * 100) : 0;
            return (
              <div key={r.id} style={{
                background: dark ? '#0D1220' : C.cardAlt, border: `1px solid ${C.border}`,
                borderRadius: 11, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {r.fichier_nom}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {formatDate(r.date_debut)} → {formatDate(r.date_fin)} · {total} lignes
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.accent : C.gold, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {matches} / {total} rapprochées ({pct}%)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setReleveActif(r.id)} style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Eye size={12} /> Rapprocher
                  </button>
                  <button onClick={() => handleDeleteReleve(r.id)} style={{
                    padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.muted, cursor: 'pointer',
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Modal rapprochement d'un relevé (2 colonnes) ─────────────────────────
function RapprochementModal({ releveId, onClose, onFini, C, dark }) {
  const [data, setData] = useState({ releve: null, lignes: [], candidats: [] });
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [selectedLigne, setSelectedLigne] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tresorerie/releves/${releveId}`);
      setData(res.data.data);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  }, [releveId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAutoMatch = async () => {
    setMatching(true);
    try {
      const res = await api.post(`/tresorerie/releves/${releveId}/auto-match`);
      toast.success(`${res.data.data.nb_matches} ligne(s) rapprochée(s) automatiquement`);
      fetchData();
    } catch { toast.error('Erreur matching auto'); }
    finally { setMatching(false); }
  };

  const handleRapprocher = async (ligneId, mouvementId) => {
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/rapprocher`, { mouvement_id: mouvementId });
      setSelectedLigne(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDelier = async (ligneId) => {
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/delier`);
      fetchData();
    } catch { toast.error('Erreur'); }
  };

  const handleCreerMouvement = async (ligneId) => {
    if (!confirm('Créer un nouveau mouvement de trésorerie à partir de cette ligne ?')) return;
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/creer-mouvement`);
      toast.success('Mouvement créé et rapproché');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  if (loading || !data.releve) {
    return (
      <Modal title="Rapprochement" onClose={onClose} width={900}>
        <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>Chargement...</div>
      </Modal>
    );
  }

  const lignesNonMatchees = data.lignes.filter(l => l.statut_matching === 'non_matche');
  const lignesMatchees = data.lignes.filter(l => l.statut_matching === 'matche');

  // Candidats pour la ligne sélectionnée (montant identique en priorité)
  const ligneSel = data.lignes.find(l => l.id === selectedLigne);
  const candidatsTries = ligneSel
    ? [...data.candidats].sort((a, b) => {
        const sa = a.sens === ligneSel.sens && Math.abs(parseFloat(a.montant) - parseFloat(ligneSel.montant)) < 0.01 ? 0 : 1;
        const sb = b.sens === ligneSel.sens && Math.abs(parseFloat(b.montant) - parseFloat(ligneSel.montant)) < 0.01 ? 0 : 1;
        return sa - sb;
      })
    : [];

  return (
    <Modal title={`Rapprochement · ${data.releve.fichier_nom}`} onClose={onClose} width={1000}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          {data.lignes.length} lignes · <strong style={{ color: C.accent }}>{lignesMatchees.length} rapprochées</strong> · {lignesNonMatchees.length} en attente
        </div>
        <button onClick={handleAutoMatch} disabled={matching || lignesNonMatchees.length === 0} style={{
          padding: '9px 16px', borderRadius: 9, border: 'none',
          background: (matching || lignesNonMatchees.length === 0) ? C.border : C.accent,
          color: (matching || lignesNonMatchees.length === 0) ? C.muted : (dark ? '#000' : '#fff'),
          fontSize: 12, fontWeight: 700,
          cursor: (matching || lignesNonMatchees.length === 0) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Link2 size={13} /> {matching ? 'Matching...' : 'Matching automatique'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxHeight: '60vh' }}>
        {/* COLONNE GAUCHE : lignes du relevé */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11, padding: 14, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Lignes du relevé bancaire
          </div>
          {data.lignes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>Aucune ligne</div>
          ) : data.lignes.map(l => (
            <div key={l.id} onClick={() => l.statut_matching === 'non_matche' && setSelectedLigne(l.id)} style={{
              background: C.card, border: `1.5px solid ${selectedLigne === l.id ? C.accent : (l.statut_matching === 'matche' ? C.accent + '50' : C.border)}`,
              borderRadius: 9, padding: '10px 12px', marginBottom: 8,
              cursor: l.statut_matching === 'non_matche' ? 'pointer' : 'default',
              opacity: l.statut_matching === 'matche' ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.muted }}>{formatDate(l.date_operation)}</span>
                {l.statut_matching === 'matche' && <CheckCircle size={12} color={C.accent} />}
              </div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.libelle}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                            color: l.sens === 'entree' ? C.accent : C.red }}>
                  {l.sens === 'entree' ? '+' : '−'}{fmt(l.montant)}
                </span>
                {l.statut_matching === 'matche' ? (
                  <button onClick={(e) => { e.stopPropagation(); handleDelier(l.id); }} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}><Unlink size={10} /> Délier</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleCreerMouvement(l.id); }} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
                  }}>+ Créer</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* COLONNE DROITE : mouvements de l'app */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11, padding: 14, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {ligneSel ? `Candidats pour ${fmt(ligneSel.montant)}` : 'Sélectionnez une ligne'}
          </div>
          {!ligneSel ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              ← Cliquez sur une ligne non rapprochée à gauche
            </div>
          ) : candidatsTries.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              Aucun mouvement candidat dans la période
            </div>
          ) : candidatsTries.map(c => {
            const match = c.sens === ligneSel.sens && Math.abs(parseFloat(c.montant) - parseFloat(ligneSel.montant)) < 0.01;
            return (
              <div key={c.id} onClick={() => handleRapprocher(selectedLigne, c.id)} style={{
                background: C.card, border: `1.5px solid ${match ? C.accent : C.border}`,
                borderRadius: 9, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{formatDate(c.date_operation)}</span>
                  {match && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 12, background: `${C.accent}25`, color: C.accent }}>EXACT</span>}
                </div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 4 }}>{c.libelle}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                            color: c.sens === 'entree' ? C.accent : C.red }}>
                  {c.sens === 'entree' ? '+' : '−'}{fmt(c.montant)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
