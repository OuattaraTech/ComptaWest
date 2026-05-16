import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  banque:       { labelKey: 'tresorerie.type_banque',       icon: Banknote,   color: '#4E8BF5' },
  mobile_money: { labelKey: 'tresorerie.type_mobile_money', icon: Smartphone, color: '#A855F7' },
  caisse:       { labelKey: 'tresorerie.type_caisse',       icon: Wallet,     color: '#F5A623' },
};

const fmt = (n) => formatFCFA(n, false);

export default function TresoreriePage() {
  const { t } = useTranslation();
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
    } catch { toast.error(t('tresorerie.load_accounts_error')); }
    finally { setLoading(false); }
  }, [t]);

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
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('tresorerie.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {t('tresorerie.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-onboarding="btn-transfert" onClick={() => setShowTransfert(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
            border: `1.5px solid ${C.border}`, background: 'transparent',
            color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <ArrowLeftRight size={14} /> {t('tresorerie.transfer_btn')}
          </button>
          <button data-onboarding="btn-nouveau" onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
            border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={15} /> {t('tresorerie.new_account')}
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
            {t('tresorerie.total_balance')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: 'monospace' }}>
            {fmt(totalGlobal)} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{t('common.currency')}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t('tresorerie.accounts_active', { count: comptes.length })}</div>
        </div>
        {['banque', 'mobile_money', 'caisse'].map(type => {
          const cfg = TYPE_CONFIG[type];
          const tot = totauxParType[type] || { total: 0, nb: 0 };
          const Icon = cfg.icon;
          return (
            <div key={type} style={{
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
                  {t(cfg.labelKey)}
                </span>
                <Icon size={15} color={cfg.color} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
                {fmt(tot.total)}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t('tresorerie.accounts_count', { count: tot.nb })}</div>
            </div>
          );
        })}
      </div>

      {/* Liste comptes par type */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>{t('tresorerie.loading')}</div>
      ) : comptes.length === 0 ? (
        <div style={{
          background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: 16,
          padding: '60px 20px', textAlign: 'center',
        }}>
          <Wallet size={36} color={C.muted} style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {t('tresorerie.empty_title')}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            {t('tresorerie.empty_desc')}
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '10px 22px', borderRadius: 10, border: 'none',
            background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{t('tresorerie.empty_btn')}</button>
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
                    {t(cfg.labelKey)}
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
          onSaved={() => { setShowCreate(false); fetchComptes(); toast.success(t('tresorerie.toast_created')); }}
          C={C} dark={dark}
        />
      )}
      {showTransfert && (
        <TransfertModal
          comptes={comptes}
          onClose={() => setShowTransfert(false)}
          onSaved={() => { setShowTransfert(false); fetchComptes(); toast.success(t('tresorerie.transfer_success')); }}
          C={C} dark={dark}
        />
      )}

      <Onboarding pageKey="tresorerie" />
    </div>
  );
}

// ─── Carte compte ──────────────────────────────────────────────────────────
function CompteCard({ compte, onClick, C, dark }) {
  const { t } = useTranslation();
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
        }}>{t('tresorerie.default_badge')}</div>
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
            {compte.operateur || t(cfg.labelKey)}{compte.numero_compte ? ` · ${compte.numero_compte.slice(-4).padStart(8, '*')}` : ''}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: solde >= 0 ? C.text : C.red, fontFamily: 'monospace' }}>
        {fmt(solde)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{compte.devise || t('common.currency')}</span>
      </div>
      {nbAlertes > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.gold }}>
          <AlertCircle size={12} /> {t('tresorerie.unmatched_movements', { count: nbAlertes })}
        </div>
      )}
    </div>
  );
}

