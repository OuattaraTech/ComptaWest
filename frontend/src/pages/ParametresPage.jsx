import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import api from '../utils/api.jsx';
import { formatDate, initiales } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { Users, Building2, Plus, X, Edit2, Trash2, Shield, Save, Copy, Link2, Globe, Smartphone, CheckCircle, AlertCircle, Eye, EyeOff, RefreshCw, Activity, CreditCard, Sliders, RotateCcw, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC, Input } from '../components/UI.jsx';
import LogoFournisseur from '../components/LogoFournisseur.jsx';
import Onboarding from '../components/Onboarding.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

// ─── Référentiels ──────────────────────────────────────────────────────────
// Formes juridiques courantes en zone OHADA / Côte d'Ivoire
const FORMES = [
  'SARL', 'SARLU', 'SA', 'SAS', 'SUARL', 'SNC', 'SCS',
  'Entreprise individuelle', 'GIE', 'SCI', 'Coopérative', 'Association', 'Autre',
];
// Mapping FR → clé i18n pour les libellés non-acronymes (la value FR reste
// stockée en BDD ; seul l'affichage de l'<option> est traduit).
const FORME_LABELS = {
  'Entreprise individuelle': 'parametres.forme_entreprise_individuelle',
  'Coopérative':             'parametres.forme_cooperative',
  'Association':             'parametres.forme_association',
  'Autre':                   'parametres.forme_autre',
};

// Régimes fiscaux applicables en Côte d'Ivoire
const REGIMES = [
  'RSI',           // Réel Simplifié d'Imposition
  'RNI',           // Réel Normal d'Imposition
  'Microentreprise',
  'BIC',           // Bénéfices Industriels et Commerciaux
  'BNC',           // Bénéfices Non Commerciaux
  'Exonéré',
];
const REGIME_LABELS = {
  'Microentreprise': 'parametres.regime_microentreprise',
  'Exonéré':         'parametres.regime_exonere',
};

// Pays UEMOA / CEMAC les plus fréquents
const PAYS_LIST = [
  "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Bénin', 'Togo',
  'Niger', 'Guinée-Bissau', 'Cameroun', 'Gabon', 'Congo', 'Tchad', 'Autre',
];

// Rôles d'accès — alignés sur backend/src/utils/permissions.js (matrice
// module x action). Toute évolution doit se faire d'abord côté backend.
const ROLES = {
  proprietaire:     { labelKey: 'roles.proprietaire',     color: '#F5A623', descKey: 'parametres.role_proprietaire_desc' },
  admin:            { labelKey: 'roles.admin',            color: '#4E8BF5', descKey: 'parametres.role_admin_desc' },
  expert_comptable: { labelKey: 'roles.expert_comptable', color: '#0EA5E9', descKey: 'parametres.role_expert_comptable_desc' },
  comptable:        { labelKey: 'roles.comptable',        color: '#00D4AA', descKey: 'parametres.role_comptable_desc' },
  rh:               { labelKey: 'roles.rh',               color: '#A855F7', descKey: 'parametres.role_rh_desc' },
  commercial:       { labelKey: 'roles.commercial',       color: '#EC4899', descKey: 'parametres.role_commercial_desc' },
  magasinier:       { labelKey: 'roles.magasinier',       color: '#F97316', descKey: 'parametres.role_magasinier_desc' },
  auditeur:         { labelKey: 'roles.auditeur',         color: '#6B7A99', descKey: 'parametres.role_auditeur_desc' },
  // Rôles legacy conservés pour les comptes existants. À masquer du sélecteur
  // d'invitation pour ne pas inciter à les choisir sur de nouveaux membres.
  user:             { labelKey: 'roles.user',             color: '#9BAACC', descKey: 'parametres.role_user_desc', legacy: true },
  lecture:          { labelKey: 'roles.lecture',          color: '#6B7A99', descKey: 'parametres.role_lecture_desc', legacy: true },
};

function PreferencesTab({ C }) {
  const { t } = useTranslation();
  return (
    <div data-onboarding="form-preferences" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Globe size={18} color={C.accent} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('parametres.language_label')}</div>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          {t('parametres.language_help')}
        </div>
        <div style={{ maxWidth: 320 }}>
          <LanguageSwitcher variant="dropdown" C={C} />
        </div>
      </div>
    </div>
  );
}

// Métadonnées visuelles par fournisseur : couleurs et lettre du logo.
// Les libellés et descriptions viennent d'i18n (parametres.fournisseur_*).
// Le label backend pour le webhook_secret diffère :
//   - wave : « Webhook secret » (HMAC)
//   - orange_money : « Notif token » (renvoyé à la création de session)
//   - mtn_momo : « Subscription key » (clé du portail MoMo Developer)
const FOURNISSEURS_META = {
  wave:         { label: 'Wave',         letter: 'W', bg: 'linear-gradient(135deg, #1DC8F0, #0066FF)',
                  secretLabel: 'integration_webhook_secret',
                  dashboard: 'Wave Business' },
  orange_money: { label: 'Orange Money', letter: 'O', bg: 'linear-gradient(135deg, #FF6600, #CC3300)',
                  secretLabel: 'integration_notif_token',
                  dashboard: 'Orange Money Merchant' },
  mtn_momo:     { label: 'MTN MoMo',     letter: 'M', bg: 'linear-gradient(135deg, #FFCC00, #E6A800)',
                  secretLabel: 'integration_subscription_key',
                  dashboard: 'MTN MoMo Developer Portal' },
};