// ─── Modal création / édition de compte ────────────────────────────────────
function CompteFormModal({ onClose, onSaved, C, dark, compte: editing }) {
  const { t, i18n } = useTranslation();
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
    if (!form.nom.trim()) { toast.error(t('tresorerie.err_name_required')); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/tresorerie/comptes/${editing.id}`, form);
      } else {
        await api.post('/tresorerie/comptes', form);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('tresorerie.err_save'));
    } finally { setSaving(false); }
  };

  const operateursDisponibles = operateurs[form.type] || [];
  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  const typeLabel = (type) => t(TYPE_CONFIG[type].labelKey).toLowerCase();
  const numberLocale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';

  return (
    <Modal title={editing ? t('tresorerie.form_title_edit') : t('tresorerie.form_title_new')} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Type */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('tresorerie.form_account_type')}
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {['banque', 'mobile_money', 'caisse'].map(type => {
              const cfg = TYPE_CONFIG[type];
              const Icon = cfg.icon;
              const active = form.type === type;
              return (
                <button key={type} type="button"
                  onClick={() => setForm(f => ({ ...f, type, operateur: '' }))}
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
                  <Icon size={13} /> {t(cfg.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <Input label={t('tresorerie.form_account_name')} value={form.nom} onChange={set('nom')}
          placeholder={form.type === 'mobile_money' ? t('tresorerie.form_account_name_placeholder_mm') : t('tresorerie.form_account_name_placeholder_bk')} required />

        {/* Opérateur */}
        {operateursDisponibles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {form.type === 'banque' ? t('tresorerie.form_bank') : form.type === 'mobile_money' ? t('tresorerie.form_operator') : t('tresorerie.form_location')}
            </label>
            <select value={form.operateur || ''} onChange={set('operateur')} style={selectStyle}>
              <option value="">{t('tresorerie.form_select')}</option>
              {operateursDisponibles.map(op => (
                <option key={op.code} value={op.code}>{op.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={form.type === 'mobile_money' ? t('tresorerie.form_number_mm') : t('tresorerie.form_number_bank')}
            value={form.numero_compte || ''} onChange={set('numero_compte')}
            placeholder={form.type === 'mobile_money' ? t('tresorerie.form_number_mm_placeholder') : t('tresorerie.form_number_bank_placeholder')} />
          <Input label={t('tresorerie.form_holder')} value={form.titulaire || ''} onChange={set('titulaire')} placeholder={t('tresorerie.form_holder_placeholder')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('tresorerie.form_initial_balance')} type="number" value={form.solde_initial}
            onChange={set('solde_initial')} placeholder="0" />
          <Input label={t('tresorerie.form_currency')} value={form.devise || 'XOF'} onChange={set('devise')} placeholder="XOF" />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '8px 0' }}>
          <input type="checkbox" checked={!!form.par_defaut}
            onChange={e => setForm(f => ({ ...f, par_defaut: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: C.accent }} />
          <span style={{ fontSize: 12, color: C.sub }}>
            {t('tresorerie.form_set_default', { type: typeLabel(form.type) })}
          </span>
        </label>

        {/* Découvert : pertinent surtout pour les banques */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}` }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.decouvert_autorise}
              onChange={e => setForm(f => ({ ...f, decouvert_autorise: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: C.accent }} />
            <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>
              {t('tresorerie.form_overdraft_authorize')}
              {form.type !== 'banque' && <span style={{ color: C.gold }}> {t('tresorerie.form_overdraft_notrecommended', { type: typeLabel(form.type) })}</span>}
            </span>
          </label>
          {form.decouvert_autorise && (
            <div style={{ marginTop: 10 }}>
              <Input label={t('tresorerie.form_overdraft_max')} type="number"
                value={form.decouvert_max} onChange={set('decouvert_max')} placeholder="0" />
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                {t('tresorerie.form_overdraft_info', {
                  amount: new Intl.NumberFormat(numberLocale).format(parseFloat(form.decouvert_max) || 0),
                  currency: form.devise || t('common.currency'),
                })}
              </div>
            </div>
          )}
          {!form.decouvert_autorise && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>
              {t('tresorerie.form_no_overdraft_info')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? t('common.saving') : editing ? t('tresorerie.form_update') : t('tresorerie.form_create')}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal transfert inter-comptes ─────────────────────────────────────────
function TransfertModal({ comptes, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
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
      toast.error(t('tresorerie.err_select_two_accounts')); return;
    }
    if (form.compte_source_id === form.compte_destination_id) {
      toast.error(t('tresorerie.err_same_accounts')); return;
    }
    if (!parseFloat(form.montant) || parseFloat(form.montant) <= 0) {
      toast.error(t('tresorerie.err_invalid_amount')); return;
    }
    setSaving(true);
    try {
      await api.post('/tresorerie/transfert', form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('tresorerie.err_transfer'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <Modal title={t('tresorerie.transfer_title')} onClose={onClose} width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('tresorerie.transfer_from')}
          </label>
          <select value={form.compte_source_id} onChange={set('compte_source_id')} style={selectStyle} required>
            <option value="">{t('tresorerie.form_select')}</option>
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
            {t('tresorerie.transfer_to')}
          </label>
          <select value={form.compte_destination_id} onChange={set('compte_destination_id')} style={selectStyle} required>
            <option value="">{t('tresorerie.form_select')}</option>
            {comptes.filter(c => c.id !== form.compte_source_id).map(c => (
              <option key={c.id} value={c.id}>{c.nom} · {c.devise}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('common.amount')} type="number" value={form.montant} onChange={set('montant')} placeholder="100000" required />
          <Input label={t('common.date')} type="date" value={form.date_operation} onChange={set('date_operation')} />
        </div>
        <Input label={t('tresorerie.transfer_label_optional')} value={form.libelle} onChange={set('libelle')} placeholder={t('tresorerie.transfer_label_placeholder')} />
        <Input label={t('tresorerie.transfer_ref_optional')} value={form.reference} onChange={set('reference')} placeholder={t('tresorerie.transfer_ref_placeholder')} />

        {(() => {
          const compteSource = comptes.find(c => c.id === form.compte_source_id);
          if (!compteSource) return null;
          return <AlerteSolde compte={compteSource} montant={form.montant} />;
        })()}

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          {(() => {
            const compteSource = comptes.find(c => c.id === form.compte_source_id);
            const bloque = compteSource ? evaluerSortie(compteSource, form.montant).bloquant : false;
            return (
              <button type="submit" disabled={saving || bloque} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
              }}>{saving ? t('tresorerie.transfer_progress') : bloque ? t('tresorerie.transfer_balance_low') : t('tresorerie.transfer_confirm')}</button>
            );
          })()}
        </div>
      </form>
    </Modal>
  );
}

// ─── Vue détail d'un compte ────────────────────────────────────────────────
function DetailCompte({ compte: compteInit, onBack, C, dark }) {
  const { t } = useTranslation();
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
    } catch { toast.error(t('tresorerie.load_error')); }
    finally { setLoading(false); }
  }, [compte.id, page, filtres, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteMouvement = async (id) => {
    if (!confirm(t('tresorerie.confirm_delete_movement'))) return;
    try {
      await api.delete(`/tresorerie/mouvements/${id}`);
      toast.success(t('tresorerie.movement_deleted'));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('tresorerie.err_delete'));
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
        <ChevronLeft size={14} /> {t('common.back')}
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
                {t(cfg.labelKey)}{compte.operateur ? ` · ${compte.operateur}` : ''}
                {compte.numero_compte ? ` · ${compte.numero_compte}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowEdit(true)} style={btnSec(C)}>{t('tresorerie.btn_edit')}</button>
            {compte.type !== 'caisse' && (
              <>
                <button onClick={() => setShowReleves(true)} style={btnSec(C)}>
                  <FileSpreadsheet size={13} /> {t('tresorerie.btn_statements')}
                </button>
                <button onClick={() => setShowImport(true)} style={btnSec(C)}>
                  <Upload size={13} /> {t('tresorerie.btn_import')}
                </button>
              </>
            )}
            <button onClick={() => setShowMouvement(true)} style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Plus size={13} /> {t('tresorerie.btn_movement')}
            </button>
          </div>
        </div>

        {/* Stats du compte */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
          {[
            { label: t('tresorerie.stat_current_balance'),    val: compte.solde_actuel, color: parseFloat(compte.solde_actuel) >= 0 ? cfg.color : C.red },
            { label: t('tresorerie.stat_total_in'),   val: compte.total_entrees, color: C.accent },
            { label: t('tresorerie.stat_total_out'),   val: compte.total_sorties, color: C.red },
            { label: t('tresorerie.stat_reconciled_balance'), val: compte.solde_rapproche, color: C.blue, sub: t('tresorerie.stat_unmatched', { count: compte.nb_non_rapproches || 0 }) },
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
          { v: '',        l: t('tresorerie.filter_all') },
          { v: 'entree',  l: t('tresorerie.filter_in') },
          { v: 'sortie',  l: t('tresorerie.filter_out') },
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
          { v: '',               l: t('tresorerie.filter_all_status') },
          { v: 'non_rapproche',  l: t('tresorerie.filter_unmatched') },
          { v: 'rapproche',      l: t('tresorerie.filter_matched') },
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
              {[t('tresorerie.th_date'), t('tresorerie.th_label'), t('tresorerie.th_reference'), t('tresorerie.th_source'), t('tresorerie.th_direction'), t('tresorerie.th_amount'), t('tresorerie.th_reconciled'), ''].map((h, idx) => (
                <th key={idx} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('tresorerie.loading')}</td></tr>
            ) : mouvements.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('tresorerie.no_movements')}</td></tr>
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
                    {{ paiement_facture: t('tresorerie.source_facture'), depense: t('tresorerie.source_depense'), manuel: t('tresorerie.source_manuel'), transfert: t('tresorerie.source_transfert'), releve: t('tresorerie.source_releve') }[m.source_type] || m.source_type}
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
            <span style={{ fontSize: 11, color: C.muted }}>{t('tresorerie.pagination_info', { page, pages: pagination.pages, total: pagination.total })}</span>
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
          onSaved={() => { setShowMouvement(false); fetchData(); toast.success(t('tresorerie.movement_saved')); }}
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
          onSaved={() => { setShowEdit(false); fetchData(); toast.success(t('tresorerie.toast_updated')); }}
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
  const { t } = useTranslation();
  const [form, setForm] = useState({
    sens: 'entree', montant: '', libelle: '', reference: '',
    date_operation: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.libelle.trim()) { toast.error(t('tresorerie.err_label_required')); return; }
    if (!parseFloat(form.montant) || parseFloat(form.montant) <= 0) { toast.error(t('tresorerie.err_invalid_amount')); return; }
    setSaving(true);
    try {
      await api.post(`/tresorerie/comptes/${compte.id}/mouvements`, form);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('tresorerie.err_save'));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={t('tresorerie.movement_title', { name: compte.nom })} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'entree', l: t('tresorerie.movement_in'), icon: ArrowDownCircle, color: C.accent },
            { v: 'sortie', l: t('tresorerie.movement_out'), icon: ArrowUpCircle, color: C.red },
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
          <Input label={t('common.amount')} type="number" value={form.montant} onChange={set('montant')} placeholder="0" required />
          <Input label={t('common.date')} type="date" value={form.date_operation} onChange={set('date_operation')} />
        </div>
        <Input label={t('tresorerie.th_label')} value={form.libelle} onChange={set('libelle')} placeholder={t('tresorerie.movement_label_placeholder')} required />
        <Input label={t('tresorerie.transfer_ref_optional')} value={form.reference} onChange={set('reference')} placeholder={t('tresorerie.movement_ref_placeholder')} />

        {form.sens === 'sortie' && <AlerteSolde compte={compte} montant={form.montant} />}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          {(() => {
            const bloque = form.sens === 'sortie' && evaluerSortie(compte, form.montant).bloquant;
            return (
              <button type="submit" disabled={saving || bloque} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
              }}>{saving ? '...' : bloque ? t('tresorerie.transfer_balance_low') : t('tresorerie.movement_save')}</button>
            );
          })()}
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal import de relevé ────────────────────────────────────────────────
function ImportReleveModal({ compte, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
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
    if (!contenu.trim()) { toast.error(t('tresorerie.err_no_file')); return; }
    setLoading(true);
    try {
      const res = await api.post(`/tresorerie/comptes/${compte.id}/releves`, {
        contenu_csv: contenu, fichier_nom: fichierNom || 'releve.csv',
      });
      toast.success(t('tresorerie.import_success', { count: res.data.data.nb_lignes }));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('tresorerie.err_import'));
    } finally { setLoading(false); }
  };

  return (
    <Modal title={t('tresorerie.import_title', { name: compte.nom })} onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10,
          padding: '14px 16px', border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('tresorerie.import_format_label')}
          </div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            <span dangerouslySetInnerHTML={{ __html: t('tresorerie.import_format_csv') }} /><br />
            <span dangerouslySetInnerHTML={{ __html: t('tresorerie.import_format_headers') }} /><br />
            {t('tresorerie.import_format_dates')}
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
            {fichierNom || t('tresorerie.import_choose_file')}
          </div>
          {fichierNom && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              {t('tresorerie.import_change_file', { kb: Math.round(contenu.length / 1024) })}
            </div>
          )}
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button type="button" onClick={handleImport} disabled={loading || !contenu} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: (loading || !contenu) ? C.border : C.accent,
            color: (loading || !contenu) ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: (loading || !contenu) ? 'not-allowed' : 'pointer',
          }}>{loading ? t('tresorerie.import_progress') : t('tresorerie.import_submit')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal liste des relevés + rapprochement ───────────────────────────────
function RelevesModal({ compte, onClose, C, dark }) {
  const { t } = useTranslation();
  const [releves, setReleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releveActif, setReleveActif] = useState(null);

  const fetchReleves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tresorerie/comptes/${compte.id}/releves`);
      setReleves(res.data.data);
    } catch { toast.error(t('tresorerie.load_error')); }
    finally { setLoading(false); }
  }, [compte.id, t]);

  useEffect(() => { fetchReleves(); }, [fetchReleves]);

  const handleDeleteReleve = async (id) => {
    if (!confirm(t('tresorerie.statements_confirm_delete'))) return;
    try {
      await api.delete(`/tresorerie/releves/${id}`);
      toast.success(t('tresorerie.statements_deleted'));
      fetchReleves();
    } catch (err) { toast.error(err.response?.data?.message || t('tresorerie.err_generic')); }
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
    <Modal title={t('tresorerie.statements_title', { name: compte.nom })} onClose={onClose} width={680}>
      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>{t('tresorerie.loading')}</div>
      ) : releves.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          {t('tresorerie.statements_empty')}
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
                    {t('tresorerie.statements_period', { from: formatDate(r.date_debut), to: formatDate(r.date_fin), count: total })}
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.accent : C.gold, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {t('tresorerie.statements_match_progress', { matches, total, pct })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setReleveActif(r.id)} style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Eye size={12} /> {t('tresorerie.statements_reconcile')}
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
  const { t } = useTranslation();
  const [data, setData] = useState({ releve: null, lignes: [], candidats: [] });
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [selectedLigne, setSelectedLigne] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tresorerie/releves/${releveId}`);
      setData(res.data.data);
    } catch { toast.error(t('tresorerie.err_generic')); }
    finally { setLoading(false); }
  }, [releveId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAutoMatch = async () => {
    setMatching(true);
    try {
      const res = await api.post(`/tresorerie/releves/${releveId}/auto-match`);
      toast.success(t('tresorerie.reconcile_auto_success', { count: res.data.data.nb_matches }));
      fetchData();
    } catch { toast.error(t('tresorerie.err_auto_match')); }
    finally { setMatching(false); }
  };

  const handleRapprocher = async (ligneId, mouvementId) => {
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/rapprocher`, { mouvement_id: mouvementId });
      setSelectedLigne(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('tresorerie.err_generic')); }
  };

  const handleDelier = async (ligneId) => {
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/delier`);
      fetchData();
    } catch { toast.error(t('tresorerie.err_generic')); }
  };

  const handleCreerMouvement = async (ligneId) => {
    if (!confirm(t('tresorerie.reconcile_confirm_create'))) return;
    try {
      await api.post(`/tresorerie/lignes-releve/${ligneId}/creer-mouvement`);
      toast.success(t('tresorerie.reconcile_movement_created'));
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('tresorerie.err_generic')); }
  };

  if (loading || !data.releve) {
    return (
      <Modal title={t('tresorerie.reconcile_title')} onClose={onClose} width={900}>
        <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>{t('tresorerie.loading')}</div>
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
    <Modal title={t('tresorerie.reconcile_title_named', { name: data.releve.fichier_nom })} onClose={onClose} width={1000}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          {t('tresorerie.reconcile_summary', { total: data.lignes.length, matches: lignesMatchees.length, pending: lignesNonMatchees.length })}
        </div>
        <button onClick={handleAutoMatch} disabled={matching || lignesNonMatchees.length === 0} style={{
          padding: '9px 16px', borderRadius: 9, border: 'none',
          background: (matching || lignesNonMatchees.length === 0) ? C.border : C.accent,
          color: (matching || lignesNonMatchees.length === 0) ? C.muted : (dark ? '#000' : '#fff'),
          fontSize: 12, fontWeight: 700,
          cursor: (matching || lignesNonMatchees.length === 0) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Link2 size={13} /> {matching ? t('tresorerie.reconcile_matching_progress') : t('tresorerie.reconcile_auto_match')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxHeight: '60vh' }}>
        {/* COLONNE GAUCHE : lignes du relevé */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11, padding: 14, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('tresorerie.reconcile_left_title')}
          </div>
          {data.lignes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>{t('tresorerie.reconcile_empty_lines')}</div>
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
                  }}><Unlink size={10} /> {t('tresorerie.reconcile_unlink')}</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleCreerMouvement(l.id); }} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
                  }}>{t('tresorerie.reconcile_create')}</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* COLONNE DROITE : mouvements de l'app */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11, padding: 14, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {ligneSel ? t('tresorerie.reconcile_candidates_for', { amount: fmt(ligneSel.montant) }) : t('tresorerie.reconcile_select_line')}
          </div>
          {!ligneSel ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              {t('tresorerie.reconcile_click_left')}
            </div>
          ) : candidatsTries.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              {t('tresorerie.reconcile_no_candidates')}
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
                  {match && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 12, background: `${C.accent}25`, color: C.accent }}>{t('tresorerie.reconcile_exact')}</span>}
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