// ─── Onglet Intégrations : configuration des paiements externes ──────────
function IntegrationsTab({ C, dark }) {
  const { t } = useTranslation();
  const { actuelle } = useEntreprise();
  const [integrations, setIntegrations] = useState([]);
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOuvert, setFormOuvert] = useState(null); // fournisseur en cours d'édition
  const [abonnement, setAbonnement] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intRes, comptesRes, aboRes] = await Promise.all([
        api.get('/integrations-paiement'),
        api.get('/tresorerie/comptes'),
        api.get('/abonnement').catch(() => ({ data: { data: null } })),
      ]);
      setIntegrations(intRes.data.data || []);
      setComptes(comptesRes.data.data || []);
      setAbonnement(aboRes.data.data);
    } catch (err) {
      if (!err.handled) toast.error(t('common.loading_error'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const webhookUrl = (fournisseur) =>
    `${window.location.origin.replace(':5173', ':5000')}/api/webhooks/${fournisseur}/${actuelle?.id || ''}`;

  // Quota par palier : nombre d'opérateurs Mobile Money activables en
  // production simultanément. Calculé côté UI pour l'info visuelle ; le
  // backend revérifie de toute façon à l'upsert.
  // Note : l'API /abonnement renvoie { abonnement: { palier }, quotas: {...} } —
  // on lit donc dans `quotas.paiement_fournisseurs` (déjà résolu côté back)
  // plutôt que de redériver via une matrice JS.
  const palier = abonnement?.abonnement?.palier || 'decouverte';
  const maxOps = abonnement?.quotas?.paiement_fournisseurs ?? 0;
  const opsActifs = integrations.filter(i => i.mode === 'live' && i.actif).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 12,
        padding: '14px 16px', fontSize: 12, color: C.sub, lineHeight: 1.6,
      }}>
        {t('parametres.integrations_intro')}
      </div>

      {/* Bandeau quota — affiche la limite Mobile Money selon le palier */}
      <div style={{
        background: maxOps === 0
          ? `${C.gold}12`
          : opsActifs >= maxOps ? `${C.red}12` : `${C.accent}10`,
        border: `1px solid ${
          maxOps === 0 ? `${C.gold}40`
          : opsActifs >= maxOps ? `${C.red}40` : `${C.accent}40`
        }`,
        borderRadius: 12, padding: '14px 16px',
        fontSize: 12.5, color: C.sub, lineHeight: 1.55,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Shield size={16} color={maxOps === 0 ? C.gold : opsActifs >= maxOps ? C.red : C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>
            {t('parametres.integrations_quota_title', {
              palier: t(`tarifs.palier_${palier}`),
              actifs: opsActifs,
              max: maxOps,
            })}
          </div>
          <div>
            {maxOps === 0
              ? t('parametres.integrations_quota_locked')
              : t('parametres.integrations_quota_help', { max: maxOps })}
          </div>
        </div>
      </div>

      {Object.keys(FOURNISSEURS_META).map(f => (
        <CarteFournisseur key={f}
          fournisseur={f}
          integration={integrations.find(i => i.fournisseur === f)}
          comptes={comptes}
          loading={loading}
          webhookUrl={webhookUrl(f)}
          showForm={formOuvert === f}
          setShowForm={(o) => setFormOuvert(o ? f : null)}
          onSaved={fetchData}
          C={C} dark={dark}
        />
      ))}
    </div>
  );
}

function CarteFournisseur({ fournisseur, integration, comptes, loading, webhookUrl, showForm, setShowForm, onSaved, C, dark }) {
  const { t } = useTranslation();
  const meta = FOURNISSEURS_META[fournisseur];
  const [form, setForm] = useState({
    mode: 'mock', actif: true, api_key: '', webhook_secret: '', compte_tresorerie_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [showCle, setShowCle] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (integration) {
      setForm({
        mode: integration.mode || 'mock',
        actif: integration.actif ?? true,
        api_key: '',
        webhook_secret: '',
        compte_tresorerie_id: integration.compte_tresorerie_id || '',
      });
    }
  }, [integration]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/integrations-paiement/${fournisseur}`, form);
      toast.success(t('parametres.integration_saved'));
      setShowForm(false);
      onSaved();
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('parametres.toast_save_err'));
    } finally { setSaving(false); }
  };

  const copierWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
      .then(() => toast.success(t('parametres.webhook_url_copied')))
      .catch(() => toast.error(t('parametres.copy_failed')));
  };

  const isActive = integration?.actif && integration?.api_key_set;
  const isMockOnly = !integration?.api_key_set;
  const inputStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <LogoFournisseur fournisseur={fournisseur} size={44} radius={12} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{meta.label}</div>
            {isActive
              ? <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: `${C.accent}20`, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={11} /> {t('parametres.integration_status_active', { mode: integration.mode })}
                </span>
              : integration && isMockOnly
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: `${C.gold}20`, color: C.gold, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={11} /> {t('parametres.integration_status_demo')}
                  </span>
                : <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: C.hover, color: C.muted }}>
                    {t('parametres.integration_status_inactive')}
                  </span>}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
            {t(`parametres.${fournisseur}_desc`)}
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={{
            padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <Edit2 size={13} /> {integration ? t('common.edit') : t('parametres.integration_configure')}
          </button>
        )}
      </div>

      {!showForm && integration && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
          <InfoLine label={t('parametres.integration_mode')} value={t(`parametres.integration_mode_${integration.mode}`)} C={C} />
          <InfoLine label={t('parametres.integration_api_key')} value={integration.api_key_set ? integration.api_key_apercu : t('parametres.integration_not_set')} C={C} />
          <InfoLine label={t(`parametres.${meta.secretLabel}`)} value={integration.webhook_secret_set ? t('parametres.integration_configured') : t('parametres.integration_not_set')} C={C} />
          <InfoLine label={t('parametres.integration_destination')} value={integration.compte_nom || t('parametres.integration_default_account')} C={C} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['mock', 'sandbox', 'live'].map(m => (
              <button key={m} type="button"
                onClick={() => setForm(f => ({ ...f, mode: m }))}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9,
                  border: `1.5px solid ${form.mode === m ? C.accent : C.border}`,
                  background: form.mode === m ? `${C.accent}15` : 'transparent',
                  color: form.mode === m ? C.accent : C.muted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                {t(`parametres.integration_mode_${m}`)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: -8, fontStyle: 'italic' }}>
            {t(`parametres.integration_mode_${form.mode}_help`)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('parametres.integration_api_key')}
              {integration?.api_key_set && <span style={{ fontWeight: 400, textTransform: 'none', color: C.muted, marginLeft: 8 }}>· {integration.api_key_apercu}</span>}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showCle ? 'text' : 'password'}
                value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder={integration?.api_key_set ? t('parametres.integration_keep_value') : t(`parametres.${fournisseur}_api_key_placeholder`)}
                style={inputStyle} />
              <button type="button" onClick={() => setShowCle(s => !s)} style={{
                padding: '0 12px', borderRadius: 9, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, cursor: 'pointer',
              }}>{showCle ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t(`parametres.${meta.secretLabel}`)}
              {integration?.webhook_secret_set && <span style={{ fontWeight: 400, textTransform: 'none', color: C.muted, marginLeft: 8 }}>· {t('parametres.integration_configured')}</span>}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showSecret ? 'text' : 'password'}
                value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))}
                placeholder={integration?.webhook_secret_set ? t('parametres.integration_keep_value') : t(`parametres.${fournisseur}_secret_placeholder`)}
                style={inputStyle} />
              <button type="button" onClick={() => setShowSecret(s => !s)} style={{
                padding: '0 12px', borderRadius: 9, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, cursor: 'pointer',
              }}>{showSecret ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('parametres.integration_destination')}
            </label>
            <select value={form.compte_tresorerie_id || ''}
              onChange={e => setForm(f => ({ ...f, compte_tresorerie_id: e.target.value || null }))}
              style={inputStyle}>
              <option value="">{t('parametres.integration_default_account')}</option>
              {comptes.filter(c => c.type === 'mobile_money').map(c => (
                <option key={c.id} value={c.id}>{c.nom} (Mobile Money)</option>
              ))}
            </select>
            <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>
              {t('parametres.integration_destination_help')}
            </span>
          </div>

          <div style={{
            background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10,
            padding: '12px 14px', border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('parametres.integration_webhook_url', { dashboard: meta.dashboard })}
            </div>
            <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 8 }}>
              {t('parametres.integration_webhook_help', { dashboard: meta.dashboard, fournisseur: meta.label })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly value={webhookUrl} onFocus={e => e.target.select()}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
              <button type="button" onClick={copierWebhook} style={{
                padding: '0 14px', borderRadius: 9, border: 'none',
                background: C.accent, color: dark ? '#000' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}><Copy size={12} /> {t('parametres.btn_copy')}</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
              fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}>{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function InfoLine({ label, value, C }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginTop: 3, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

// ─── Onglet Fiscal : configuration FNE (DGI Côte d'Ivoire) ─────────────
// Permet d'enregistrer le NCC, le centre fiscal et les credentials API
// DGI. Aujourd'hui seul le mode mock est branché côté backend ; les
// champs sandbox / prod sont prêts pour le jour où l'API DGI sera ouverte.
// ─── Wizard FNE — checklist guidée de configuration ────────────────────
// La FNE (Facture Normalisée Électronique) impose plusieurs démarches
// administratives auprès de la DGI. Ce composant les liste comme une
// checklist visuelle dont les coches se valident automatiquement selon
// l'état du formulaire — l'utilisateur voit en un coup d'œil ce qu'il
// lui reste à faire pour basculer en production.
function WizardFne({ ncc, centreFiscal, cleConfigured, fneActif, modeProduction, statutPing, C, dark, t }) {
  const etapes = [
    {
      id: 'ncc',
      titre: t('parametres.fne_wiz_step1_titre'),
      desc:  t('parametres.fne_wiz_step1_desc'),
      done:  Boolean(ncc && ncc.trim()),
    },
    {
      id: 'centre',
      titre: t('parametres.fne_wiz_step2_titre'),
      desc:  t('parametres.fne_wiz_step2_desc'),
      done:  Boolean(centreFiscal && centreFiscal.trim()),
    },
    {
      id: 'inscription',
      titre: t('parametres.fne_wiz_step3_titre'),
      desc:  t('parametres.fne_wiz_step3_desc'),
      // Heuristique : si l'utilisateur a une clé API, c'est qu'il a déjà fait la demande
      done:  Boolean(cleConfigured),
    },
    {
      id: 'cle',
      titre: t('parametres.fne_wiz_step4_titre'),
      desc:  t('parametres.fne_wiz_step4_desc'),
      done:  Boolean(cleConfigured),
    },
    {
      id: 'mock',
      titre: t('parametres.fne_wiz_step5_titre'),
      desc:  t('parametres.fne_wiz_step5_desc'),
      done:  Boolean(fneActif),
    },
    {
      id: 'prod',
      titre: t('parametres.fne_wiz_step6_titre'),
      desc:  t('parametres.fne_wiz_step6_desc'),
      done:  Boolean(modeProduction && statutPing === 'ok'),
    },
  ];

  const nbDone   = etapes.filter(e => e.done).length;
  const total    = etapes.length;
  const progress = Math.round((nbDone / total) * 100);
  const allDone  = nbDone === total;

  return (
    <div style={{
      background: C.card, border: `1.5px solid ${allDone ? C.accent : C.border}`,
      borderRadius: 16, padding: '20px 22px',
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 16, marginBottom: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} color={allDone ? C.accent : C.muted} />
            {t('parametres.fne_wiz_title')}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {allDone
              ? t('parametres.fne_wiz_complete')
              : t('parametres.fne_wiz_progress', { done: nbDone, total })}
          </div>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: allDone ? C.accent : C.text,
          whiteSpace: 'nowrap',
        }}>
          {progress} %
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{
        height: 4, background: `${C.border}88`, borderRadius: 100,
        marginBottom: 18, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${progress}%`, background: C.accent,
          transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: progress > 0 ? `0 0 6px ${C.accent}80` : 'none',
        }} />
      </div>

      {/* Liste des étapes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {etapes.map((e, i) => (
          <div key={e.id} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12,
            padding: '12px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}44`,
            opacity: e.done ? 0.7 : 1,
          }}>
            {/* Pastille numérotée ou coche */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: e.done ? C.accent : 'transparent',
              border: `1.5px solid ${e.done ? C.accent : C.border}`,
              color: e.done ? '#000' : C.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
              flexShrink: 0,
            }}>
              {e.done ? <CheckCircle size={13} /> : i + 1}
            </div>
            <div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.text,
                textDecoration: e.done ? 'line-through' : 'none',
                textDecorationColor: `${C.muted}80`,
              }}>
                {e.titre}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.55 }}>
                {e.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coordonnées officielles DGI Côte d'Ivoire — tirées du document
          DGI « Procédure d'interfaçage des entreprises par API » (mai 2025).
          L'URL de production est transmise par mail après validation. */}
      <div style={{
        marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}88`,
        fontSize: 11.5, color: C.muted, lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: 6 }}>
          {t('parametres.fne_wiz_more')}
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>
            {t('parametres.fne_wiz_portal_test')}{' '}
            <a href="http://54.247.95.108" target="_blank" rel="noopener noreferrer"
               style={{ color: C.accent, textDecoration: 'underline' }}>
              http://54.247.95.108
            </a>
          </li>
          <li>
            {t('parametres.fne_wiz_support')}{' '}
            <a href="mailto:support.fne@dgi.gouv.ci"
               style={{ color: C.accent, textDecoration: 'underline' }}>
              support.fne@dgi.gouv.ci
            </a>
          </li>
          <li>
            {t('parametres.fne_wiz_dgi')}{' '}
            <a href="https://www.dgi.gouv.ci/" target="_blank" rel="noopener noreferrer"
               style={{ color: C.accent, textDecoration: 'underline' }}>
              dgi.gouv.ci
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

function FiscalTab({ C, dark }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ncc: '', centre_fiscal: '', fne_actif: false, fne_auto_certif: false,
    fne_mode: 'mock', fne_api_key: '', fne_certificat: '',
  });
  const [showKey, setShowKey] = useState(false);
  // État du diagnostic DGI (pastille verte/rouge) — rafraîchi toutes les
  // 60 s côté UI, mais le backend met en cache 30 s pour ne pas spammer
  // l'API DGI réelle.
  const [ping, setPing] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const r = await api.get('/fne/config');
      const c = r.data.data;
      setConfig(c);
      setForm({
        ncc: c.ncc || '',
        centre_fiscal: c.centre_fiscal || '',
        fne_actif: !!c.fne_actif,
        fne_auto_certif: !!c.fne_auto_certif,
        fne_mode: c.fne_mode || 'mock',
        fne_api_key: '',     // jamais rempli (on n'expose pas la clé)
        fne_certificat: '',  // idem
      });
    } catch (err) {
      if (!err.handled) toast.error(t('common.loading_error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPing = async () => {
    setPingLoading(true);
    try {
      const r = await api.get('/fne/ping');
      setPing(r.data.data);
    } catch (err) {
      if (!err.handled) {
        // Erreur silencieuse — la pastille passera en "down" via le statut.
        setPing({ statut: 'down', message: err.response?.data?.message || 'Erreur' });
      }
    } finally {
      setPingLoading(false);
    }
  };

  const replayQueue = async () => {
    setReplayLoading(true);
    try {
      const r = await api.post('/fne/queue/rejouer');
      const succes = r.data?.data?.succes || 0;
      toast.success(t('parametres.fne_queue_replayed', { count: succes }));
      await fetchPing();
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setReplayLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); fetchPing(); }, []);
  // Rafraîchissement périodique de la pastille (60 s).
  useEffect(() => {
    const id = setInterval(fetchPing, 60_000);
    return () => clearInterval(id);
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/fne/config', form);
      toast.success(t('parametres.fne_saved'));
      await fetchConfig();
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('parametres.fne_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>{t('common.loading')}</div>;

  const inputStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  // Pastille de statut DGI : couleur + libellé i18n calculés depuis le
  // dernier ping connu (mode mock = pastille neutre, pas un faux "ok").
  const STATUT_COULEURS = {
    ok:           { fond: '#10B98120', point: '#10B981', texte: '#10B981', label: 'fne_ping_ok' },
    down:         { fond: '#EF444420', point: '#EF4444', texte: '#EF4444', label: 'fne_ping_down' },
    unconfigured: { fond: '#F59E0B20', point: '#F59E0B', texte: '#F59E0B', label: 'fne_ping_unconfigured' },
    mock:         { fond: `${C.muted}20`, point: C.muted, texte: C.muted, label: 'fne_ping_mock' },
  };
  const statutPing = ping?.statut || 'unconfigured';
  const couleurs = STATUT_COULEURS[statutPing] || STATUT_COULEURS.unconfigured;
  const heurePing = ping?.verifie_a
    ? new Date(ping.verifie_a).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '—';
  const enAttente = ping?.queue?.en_attente || 0;
  const echecDef = ping?.queue?.echec_definitif || 0;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Intro */}
      <div style={{
        background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 12,
        padding: '14px 16px', fontSize: 12, color: C.sub, lineHeight: 1.6,
      }}>
        {t('parametres.fne_intro')}
      </div>

      {/* Wizard FNE : checklist guidée qui se coche automatiquement selon
          l'état du formulaire. Aide pas-à-pas pour les nouveaux utilisateurs
          (la procédure DGI demande plusieurs démarches préalables). */}
      <WizardFne
        ncc={form.ncc}
        centreFiscal={form.centre_fiscal}
        cleConfigured={config?.fne_api_key_set || (form.fne_api_key && form.fne_api_key.trim())}
        fneActif={form.fne_actif}
        modeProduction={form.fne_mode === 'live'}
        statutPing={statutPing}
        C={C} dark={dark} t={t}
      />

      {/* Carte principale */}
      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #007A33, #003C71)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{t('parametres.fne_title')}</div>
              {/* ── Pastille de statut DGI ── */}
              <span
                title={`${t('parametres.fne_ping_title')} — ${ping?.message || ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 9px', borderRadius: 999,
                  background: couleurs.fond, color: couleurs.texte,
                  fontSize: 11, fontWeight: 700,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: couleurs.point,
                  boxShadow: statutPing === 'ok' ? `0 0 0 3px ${couleurs.fond}` : 'none',
                  animation: statutPing === 'ok' ? 'pulseDot 1.8s infinite' : 'none',
                }} />
                {t(`parametres.${couleurs.label}`)}
              </span>
              <button
                type="button" onClick={fetchPing} disabled={pingLoading}
                title={t('parametres.fne_ping_check_now')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 999,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.muted, fontSize: 10, fontWeight: 600,
                  cursor: pingLoading ? 'wait' : 'pointer',
                }}
              >
                <RefreshCw size={11} style={{ animation: pingLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                {t('parametres.fne_ping_checked_at', { heure: heurePing })}
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{t('parametres.fne_subtitle')}</div>
          </div>
          {form.fne_actif && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: `${C.accent}20`, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={11} /> {t('parametres.fne_active', { mode: form.fne_mode })}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            label={t('parametres.fne_ncc')}
            value={form.ncc}
            onChange={set('ncc')}
            placeholder="0123456 A"
          />
          <Input
            label={t('parametres.fne_centre')}
            value={form.centre_fiscal}
            onChange={set('centre_fiscal')}
            placeholder="CME Plateau"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            {t('parametres.fne_mode_label')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['mock', 'sandbox', 'prod'].map(m => (
              <button key={m} type="button" onClick={() => setForm(f => ({ ...f, fne_mode: m }))}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                  border: `1.5px solid ${form.fne_mode === m ? C.accent : C.border}`,
                  background: form.fne_mode === m ? `${C.accent}15` : 'transparent',
                  color: form.fne_mode === m ? C.accent : C.muted,
                  fontSize: 12, fontWeight: 700,
                }}>
                {t(`parametres.fne_mode_${m}`)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>
            {form.fne_mode === 'mock' && t('parametres.fne_mode_mock_help')}
            {form.fne_mode === 'sandbox' && t('parametres.fne_mode_sandbox_help')}
            {form.fne_mode === 'prod' && t('parametres.fne_mode_prod_help')}
          </div>
        </div>

        {form.fne_mode !== 'mock' && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
              {t('parametres.fne_api_key')}
              {config?.fne_api_key_set && (
                <span style={{ fontWeight: 400, textTransform: 'none', color: C.muted, marginLeft: 8 }}>
                  · {config.fne_api_key_apercu}
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={form.fne_api_key}
                onChange={set('fne_api_key')}
                placeholder={config?.fne_api_key_set ? t('parametres.integration_keep_value') : 'dgi_ci_xxxxxxxxx'}
                style={inputStyle}
              />
              <button type="button" onClick={() => setShowKey(s => !s)} style={{
                padding: '0 12px', borderRadius: 9, border: `1px solid ${C.border}`,
                background: C.input, color: C.muted, cursor: 'pointer',
              }}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.fne_actif}
            onChange={e => setForm(f => ({ ...f, fne_actif: e.target.checked }))}
            style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {t('parametres.fne_actif_label')}
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, cursor: form.fne_actif ? 'pointer' : 'not-allowed', opacity: form.fne_actif ? 1 : 0.5 }}>
          <input type="checkbox" checked={form.fne_auto_certif}
            disabled={!form.fne_actif}
            onChange={e => setForm(f => ({ ...f, fne_auto_certif: e.target.checked }))}
            style={{ width: 16, height: 16, marginTop: 2, cursor: 'inherit' }} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.4 }}>
            {t('parametres.fne_auto_certif_label')}
          </span>
        </label>
      </div>

      {/* ── Bandeau file d'attente DGI ── */}
      {(enAttente > 0 || echecDef > 0) && (
        <div style={{
          background: enAttente > 0 ? `${C.blue}10` : '#EF444410',
          border: `1px solid ${enAttente > 0 ? C.blue : '#EF4444'}30`,
          borderRadius: 14, padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Activity size={16} color={enAttente > 0 ? C.blue : '#EF4444'} />
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
              {t('parametres.fne_queue_title')}
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 10 }}>
            {t('parametres.fne_queue_intro')}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10,
              background: `${C.blue}20`, color: C.blue,
            }}>
              {t('parametres.fne_queue_count', { count: enAttente })}
            </span>
            {echecDef > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10,
                background: '#EF444420', color: '#EF4444',
              }}>
                {t('parametres.fne_queue_failed', { count: echecDef })}
              </span>
            )}
            <button type="button" onClick={replayQueue} disabled={replayLoading || enAttente === 0}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9, border: 'none',
                background: C.accent, color: dark ? '#000' : '#fff',
                fontSize: 12, fontWeight: 700,
                cursor: (replayLoading || enAttente === 0) ? 'not-allowed' : 'pointer',
                opacity: enAttente === 0 ? 0.5 : 1,
              }}>
              <RefreshCw size={12} style={{ animation: replayLoading ? 'spin 0.8s linear infinite' : 'none' }} />
              {t('parametres.fne_queue_replay')}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer',
        }}>
          <Save size={14} /> {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* Animations CSS pour la pastille et l'icône de rafraîchissement */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 0 ${couleurs.fond}; }
          50%      { box-shadow: 0 0 0 6px transparent; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}

// ─── Onglet Abonnement ──────────────────────────────────────────────────
// Affiche le palier actif, les compteurs d'usage du mois en cours, et
// un CTA vers la page /tarifs pour changer de palier. Tous les chiffres
// (quotas + usage) viennent du backend pour rester en cohérence avec la
// matrice de quotas — pas de duplication côté front.
function AbonnementTab({ C, dark }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/abonnement')
      .then(r => setData(r.data.data))
      .catch(err => { if (!err.handled) toast.error(t('common.loading_error')); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>{t('common.loading')}</div>;
  }

  const { abonnement, quotas, usage } = data;
  const prixMensuel = abonnement.prix_mensuel_fcfa || quotas.prix_mensuel || 0;

  const Barre = ({ label, used, max, pct }) => {
    const isUnlimited = max === null;
    const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : C.accent;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: C.sub, fontWeight: 600 }}>{label}</span>
          <span style={{ color: isUnlimited ? C.accent : C.text, fontWeight: 700, fontFamily: 'monospace' }}>
            {isUnlimited ? `${used} · ${t('abonnement.usage_unlimited')}` : `${used} / ${max}`}
          </span>
        </div>
        {!isUnlimited && (
          <div style={{ height: 6, background: C.hover, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
    );
  };

  const palierLabel = t(`tarifs.palier_${abonnement.palier}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 12,
        padding: '14px 16px', fontSize: 12, color: C.sub, lineHeight: 1.6,
      }}>
        {t('abonnement.intro')}
      </div>

      {/* Carte palier actuel */}
      <div style={{
        background: C.card, border: `2px solid ${C.accent}40`, borderRadius: 16,
        padding: 24, display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CreditCard size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            {t('abonnement.current_plan')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{palierLabel}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {prixMensuel > 0
              ? t('abonnement.price_label', { prix: prixMensuel.toLocaleString('fr-FR') })
              : t('abonnement.free_label')}
            {' · '}
            {abonnement.date_fin
              ? t('abonnement.current_plan_until', { date: new Date(abonnement.date_fin).toLocaleDateString('fr-FR') })
              : t('abonnement.no_end')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/tarifs')} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{t('abonnement.btn_change')}</button>
        </div>
      </div>

      {/* Compteurs d'usage */}
      <div style={{
        background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 18 }}>
          {t('abonnement.usage_title')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Barre label={t('abonnement.usage_users')}      used={usage.utilisateurs}    max={quotas.utilisateurs}    pct={usage.pourcentages.utilisateurs} />
          <Barre label={t('abonnement.usage_factures')}   used={usage.factures_mois}   max={quotas.factures_mois}   pct={usage.pourcentages.factures_mois} />
          <Barre label={t('abonnement.usage_ocr')}        used={usage.ocr_scans_mois}  max={quotas.ocr_scans_mois}  pct={usage.pourcentages.ocr_scans_mois} />
          <Barre label={t('abonnement.usage_entreprises')} used={usage.entreprises}    max={quotas.entreprises}     pct={0} />
        </div>

        {/* Bandeau d'alerte si une jauge dépasse 80 % */}
        {Object.values(usage.pourcentages).some(p => p >= 80) && (
          <div style={{
            marginTop: 18, padding: '12px 14px', borderRadius: 10,
            background: `${C.gold}15`, border: `1px solid ${C.gold}40`,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <AlertCircle size={16} color={C.gold} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
              {t('abonnement.usage_over')}
            </div>
            <button onClick={() => navigate('/tarifs')} style={{
              marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: 'none',
              background: C.gold, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>{t('abonnement.upgrade_cta')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Matrice de permissions éditable. Affiche les modules accessibles à un
// rôle (ou tous les modules si l'utilisateur veut élargir au-delà du
// template), avec une case à cocher par action. Charge le template par
// défaut depuis l'API à chaque changement de rôle, puis laisse l'admin
// cocher / décocher ce qu'il veut.
//
// Props :
//   - role          : code du rôle (ex. 'commercial')
//   - value         : override actuel { module: [actions] } ou null
//   - onChange(o)   : appelé avec le nouvel override sanitisé
//   - C, dark, t    : style + i18n
// ═══════════════════════════════════════════════════════════════════════
const MODULES_AFFICHES = [
  // Ordre identique à la sidebar applicative pour rester reconnaissable.
  'factures', 'devis', 'clients', 'depenses', 'fournisseurs', 'tresorerie',
  'produits', 'paie', 'immobilisations', 'comptabilite', 'cloture',
  'taxes', 'rapports', 'audit_log', 'users', 'entreprise',
];
// Mapping module → clé i18n existante (nav.* déjà traduite).
const MODULE_LABEL_KEY = {
  factures: 'nav.factures', devis: 'nav.devis', clients: 'nav.clients',
  depenses: 'nav.depenses', fournisseurs: 'nav.fournisseurs',
  tresorerie: 'nav.tresorerie', produits: 'nav.produits',
  paie: 'nav.paie', immobilisations: 'nav.immobilisations',
  comptabilite: 'nav.comptabilite', cloture: 'parametres.tab_cloture',
  taxes: 'nav.taxes', rapports: 'nav.rapports', audit_log: 'nav.audit_log',
  users: 'parametres.members', entreprise: 'parametres.company',
};
// Mapping nom interne API → clé module back. Identique côté FE et BE pour
// éviter les divergences.
const API_MODULE_KEY = {
  ...Object.fromEntries(MODULES_AFFICHES.map(m => [m, m])),
  comptabilite: 'ecritures',  // back : module 'ecritures'
};
const ACTIONS_AFFICHEES = ['read', 'create', 'update', 'delete', 'counter_pass'];

function MatricePermissions({ role, value, onChange, C, dark, t }) {
  const [template, setTemplate] = useState(null);  // matrice par défaut du rôle
  const [loading, setLoading] = useState(false);
  // Override courant (state local pour la fluidité, propagé via onChange).
  // Si `value` est null on retombe sur le template au premier rendu.
  const override = value || template || {};

  // Recharge le template à chaque changement de rôle pour pré-cocher
  // correctement (ex : passer de RH à Commercial change tout).
  useEffect(() => {
    if (!role) return;
    setLoading(true);
    api.get(`/permissions/template/${role}`)
      .then(r => {
        setTemplate(r.data.data.template);
        // Si pas d'override custom encore, pré-rempli avec le template
        if (!value) onChange(r.data.data.template);
      })
      .catch(() => {/* silent : l'admin peut quand même cocher manuellement */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const togglePermission = (module, action) => {
    const next = { ...override };
    const apiKey = API_MODULE_KEY[module] || module;
    const current = next[apiKey] || [];
    const has = current.includes(action);
    const updated = has ? current.filter(a => a !== action) : [...current, action];
    if (updated.length === 0) {
      delete next[apiKey];
    } else {
      next[apiKey] = updated;
    }
    onChange(next);
  };

  const resetToRole = () => {
    if (template) onChange({ ...template });
    toast.success(t('parametres.perms_reset_done'));
  };

  // Une action est cochable si la matrice back l'autorise pour AU MOINS un
  // rôle (ex : delete sur ecritures est interdit à tout le monde — case grisée).
  // Pour rester simple, on grise une action sur un module si le template du
  // rôle initial ne l'a jamais eue ET que le module l'a pas dans son set
  // (heuristique : si le template d'un autre rôle pourrait l'avoir, on laisse
  // la case ouverte). Ici on simplifie : on laisse cliquer librement, le back
  // sanitise en sortie via validerOverride().

  const isChecked = (module, action) => {
    const apiKey = API_MODULE_KEY[module] || module;
    return Array.isArray(override[apiKey]) && override[apiKey].includes(action);
  };

  const modulesAvecAcces = Object.values(override).filter(arr => Array.isArray(arr) && arr.length > 0).length;

  return (
    <div style={{
      background: dark ? '#0D1220' : C.cardAlt || '#F8FAFC',
      border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            {t('parametres.perms_matrix_title')}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {loading ? t('parametres.perms_loading_template')
                     : t('parametres.perms_summary', { count: modulesAvecAcces })}
          </div>
        </div>
        <button type="button" onClick={resetToRole} disabled={!template}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 7,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: 11, fontWeight: 600,
            cursor: template ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}>
          <RotateCcw size={11} /> {t('parametres.perms_reset_to_role')}
        </button>
      </div>

      <div style={{ overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', minWidth: 520,
          fontSize: 12, color: C.text,
        }}>
          <thead>
            <tr>
              <th style={cellThModule(C)}>{t('comptabilite.col_account') /* Module */}</th>
              {ACTIONS_AFFICHEES.map(a => (
                <th key={a} style={cellThAction(C)}>
                  {t(`parametres.perms_action_${a}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES_AFFICHES.map((m, idx) => (
              <tr key={m} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${C.border}33` }}>
                <td style={cellTdModule(C)}>{t(MODULE_LABEL_KEY[m] || m)}</td>
                {ACTIONS_AFFICHEES.map(a => {
                  const checked = isChecked(m, a);
                  return (
                    <td key={a} style={cellTdCheck(C)}>
                      <button type="button"
                        onClick={() => togglePermission(m, a)}
                        aria-pressed={checked}
                        title={`${t(MODULE_LABEL_KEY[m])} · ${t(`parametres.perms_action_${a}`)}`}
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: `1.5px solid ${checked ? C.accent : C.border}`,
                          background: checked ? C.accent : 'transparent',
                          color: checked ? '#000' : 'transparent',
                          cursor: 'pointer', padding: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                        {checked && <Check size={14} strokeWidth={3} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellThModule = (C) => ({
  textAlign: 'left', padding: '6px 8px 10px', fontSize: 10, fontWeight: 700,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: `1px solid ${C.border}`,
});
const cellThAction = (C) => ({
  textAlign: 'center', padding: '6px 8px 10px', fontSize: 10, fontWeight: 700,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: `1px solid ${C.border}`, minWidth: 70,
});
const cellTdModule = (C) => ({
  padding: '8px 8px', fontSize: 12, color: C.text, fontWeight: 500,
  whiteSpace: 'nowrap',
});
const cellTdCheck = (C) => ({
  padding: '6px 8px', textAlign: 'center',
});

export default function ParametresPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const { actuelle, chargerEntreprises } = useEntreprise();
  const { can } = usePermissions();
  // Verrous UI calculés depuis la matrice de permissions du backend.
  // Le backend re-vérifie systématiquement de toute façon, l'UI sert
  // uniquement à éviter d'afficher des actions qui finiraient en 403.
  const canEditEntreprise = can('entreprise', 'update');
  const canReadMembres    = can('users', 'read');
  const canInviteMembre   = can('users', 'create');
  const canChangeRole     = can('users', 'update');
  const canRemoveMembre   = can('users', 'delete');
  const [tab, setTab] = useState('entreprise');
  // Si l'utilisateur arrive sur un onglet auquel il n'a pas droit, on le
  // bascule vers Entreprise (lecture seule pour tous).
  useEffect(() => {
    if (tab === 'membres' && !canReadMembres) setTab('entreprise');
  }, [tab, canReadMembres]);
  const [membres, setMembres] = useState([]);
  const [form, setForm] = useState({});
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user', nom: '' });
  // Permissions personnalisées à l'invitation : OFF par défaut (le membre
  // hérite de la matrice rôle), ON = on cocher action par action.
  const [inviteCustom, setInviteCustom] = useState(false);
  const [inviteOverride, setInviteOverride] = useState(null);
  // Modale d'édition des permissions d'un membre existant
  const [editingPermissions, setEditingPermissions] = useState(null);  // { id, nom, role, override }
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invitationGeneree, setInvitationGeneree] = useState(null);  // { email, role, lien_invitation, compte_existant }

  useEffect(() => {
    if (actuelle) {
      setForm({
        nom: actuelle.nom || '', sigle: actuelle.sigle || '',
        forme_juridique: actuelle.forme_juridique || 'SARL',
        secteur: actuelle.secteur || '', email: actuelle.email || '',
        telephone: actuelle.telephone || '', adresse: actuelle.adresse || '',
        ville: actuelle.ville || '', pays: actuelle.pays || "Côte d'Ivoire",
        ninea: actuelle.ninea || '', rccm: actuelle.rccm || '',
        regime_fiscal: actuelle.regime_fiscal || 'RSI',
        taux_tva: actuelle.taux_tva || 18,
      });
      // Ne pas tenter de charger les membres si l'utilisateur n'a pas
      // users.read — sinon l'API renvoie 403 et l'utilisateur voit un
      // toast en plus du verrouillage UI déjà appliqué.
      if (canReadMembres) fetchMembres();
    }
  }, [actuelle?.id, canReadMembres]);

  const fetchMembres = async () => {
    try {
      const res = await api.get(`/entreprises/${actuelle.id}/membres`);
      setMembres(res.data.data);
    } catch (err) {
      // Si l'intercepteur a déjà notifié (403/5xx/réseau), on n'affiche
      // pas un second toast. Sinon on tombe sur un cas inattendu (404…).
      if (!err.handled) toast.error(t('parametres.err_load_members'));
    }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveEntreprise = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/entreprises/${actuelle.id}`, form);
      await chargerEntreprises();
      toast.success(t('parametres.toast_saved'));
    } catch { toast.error(t('parametres.toast_save_err')); }
    finally { setSaving(false); }
  };

  const handleInviter = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...inviteForm,
        // Override envoyé uniquement si le Propriétaire a explicitement
        // demandé une personnalisation. Sinon NULL → matrice rôle par défaut.
        permissions_override: inviteCustom ? inviteOverride : null,
      };
      const res = await api.post(`/entreprises/${actuelle.id}/membres`, payload);
      const data = res.data.data || {};
      const emailInvite = inviteForm.email;
      setShowInvite(false);
      setInviteForm({ email: '', role: 'user', nom: '' });
      setInviteCustom(false);
      setInviteOverride(null);
      fetchMembres();
      if (data.lien_invitation) {
        // Nouveau compte : on affiche le lien à transmettre
        setInvitationGeneree({
          email: emailInvite,
          role: data.role,
          lien_invitation: window.location.origin + data.lien_invitation,
          compte_existant: false,
        });
      } else {
        // Compte déjà existant : accès immédiat, pas de lien
        toast.success(t('parametres.account_exists', { email: emailInvite }));
      }
    } catch (err) { toast.error(err.response?.data?.message || t('parametres.err_invite')); }
  };

  const copierLien = () => {
    if (!invitationGeneree) return;
    navigator.clipboard.writeText(invitationGeneree.lien_invitation)
      .then(() => toast.success(t('parametres.copy_success')))
      .catch(() => toast.error(t('parametres.copy_failed')));
  };

  const handleChangeRole = async (userId, role) => {
    try {
      await api.put(`/entreprises/${actuelle.id}/membres/${userId}/role`, { role });
      toast.success(t('parametres.role_changed'));
      fetchMembres();
    } catch (err) {
      toast.error(err.response?.data?.message || t('parametres.err_role_update'));
      fetchMembres();  // resynchronise le sélecteur sur la valeur réelle
    }
  };

  // Enregistre l'override permissions d'un membre. `override` peut être
  // null = retour aux valeurs par défaut du rôle.
  const handleSavePermissions = async () => {
    if (!editingPermissions) return;
    try {
      await api.put(
        `/entreprises/${actuelle.id}/membres/${editingPermissions.id}/permissions`,
        { permissions_override: editingPermissions.override }
      );
      toast.success(t('parametres.perms_saved'));
      setEditingPermissions(null);
      fetchMembres();
    } catch (err) {
      toast.error(err.response?.data?.message || t('parametres.perms_save_error'));
    }
  };

  const handleRetirerMembre = async (userId) => {
    if (!confirm(t('parametres.remove_member'))) return;
    try {
      await api.delete(`/entreprises/${actuelle.id}/membres/${userId}`);
      toast.success(t('parametres.removed'));
      fetchMembres();
    } catch (err) { toast.error(err.response?.data?.message || t('parametres.err_generic')); }
  };

  if (!actuelle) return (
    <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>{t('parametres.no_company')}</div>
  );

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('parametres.title')}</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{actuelle.nom}</p>
      </div>

      {/* Tabs : on n'expose Membres qu'aux rôles autorisés à users.read,
          Intégrations seulement aux admins (entreprise.update) */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { id: 'entreprise',   icon: Building2,  label: t('parametres.company'),       visible: true },
          { id: 'membres',      icon: Users,      label: `${t('parametres.members')} (${membres.length})`, visible: canReadMembres },
          { id: 'integrations', icon: Smartphone, label: t('parametres.integrations'),  visible: canEditEntreprise },
          { id: 'fiscal',       icon: Shield,     label: t('parametres.fiscal'),        visible: canEditEntreprise },
          { id: 'abonnement',   icon: CreditCard, label: t('abonnement.tab_label'),     visible: canEditEntreprise },
          { id: 'preferences',  icon: Globe,      label: t('parametres.preferences'),   visible: true },
        ].filter(item => item.visible).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === id ? C.accent : '#161F2E', color: tab === id ? '#000' : C.muted,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Entreprise */}
      {tab === 'entreprise' && (
        <form data-onboarding="form-entreprise" onSubmit={handleSaveEntreprise} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!canEditEntreprise && (
            <div style={{
              background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12,
              padding: '12px 16px', fontSize: 12, color: C.sub, lineHeight: 1.55,
            }}>
              {t('parametres.read_only_notice')}
            </div>
          )}
          {/* fieldset disabled neutralise toutes les saisies enfant en HTML pur ;
              le backend re-vérifie via requirePermission('entreprise','update'). */}
          <fieldset disabled={!canEditEntreprise} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20, opacity: canEditEntreprise ? 1 : 0.85 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.company_info')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label={`${t('parametres.company_name')} *`} value={form.nom} onChange={set('nom')} placeholder="SARL MonEntreprise" />
              <Input label={t('parametres.sigle')} value={form.sigle} onChange={set('sigle')} placeholder="ME" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.legal_form')}</label>
                <select value={form.forme_juridique} onChange={set('forme_juridique')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {FORMES.map(f => <option key={f} value={f}>{FORME_LABELS[f] ? t(FORME_LABELS[f]) : f}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.tax_regime')}</label>
                <select value={form.regime_fiscal} onChange={set('regime_fiscal')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {REGIMES.map(r => <option key={r} value={r}>{REGIME_LABELS[r] ? t(REGIME_LABELS[r]) : r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.tva_rate')}</label>
                <input type="number" value={form.taux_tva} onChange={set('taux_tva')} min="0" max="100"
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <Input label={t('parametres.sector')} value={form.secteur} onChange={set('secteur')} placeholder="Services informatiques, Commerce..." />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.contact_section')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Input label={t('common.email')} type="email" value={form.email} onChange={set('email')} placeholder="contact@entreprise.ci" />
              <Input label={t('common.phone')} value={form.telephone} onChange={set('telephone')} placeholder="+225 27 00 00 00" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input label={t('common.address')} value={form.adresse} onChange={set('adresse')} placeholder="Rue des Jardins, Cocody" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label={t('common.city')} value={form.ville} onChange={set('ville')} placeholder="Abidjan" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.country')}</label>
                <select value={form.pays} onChange={set('pays')}
                  style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                  {PAYS_LIST.map(p => <option key={p} value={p}>{p === 'Autre' ? t('parametres.forme_autre') : p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{t('parametres.fiscal_id_section')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label={t('parametres.ninea')} value={form.ninea} onChange={set('ninea')} placeholder="CI-2020-A-12345" />
              <Input label={t('parametres.rccm')} value={form.rccm} onChange={set('rccm')} placeholder="RCC/ABJ/2020/B/1234" />
            </div>
          </div>

          {canEditEntreprise && (
            <button type="submit" disabled={saving} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 32px', borderRadius: 12, border: 'none',
              background: C.accent, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: 'fit-content',
            }}>
              <Save size={16} /> {saving ? t('parametres.saving') : t('parametres.save_changes')}
            </button>
          )}
          </fieldset>
        </form>
      )}

      {/* Tab Préférences */}
      {tab === 'preferences' && <PreferencesTab C={C} />}
      {tab === 'integrations' && canEditEntreprise && <IntegrationsTab C={C} dark={dark} />}
      {tab === 'fiscal' && canEditEntreprise && <FiscalTab C={C} dark={dark} />}
      {tab === 'abonnement' && canEditEntreprise && <AbonnementTab C={C} dark={dark} />}

      {/* Tab Membres */}
      {tab === 'membres' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Légende des rôles */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{t('parametres.roles_legend')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {Object.entries(ROLES).map(([key, r]) => (
                <div key={key} style={{ background: C.hover, borderRadius: 10, padding: '12px 14px', border: `1px solid ${r.color}30` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: r.color, marginBottom: 4 }}>{t(r.labelKey)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t(r.descKey)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Liste membres */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t('parametres.team_members', { count: membres.length })}</div>
              {canInviteMembre && (
                <button onClick={() => setShowInvite(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
                  border: 'none', background: C.accent, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  <Plus size={14} /> {t('parametres.invite_member')}
                </button>
              )}
            </div>

            {/* Formulaire invitation */}
            {showInvite && canInviteMembre && (
              <div style={{ padding: '20px 24px', background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                <form onSubmit={handleInviter} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 0 200px' }}>
                      <Input label={t('parametres.invite_email')} type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder={t('parametres.invite_email_placeholder')} />
                    </div>
                    <div style={{ flex: '1 0 140px' }}>
                      <Input label={t('parametres.invite_name')} value={inviteForm.nom} onChange={e => setInviteForm(f => ({ ...f, nom: e.target.value }))} placeholder={t('parametres.invite_name_placeholder')} />
                    </div>
                    <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('parametres.invite_role')}</label>
                      <select value={inviteForm.role} onChange={e => {
                          const newRole = e.target.value;
                          setInviteForm(f => ({ ...f, role: newRole }));
                          // Reset override pour que MatricePermissions recharge le template du nouveau rôle.
                          setInviteOverride(null);
                        }}
                        style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                        {Object.entries(ROLES)
                          .filter(([k, v]) => k !== 'proprietaire' && !v.legacy)
                          .map(([k, v]) => (
                            <option key={k} value={k}>{t(v.labelKey)}</option>
                          ))}
                      </select>
                    </div>
                    <button type="submit" style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: C.accent, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      {t('parametres.invite_submit')}
                    </button>
                  </div>

                  {/* Toggle « Personnaliser les permissions » + matrice */}
                  <div style={{
                    padding: '12px 14px', borderRadius: 10,
                    border: `1px solid ${inviteCustom ? C.accent : C.border}`,
                    background: inviteCustom ? `${C.accent}08` : 'transparent',
                    transition: 'all 0.2s',
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      cursor: 'pointer', userSelect: 'none',
                    }}>
                      <input
                        type="checkbox"
                        checked={inviteCustom}
                        onChange={e => {
                          setInviteCustom(e.target.checked);
                          if (!e.target.checked) setInviteOverride(null);
                        }}
                        style={{
                          marginTop: 3, width: 16, height: 16,
                          accentColor: C.accent, cursor: 'pointer',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Sliders size={13} color={C.accent} />
                          {t('parametres.perms_custom_toggle')}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                          {t('parametres.perms_custom_help')}
                        </div>
                      </div>
                    </label>
                    {inviteCustom && (
                      <div style={{ marginTop: 14 }}>
                        <MatricePermissions
                          role={inviteForm.role}
                          value={inviteOverride}
                          onChange={setInviteOverride}
                          C={C} dark={dark} t={t}
                        />
                      </div>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Lien d'invitation généré — à transmettre au nouveau membre */}
            {invitationGeneree && (
              <div style={{
                padding: '18px 24px', background: `${C.accent}10`,
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <Link2 size={16} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {t('parametres.link_title', { email: invitationGeneree.email })}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {t('parametres.link_help')}
                    </div>
                  </div>
                  <button onClick={() => setInvitationGeneree(null)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0 }}>
                    <X size={15} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={invitationGeneree.lien_invitation}
                    onFocus={e => e.target.select()}
                    style={{
                      flex: 1, background: C.input, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '9px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }} />
                  <button onClick={copierLien} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                    border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <Copy size={13} /> {t('parametres.btn_copy')}
                  </button>
                </div>
              </div>
            )}

            {membres.map((m, i) => {
              const roleInfo = ROLES[m.role] || ROLES.user;
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 24px', borderBottom: i < membres.length - 1 ? `1px solid ${C.border}22` : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161F2E'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${roleInfo.color}80, ${roleInfo.color}40)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#fff',
                  }}>{initiales(m.nom)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.nom}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t('parametres.member_since', { date: formatDate(m.created_at) })}</div>
                  {/* Le rôle de tout membre est modifiable (y compris propriétaire) ;
                      le backend empêche de retirer/rétrograder le dernier propriétaire.
                      Les rôles sans users.update n'ont qu'un badge lecture seule. */}
                  {canChangeRole ? (
                    <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                      style={{ background: `${roleInfo.color}20`, border: `1px solid ${roleInfo.color}50`, borderRadius: 8, padding: '6px 10px', color: roleInfo.color, fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {Object.entries(ROLES).map(([k, v]) => (
                        <option key={k} value={k} style={{ background: C.card, color: C.text }}>{t(v.labelKey)}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ background: `${roleInfo.color}20`, border: `1px solid ${roleInfo.color}50`, borderRadius: 8, padding: '6px 10px', color: roleInfo.color, fontSize: 12, fontWeight: 700 }}>
                      {t(roleInfo.labelKey)}
                    </span>
                  )}
                  {/* Bouton « Permissions » — visible aux Propriétaire/Admin
                      (users.update). Le badge « personnalisées » apparaît
                      uniquement si le membre a un override actif. */}
                  {canChangeRole && m.role !== 'proprietaire' && (
                    <button
                      onClick={() => setEditingPermissions({
                        id: m.id, nom: m.nom, role: m.role,
                        override: m.permissions_override || null,
                      })}
                      title={t('parametres.perms_tooltip_edit')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 10px', background: m.permissions_override
                          ? `${C.accent}20` : 'none',
                        border: `1px solid ${m.permissions_override ? C.accent : C.border}`,
                        borderRadius: 7, cursor: 'pointer',
                        color: m.permissions_override ? C.accent : C.muted,
                        fontSize: 11, fontWeight: 600,
                      }}>
                      <Sliders size={12} />
                      {m.permissions_override && (
                        <span style={{ fontSize: 10 }}>{t('parametres.perms_status_custom')}</span>
                      )}
                    </button>
                  )}
                  {canRemoveMembre && (
                    <button onClick={() => handleRetirerMembre(m.id)}
                      title={t('parametres.member_remove_tooltip')}
                      style={{ padding: '6px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modale d'édition des permissions d'un membre */}
      {editingPermissions && (
        <div
          onClick={() => setEditingPermissions(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: 28,
              maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>
                  {t('parametres.perms_edit_title', { name: editingPermissions.nom })}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.55 }}>
                  {t('parametres.perms_edit_subtitle')}
                </div>
              </div>
              <button onClick={() => setEditingPermissions(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <MatricePermissions
                role={editingPermissions.role}
                value={editingPermissions.override}
                onChange={override => setEditingPermissions(p => ({ ...p, override }))}
                C={C} dark={dark} t={t}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditingPermissions(null)}
                style={{
                  padding: '10px 18px', borderRadius: 9,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {t('parametres.perms_edit_cancel')}
              </button>
              <button onClick={handleSavePermissions}
                style={{
                  padding: '10px 18px', borderRadius: 9, border: 'none',
                  background: C.accent, color: '#000',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <Save size={13} /> {t('parametres.perms_edit_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Onboarding pageKey="parametres" />
    </div>
  );
}


