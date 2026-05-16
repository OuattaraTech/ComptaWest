import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input, AlerteSolde, evaluerSortie } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import {
  Users, FileText, Receipt, BarChart3, Plus, Search, Edit2, Trash2,
  Download, CheckCircle, CreditCard, AlertCircle, Eye, ChevronLeft,
  TrendingUp, Wallet,
} from 'lucide-react';

const MOIS_KEYS = [
  'rh.month_january','rh.month_february','rh.month_march','rh.month_april','rh.month_may','rh.month_june',
  'rh.month_july','rh.month_august','rh.month_september','rh.month_october','rh.month_november','rh.month_december',
];

const STATUT_CFG = {
  brouillon: { labelKey: 'rh.statut_brouillon', bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' },
  valide:    { labelKey: 'rh.statut_valide',    bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
  paye:      { labelKey: 'rh.statut_paye',      bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
  annule:    { labelKey: 'rh.statut_annule',    bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
};

const fmt = (n) => formatFCFA(n, false);

export default function RHPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const [tab, setTab] = useState('employes');

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('rh.title')}</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          {t('rh.subtitle')}
        </p>
      </div>

      {/* Onglets */}
      <div data-onboarding="tabs" style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: C.card, border: `1px solid ${C.border}`, marginBottom: 20, width: 'fit-content',
      }}>
        {[
          { id: 'employes',   label: t('rh.tab_employes'),  icon: Users },
          { id: 'bulletins',  label: t('rh.tab_bulletins'), icon: FileText },
          { id: 'rubriques',  label: t('rh.tab_rubriques'), icon: Receipt },
          { id: 'stats',      label: t('rh.tab_stats'),     icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? C.text : C.muted,
              background: active ? C.cardAlt : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'employes'  && <EmployesTab C={C} dark={dark} />}
      {tab === 'bulletins' && <BulletinsTab C={C} dark={dark} />}
      {tab === 'rubriques' && <RubriquesTab C={C} dark={dark} />}
      {tab === 'stats'     && <StatsTab C={C} dark={dark} />}

      <Onboarding pageKey="paie" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET EMPLOYÉS
// ═══════════════════════════════════════════════════════════════════════════
function EmployesTab({ C, dark }) {
  const { t } = useTranslation();
  const [employes, setEmployes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/paie/employes?search=${encodeURIComponent(search)}&limit=100`);
      setEmployes(res.data.data);
    } catch { toast.error(t('rh.load_employees_error')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, nom) => {
    if (!confirm(t('rh.archive_confirm', { name: nom }))) return;
    try {
      await api.delete(`/paie/employes/${id}`);
      toast.success(t('rh.employee_archived'));
      fetchData();
    } catch { toast.error(t('rh.err_generic')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 0 280px', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('rh.search_placeholder')}
            style={{
              width: '100%', background: C.card, border: `1.5px solid ${C.border}`,
              borderRadius: 10, padding: '10px 12px 10px 36px', color: C.text, fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }} />
        </div>
        <button data-onboarding="btn-nouveau-employe" onClick={() => { setEditing(null); setShowForm(true); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={15} /> {t('rh.new_employee')}
        </button>
      </div>

      <div data-onboarding="liste-employes" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[t('rh.th_matricule'), t('rh.th_nom'), t('rh.th_poste'), t('rh.th_contrat'), t('rh.th_salaire_base'), t('rh.th_embauche'), t('rh.th_statut'), ''].map((h, idx) => (
                <th key={idx} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('rh.loading')}</td></tr>
            ) : employes.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {search ? t('rh.no_result') : t('rh.no_employee')}
              </td></tr>
            ) : employes.map(e => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={ev => ev.currentTarget.style.background = C.hover}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{e.matricule}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.nom} {e.prenoms || ''}</div>
                  {e.email && <div style={{ fontSize: 10, color: C.muted }}>{e.email}</div>}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.sub }}>{e.poste || '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                                background: `${C.blue}18`, color: C.blue }}>
                    {e.type_contrat}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                  {fmt(e.salaire_base)}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted }}>{formatDate(e.date_embauche)}</td>
                <td style={{ padding: '12px 14px' }}>
                  {e.actif
                    ? <CheckCircle size={14} color={C.accent} />
                    : <span style={{ fontSize: 11, color: C.muted }}>{t('rh.inactif')}</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => { setEditing(e); setShowForm(true); }}
                      style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(e.id, e.nom)}
                      style={{ padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EmployeFormModal employe={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); toast.success(editing ? t('rh.toast_updated') : t('rh.toast_created')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

// ─── Formulaire création / édition employé ────────────────────────────────
function EmployeFormModal({ employe, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const isEdit = !!employe;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [comptes, setComptes] = useState([]);
  const [form, setForm] = useState(employe || {
    matricule: '', civilite: 'M.', nom: '', prenoms: '',
    date_naissance: '', lieu_naissance: '', sexe: 'M',
    nationalite: 'Ivoirienne', situation_matrimoniale: 'celibataire',
    nb_conjoints: 0, nb_enfants_charge: 0, cni: '',
    adresse: '', telephone: '', email: '',
    poste: '', departement: '', date_embauche: new Date().toISOString().split('T')[0],
    type_contrat: 'CDI', date_fin_contrat: '', categorie_professionnelle: '',
    salaire_base: '', mode_paiement: 'virement', compte_tresorerie_id: '',
    banque: '', rib: '', numero_mobile_money: '',
    numero_cnps: '', numero_cmu: '', taux_at_personnel: '',
  });

  useEffect(() => {
    api.get('/tresorerie/comptes').then(r => setComptes(r.data.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setBool = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  const handleSubmit = async () => {
    if (!form.matricule || !form.nom || !form.salaire_base) {
      toast.error(t('rh.err_matricule_required')); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/paie/employes/${employe.id}`, form);
      } else {
        await api.post('/paie/employes', form);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('rh.err_generic'));
    } finally { setSaving(false); }
  };

  const etapes = [t('rh.step_identite'), t('rh.step_contrat'), t('rh.step_remuneration'), t('rh.step_securite_sociale')];

  return (
    <Modal title={isEdit ? t('rh.form_edit_title', { name: employe.nom }) : t('rh.form_new_title')} onClose={onClose} width={620}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10 }}>
        {etapes.map((e, i) => (
          <button key={i} type="button" onClick={() => setStep(i)} style={{
            flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
            background: step === i ? C.accent : 'transparent',
            color: step === i ? (dark ? '#000' : '#fff') : C.muted,
          }}>
            {i + 1}. {e}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {step === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
              <Input label={t('rh.field_matricule')} value={form.matricule} onChange={set('matricule')} placeholder="EMP-001" required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_civilite')}</label>
                <select value={form.civilite} onChange={set('civilite')} style={selectStyle}>
                  <option value="M.">{t('rh.civilite_m')}</option>
                  <option value="Mme">{t('rh.civilite_mme')}</option>
                  <option value="Mlle">{t('rh.civilite_mlle')}</option>
                </select>
              </div>
              <Input label={t('rh.field_nom')} value={form.nom} onChange={set('nom')} placeholder="Kouassi" required />
            </div>
            <Input label={t('rh.field_prenoms')} value={form.prenoms} onChange={set('prenoms')} placeholder="Yao Désiré" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_date_naissance')} type="date" value={form.date_naissance} onChange={set('date_naissance')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_sexe')}</label>
                <select value={form.sexe} onChange={set('sexe')} style={selectStyle}>
                  <option value="M">{t('rh.sexe_m')}</option><option value="F">{t('rh.sexe_f')}</option>
                </select>
              </div>
              <Input label={t('rh.field_lieu_naissance')} value={form.lieu_naissance} onChange={set('lieu_naissance')} placeholder="Abidjan" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_nationalite')} value={form.nationalite} onChange={set('nationalite')} />
              <Input label={t('rh.field_cni')} value={form.cni} onChange={set('cni')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_situation')}</label>
                <select value={form.situation_matrimoniale} onChange={set('situation_matrimoniale')} style={selectStyle}>
                  <option value="celibataire">{t('rh.situation_celibataire')}</option>
                  <option value="marie">{t('rh.situation_marie')}</option>
                  <option value="divorce">{t('rh.situation_divorce')}</option>
                  <option value="veuf">{t('rh.situation_veuf')}</option>
                </select>
              </div>
              <Input label={t('rh.field_conjoints')} type="number" value={form.nb_conjoints} onChange={set('nb_conjoints')} />
              <Input label={t('rh.field_enfants_charge')} type="number" value={form.nb_enfants_charge} onChange={set('nb_enfants_charge')} />
            </div>
            <Input label={t('rh.field_adresse')} value={form.adresse} onChange={set('adresse')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_telephone')} value={form.telephone} onChange={set('telephone')} placeholder="+225 07 00 00 00" />
              <Input label={t('rh.field_email')} type="email" value={form.email} onChange={set('email')} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_poste')} value={form.poste} onChange={set('poste')} placeholder="Comptable senior" required />
              <Input label={t('rh.field_departement')} value={form.departement} onChange={set('departement')} placeholder="Finance" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_date_embauche')} type="date" value={form.date_embauche} onChange={set('date_embauche')} required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_type_contrat')}</label>
                <select value={form.type_contrat} onChange={set('type_contrat')} style={selectStyle}>
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="stage">{t('rh.contrat_stage')}</option>
                  <option value="prestation">{t('rh.contrat_prestation')}</option>
                  <option value="apprentissage">{t('rh.contrat_apprentissage')}</option>
                </select>
              </div>
            </div>
            {form.type_contrat === 'CDD' && (
              <Input label={t('rh.field_date_fin_cdd')} type="date" value={form.date_fin_contrat} onChange={set('date_fin_contrat')} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_categorie')}</label>
                <select value={form.categorie_professionnelle} onChange={set('categorie_professionnelle')} style={selectStyle}>
                  <option value="">—</option>
                  <option value="cadre">{t('rh.categorie_cadre')}</option>
                  <option value="agent_maitrise">{t('rh.categorie_agent_maitrise')}</option>
                  <option value="employe">{t('rh.categorie_employe')}</option>
                  <option value="ouvrier">{t('rh.categorie_ouvrier')}</option>
                </select>
              </div>
              <Input label={t('rh.field_convention')} value={form.convention_collective} onChange={set('convention_collective')} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Input label={t('rh.field_salaire_base')} type="number" value={form.salaire_base} onChange={set('salaire_base')} placeholder="350000" required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_mode_paiement')}</label>
                <select value={form.mode_paiement} onChange={set('mode_paiement')} style={selectStyle}>
                  <option value="virement">{t('rh.mode_virement')}</option>
                  <option value="mobile_money">{t('rh.mode_mobile_money')}</option>
                  <option value="cheque">{t('rh.mode_cheque')}</option>
                  <option value="cash">{t('rh.mode_cash')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.field_compte_paiement')}</label>
                <select value={form.compte_tresorerie_id || ''} onChange={set('compte_tresorerie_id')} style={selectStyle}>
                  <option value="">{t('rh.auto_mode')}</option>
                  {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            </div>
            {(form.mode_paiement === 'virement' || form.mode_paiement === 'cheque') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <Input label={t('rh.field_banque')} value={form.banque} onChange={set('banque')} placeholder="BICICI" />
                <Input label={t('rh.field_rib')} value={form.rib} onChange={set('rib')} placeholder="CI00 0000 0000 0000" />
              </div>
            )}
            {form.mode_paiement === 'mobile_money' && (
              <Input label={t('rh.field_numero_mobile_money')} value={form.numero_mobile_money} onChange={set('numero_mobile_money')} placeholder="+225 07 00 00 00 00" />
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('rh.field_numero_cnps')} value={form.numero_cnps} onChange={set('numero_cnps')} placeholder="01-2024-12345" />
              <Input label={t('rh.field_numero_cmu')} value={form.numero_cmu} onChange={set('numero_cmu')} placeholder="CMU-12345" />
            </div>
            <Input label={t('rh.field_taux_at')} type="number" value={form.taux_at_personnel} onChange={set('taux_at_personnel')} placeholder="2" />
            <div style={{ background: dark ? '#0D1220' : C.cardAlt, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('rh.info_label')}
              </div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}>
                {t('rh.cnps_info')}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 6, justifyContent: 'space-between' }}>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{
              padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t('rh.btn_previous')}</button>
          ) : <span />}

          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{t('rh.btn_next')}</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
              fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}>{saving ? t('common.saving') : isEdit ? t('rh.form_update') : t('rh.form_create')}</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET BULLETINS
// ═══════════════════════════════════════════════════════════════════════════
function BulletinsTab({ C, dark }) {
  const { t } = useTranslation();
  const now = new Date();
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerer, setShowGenerer] = useState(false);
  const [showEditor, setShowEditor] = useState(null);
  const [showPaiement, setShowPaiement] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/paie/bulletins?annee=${annee}&mois=${mois}&limit=100`);
      setBulletins(res.data.data);
    } catch { toast.error(t('rh.err_generic')); }
    finally { setLoading(false); }
  }, [annee, mois, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleValider = async (id) => {
    try { await api.post(`/paie/bulletins/${id}/valider`); toast.success(t('rh.toast_valide')); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || t('rh.err_generic')); }
  };

  const handleDownloadPDF = async (id, matricule) => {
    const toastId = toast.loading(t('rh.toast_pdf_progress'));
    try {
      const res = await api.get(`/paie/bulletins/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = `Bulletin_${matricule}_${annee}${String(mois).padStart(2,'0')}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success(t('rh.toast_pdf_done'));
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(t('rh.err_pdf'));
    }
  };

  const handleSupprimer = async (id) => {
    if (!confirm(t('rh.confirm_delete_brouillon'))) return;
    try { await api.delete(`/paie/bulletins/${id}`); toast.success(t('rh.toast_supprime')); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || t('rh.err_generic')); }
  };

  // Totaux
  const totaux = useMemo(() => bulletins.reduce((acc, b) => ({
    brut: acc.brut + parseFloat(b.brut_total || 0),
    net: acc.net + parseFloat(b.net_a_payer || 0),
    cout: acc.cout + parseFloat(b.cout_total_employeur || 0),
  }), { brut: 0, net: 0, cout: 0 }), [bulletins]);

  return (
    <div>
      {/* Sélecteurs période */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.month_label')}</label>
          <select value={mois} onChange={e => setMois(parseInt(e.target.value))} style={{
            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 9,
            padding: '9px 13px', color: C.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {MOIS_KEYS.map((key, i) => <option key={i} value={i + 1}>{t(key)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('rh.year_label')}</label>
          <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
        </div>
        <div style={{ flex: 1 }} />
        <button data-onboarding="btn-generer" onClick={() => setShowGenerer(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10,
          border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={14} /> {t('rh.generer_paie_btn')}
        </button>
      </div>

      {/* KPI synthétiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: t('rh.kpi_bulletins'),     val: bulletins.length, suffix: '', color: C.blue },
          { label: t('rh.kpi_brut_total'),    val: totaux.brut,      suffix: ' ' + t('common.currency'), color: C.accent },
          { label: t('rh.kpi_net_payer'),     val: totaux.net,       suffix: ' ' + t('common.currency'), color: C.gold },
          { label: t('rh.kpi_cout_employeur'), val: totaux.cout,     suffix: ' ' + t('common.currency'), color: C.red },
        ].map((k, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', boxShadow: C.shadow }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'monospace', marginTop: 6 }}>
              {typeof k.val === 'number' ? new Intl.NumberFormat('fr-FR').format(Math.round(k.val)) : k.val}
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{k.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau bulletins */}
      <div data-onboarding="liste-bulletins" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[t('rh.th_matricule'), t('rh.th_employe'), t('rh.th_brut'), t('rh.th_charges_sal'), t('rh.th_impots'), t('rh.th_net_payer'), t('rh.th_cout_empl'), t('rh.th_statut'), t('rh.th_actions')].map((h, idx) => (
                <th key={idx} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('rh.loading')}</td></tr>
            ) : bulletins.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {t('rh.no_bulletin_period', { month: t(MOIS_KEYS[mois - 1]), year: annee })}
              </td></tr>
            ) : bulletins.map(b => {
              const cfg = STATUT_CFG[b.statut] || STATUT_CFG.brouillon;
              return (
                <tr key={b.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.hover}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{b.matricule}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: C.text }}>
                    {b.employe_nom} {b.employe_prenoms || ''}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.text }}>{fmt(b.brut_total)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.red }}>−{fmt(b.total_cotisations_salariales)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.red }}>−{fmt(b.total_impots)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>{fmt(b.net_a_payer)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(b.cout_total_employeur)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {t(cfg.labelKey)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setShowEditor(b)} title={t('rh.tooltip_view')}
                        style={iconBtn(C)}><Eye size={12} /></button>
                      {b.statut === 'brouillon' && (
                        <button onClick={() => handleValider(b.id)} title={t('rh.tooltip_validate')}
                          style={{ ...iconBtn(C), background: `${C.blue}20`, color: C.blue, borderColor: `${C.blue}40` }}>
                          <CheckCircle size={12} />
                        </button>
                      )}
                      {b.statut === 'valide' && (
                        <button onClick={() => setShowPaiement(b)} title={t('rh.tooltip_pay')}
                          style={{ ...iconBtn(C), background: `${C.accent}20`, color: C.accent, borderColor: `${C.accent}40` }}>
                          <CreditCard size={12} />
                        </button>
                      )}
                      <button onClick={() => handleDownloadPDF(b.id, b.matricule)} title={t('rh.tooltip_pdf')}
                        style={iconBtn(C)}><Download size={12} /></button>
                      {b.statut === 'brouillon' && (
                        <button onClick={() => handleSupprimer(b.id)} title={t('rh.tooltip_delete')}
                          style={iconBtn(C)}><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showGenerer && (
        <GenererMoisModal annee={annee} mois={mois}
          onClose={() => setShowGenerer(false)}
          onDone={() => { setShowGenerer(false); fetchData(); }}
          C={C} dark={dark} />
      )}
      {showEditor && (
        <BulletinDetailModal bulletin={showEditor}
          onClose={() => setShowEditor(null)}
          onSaved={() => { setShowEditor(null); fetchData(); }}
          C={C} dark={dark} />
      )}
      {showPaiement && (
        <PaiementBulletinModal bulletin={showPaiement}
          onClose={() => setShowPaiement(null)}
          onPaid={() => { setShowPaiement(null); fetchData(); toast.success(t('rh.bulletin_paye')); }}
          C={C} dark={dark} />
      )}
    </div>
  );
}

const iconBtn = (C) => ({
  padding: '5px 7px', background: C.hover, border: `1px solid ${C.border}`,
  borderRadius: 7, cursor: 'pointer', color: C.sub,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

// ─── Modal : génération en masse ──────────────────────────────────────────
function GenererMoisModal({ annee, mois, onClose, onDone, C, dark }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState(null);

  const lancer = async () => {
    setLoading(true);
    try {
      const res = await api.post('/paie/bulletins/generer-mois', { annee: parseInt(annee), mois: parseInt(mois) });
      setResultat(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('rh.err_generic'));
    } finally { setLoading(false); }
  };

  const moisLabel = t(MOIS_KEYS[mois - 1]);

  return (
    <Modal title={t('rh.generer_title', { month: moisLabel, year: annee })} onClose={onClose} width={460}>
      {!resultat ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
            <span dangerouslySetInnerHTML={{ __html: t('rh.generer_desc_1', { month: moisLabel, year: annee }) }} />
            <br /><br />
            {t('rh.generer_desc_2')}
            <br /><br />
            {t('rh.generer_desc_3')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
            <button onClick={lancer} disabled={loading} style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: loading ? C.border : C.accent, color: loading ? C.muted : (dark ? '#000' : '#fff'),
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}>{loading ? t('rh.generer_in_progress') : t('rh.generer_start')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <CheckCircle size={42} color={C.accent} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{t('rh.generer_done')}</div>
          </div>
          <div style={{
            background: dark ? '#0D1220' : C.cardAlt, borderRadius: 10,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: C.muted }}>{t('rh.generer_crees')}</span>
              <strong style={{ color: C.accent }}>{resultat.crees}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: C.muted }}>{t('rh.generer_mis_a_jour')}</span>
              <strong style={{ color: C.blue }}>{resultat.mis_a_jour}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: C.muted }}>{t('rh.generer_ignores')}</span>
              <strong style={{ color: C.muted }}>{resultat.ignores}</strong>
            </div>
            {resultat.erreurs?.length > 0 && (
              <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>
                {t('rh.generer_errors', { count: resultat.erreurs.length })}
              </div>
            )}
          </div>
          <button onClick={onDone} style={{
            padding: '11px 0', borderRadius: 10, border: 'none',
            background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{t('rh.generer_voir_bulletins')}</button>
        </div>
      )}
    </Modal>
  );
}

// ─── Modal : édition / consultation d'un bulletin ──────────────────────────
function BulletinDetailModal({ bulletin, onClose, onSaved, C, dark }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [rubriques, setRubriques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Map des rubriques ajustables : code → montant
  const [edits, setEdits] = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/paie/bulletins/${bulletin.id}`),
      api.get('/paie/rubriques'),
    ]).then(([b, r]) => {
      setData(b.data.data);
      setRubriques(r.data.data);
      // Pré-remplit avec les montants existants des lignes (hors système salaire/cotisations)
      const e = {};
      for (const l of b.data.data.lignes || []) {
        if (l.type === 'gain' && l.code !== 'SALAIRE_BASE') e[l.code] = parseFloat(l.montant);
        if (l.type === 'retenue') e[l.code] = parseFloat(l.montant);
      }
      setEdits(e);
    }).catch(() => toast.error(t('rh.err_generic')))
      .finally(() => setLoading(false));
  }, [bulletin.id, t]);

  const handleSave = async () => {
    if (data.statut !== 'brouillon') return;
    setSaving(true);
    try {
      // Liste de rubriques à appliquer (uniquement celles avec un montant > 0)
      const rubs = Object.entries(edits)
        .filter(([, montant]) => montant && parseFloat(montant) !== 0)
        .map(([code, montant]) => ({ code, montant: parseFloat(montant) }));

      await api.post('/paie/bulletins', {
        employe_id: data.employe_id,
        annee: data.annee,
        mois: data.mois,
        rubriques: rubs,
        notes: data.notes,
      });
      toast.success(t('rh.toast_bulletin_updated'));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || t('rh.err_generic'));
    } finally { setSaving(false); }
  };

  if (loading || !data) {
    return <Modal title={t('rh.bulletin_label')} onClose={onClose} width={700}>
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('rh.loading')}</div>
    </Modal>;
  }

  const editable = data.statut === 'brouillon';
  const rubriquesAjustables = rubriques.filter(r => r.type === 'gain' || r.type === 'retenue').filter(r => r.code !== 'SALAIRE_BASE');
  const gainsRubs = rubriquesAjustables.filter(r => r.type === 'gain');
  const retenuesRubs = rubriquesAjustables.filter(r => r.type === 'retenue');

  const cfg = STATUT_CFG[data.statut];

  return (
    <Modal title={t('rh.bulletin_title', { matricule: data.matricule, month: t(MOIS_KEYS[data.mois - 1]), year: data.annee })}
      onClose={onClose} width={780}>
      {/* Bandeau statut */}
      <div style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
        padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <CheckCircle size={14} color={cfg.color} />
        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 700 }}>
          {t('rh.bulletin_statut_label', { label: t(cfg.labelKey) })}
          {!editable && t('rh.bulletin_non_modifiable')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
        {/* Colonne gauche : édition rubriques */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('rh.section_gains')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {gainsRubs.map(r => (
              <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 12, color: C.sub }}>{r.libelle}</span>
                <input
                  type="number" value={edits[r.code] || ''}
                  onChange={e => setEdits(s => ({ ...s, [r.code]: e.target.value }))}
                  disabled={!editable} placeholder="0"
                  style={{
                    width: 130, background: C.input, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
                    fontFamily: 'monospace', textAlign: 'right', outline: 'none',
                  }} />
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('rh.section_retenues')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {retenuesRubs.map(r => (
              <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 12, color: C.sub }}>{r.libelle}</span>
                <input
                  type="number" value={edits[r.code] || ''}
                  onChange={e => setEdits(s => ({ ...s, [r.code]: e.target.value }))}
                  disabled={!editable} placeholder="0"
                  style={{
                    width: 130, background: C.input, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
                    fontFamily: 'monospace', textAlign: 'right', outline: 'none',
                  }} />
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite : récap */}
        <div style={{ background: dark ? '#0D1220' : C.cardAlt, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('rh.section_recap')}
          </div>
          {[
            { l: t('rh.recap_salaire_base'), v: data.salaire_base },
            { l: t('rh.recap_brut_total'),   v: data.brut_total, gras: true },
            { l: t('rh.recap_cot_sal'),      v: -data.total_cotisations_salariales, c: C.red },
            { l: t('rh.recap_impots'),       v: -data.total_impots,                 c: C.red },
            { l: t('rh.recap_retenues'),     v: -data.total_retenues,               c: C.red },
            { l: t('rh.recap_net_payer'),    v: data.net_a_payer, gras: true, c: C.accent, taille: 14 },
            { sep: true },
            { l: t('rh.recap_charges_patron'), v: data.total_cotisations_patronales, c: C.muted },
            { l: t('rh.recap_cout_employeur'), v: data.cout_total_employeur, gras: true },
            { l: t('rh.recap_parts'),         v: data.nb_parts, mono: false },
          ].map((row, i) => row.sep ? (
            <div key={i} style={{ height: 1, background: C.border, margin: '8px 0' }} />
          ) : (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: row.taille || 12 }}>
              <span style={{ color: row.gras ? C.text : C.muted, fontWeight: row.gras ? 700 : 400 }}>{row.l}</span>
              <span style={{
                fontFamily: row.mono === false ? 'inherit' : 'monospace',
                fontWeight: row.gras ? 700 : 500,
                color: row.c || C.text,
              }}>
                {row.mono === false ? row.v : fmt(row.v)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${C.border}`,
          background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{t('rh.btn_close')}</button>
        {editable && (
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? t('rh.btn_recalc_progress') : t('rh.btn_save_recalc')}</button>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal : paiement d'un bulletin ────────────────────────────────────────
function PaiementBulletinModal({ bulletin, onClose, onPaid, C, dark }) {
  const { t } = useTranslation();
  const [comptes, setComptes] = useState([]);
  const [form, setForm] = useState({
    compte_tresorerie_id: '',
    date_paiement: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/tresorerie/comptes').then(r => setComptes(r.data.data)).catch(() => {});
  }, []);

  const handlePayer = async () => {
    setSaving(true);
    try {
      await api.post(`/paie/bulletins/${bulletin.id}/payer`, form);
      onPaid();
    } catch (err) {
      toast.error(err.response?.data?.message || t('rh.err_generic'));
    } finally { setSaving(false); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  const compteSel = comptes.find(c => c.id === form.compte_tresorerie_id);
  const ev = evaluerSortie(compteSel, bulletin.net_a_payer);
  const bloque = ev.bloquant;

  return (
    <Modal title={t('rh.paiement_title', { matricule: bulletin.matricule })} onClose={onClose} width={460}>
      <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 10,
                     padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('rh.paiement_net_label')}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, fontFamily: 'monospace' }}>
          {fmt(bulletin.net_a_payer)} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>{t('common.currency')}</span>
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
          {bulletin.employe_nom} {bulletin.employe_prenoms || ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label={t('rh.paiement_date')} type="date" value={form.date_paiement}
          onChange={e => setForm(f => ({ ...f, date_paiement: e.target.value }))} required />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('rh.paiement_compte_debite')}
          </label>
          <select value={form.compte_tresorerie_id} onChange={e => setForm(f => ({ ...f, compte_tresorerie_id: e.target.value }))}
            style={selectStyle}>
            <option value="">{t('rh.paiement_compte_auto')}</option>
            {comptes.map(c => (
              <option key={c.id} value={c.id}>{c.nom} ({fmt(c.solde_actuel)} {t('common.currency')})</option>
            ))}
          </select>
        </div>
        {compteSel && <AlerteSolde compte={compteSel} montant={bulletin.net_a_payer} />}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.cancel')}</button>
          <button onClick={handlePayer} disabled={saving || bloque} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: (saving || bloque) ? C.border : C.accent, color: (saving || bloque) ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700, cursor: (saving || bloque) ? 'not-allowed' : 'pointer',
          }}>{saving ? t('rh.paiement_in_progress') : bloque ? t('rh.paiement_balance_low') : t('rh.paiement_confirm')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET RUBRIQUES
// ═══════════════════════════════════════════════════════════════════════════
function RubriquesTab({ C, dark }) {
  const { t } = useTranslation();
  const [rubriques, setRubriques] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/paie/rubriques');
      setRubriques(res.data.data);
    } catch { toast.error(t('rh.err_generic')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const typeLibelles = {
    gain: t('rh.type_gain'),
    retenue: t('rh.type_retenue'),
    cotisation_salariale: t('rh.type_cotisation_salariale'),
    cotisation_patronale: t('rh.type_cotisation_patronale'),
    info: t('rh.type_info'),
  };
  const typeColors = {
    gain: C.accent, retenue: C.red,
    cotisation_salariale: C.purple, cotisation_patronale: C.gold,
    info: C.muted,
  };

  return (
    <div>
      <div style={{
        background: dark ? '#0D1220' : C.cardAlt, borderRadius: 12,
        padding: '14px 16px', marginBottom: 16, border: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}
          dangerouslySetInnerHTML={{ __html: t('rh.rubriques_info') }} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[t('rh.th_code'), t('rh.th_libelle'), t('rh.th_type'), t('rh.th_its'), t('rh.th_cnps'), t('rh.th_compte'), ''].map((h, idx) => (
                <th key={idx} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('rh.loading')}</td></tr>
            ) : rubriques.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>
                  {r.code}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: C.text }}>
                  {r.libelle}
                  {r.systeme && <span style={{ fontSize: 9, marginLeft: 8, padding: '1px 6px', borderRadius: 10, background: C.hover, color: C.muted }}>{t('rh.rubrique_systeme')}</span>}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                                background: `${typeColors[r.type]}20`, color: typeColors[r.type] }}>
                    {typeLibelles[r.type] || r.type}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {r.imposable_its
                    ? <CheckCircle size={12} color={C.accent} />
                    : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {r.cotisable_cnps
                    ? <CheckCircle size={12} color={C.accent} />
                    : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{r.compte_pc_numero || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted }}>{r.systeme ? '' : t('rh.rubrique_editable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════
function StatsTab({ C, dark }) {
  const { t, i18n } = useTranslation();
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/paie/stats?annee=${annee}`)
      .then(r => setStats(r.data.data))
      .catch(() => toast.error(t('rh.err_generic')))
      .finally(() => setLoading(false));
  }, [annee, t]);

  if (loading || !stats) return <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>{t('rh.loading')}</div>;

  const numberLocale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
  const currency = t('common.currency');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {t('rh.annee_exercice')}
        </span>
        <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }}>
        {[
          { label: t('rh.stats_effectif'),       val: stats.effectif,      unit: '',       icon: Users,        color: C.blue },
          { label: t('rh.stats_masse_salariale'), val: stats.total_brut,    unit: currency, icon: TrendingUp,   color: C.accent },
          { label: t('rh.stats_net_verse'),      val: stats.total_net,     unit: currency, icon: Wallet,       color: C.gold },
          { label: t('rh.stats_cout_total'),     val: stats.cout_total,    unit: currency, icon: AlertCircle,  color: C.red },
          { label: t('rh.stats_cot_sal'),        val: stats.total_cot_sal, unit: currency, icon: Receipt,      color: C.purple },
          { label: t('rh.stats_cot_pat'),        val: stats.total_cot_pat, unit: currency, icon: Receipt,      color: C.purple },
          { label: t('rh.stats_impots'),         val: stats.total_impots,  unit: currency, icon: BarChart3,    color: C.red },
          { label: t('rh.stats_bulletins_emis'), val: stats.nb_bulletins,  unit: '',       icon: FileText,     color: C.blue },
        ].map((k, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', boxShadow: C.shadow, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 50, height: 50, background: `radial-gradient(circle at top right, ${k.color}25, transparent 70%)`, borderRadius: '0 14px 0 50px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{k.label}</span>
              <k.icon size={14} color={k.color} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
              {new Intl.NumberFormat(numberLocale).format(Math.round(k.val))}
              {k.unit && <span style={{ fontSize: 9, color: C.muted, fontWeight: 400, marginLeft: 4 }}>{k.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tableau évolution mensuelle */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t('rh.evolution_mensuelle', { year: annee })}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
              {[t('rh.th_mois'), t('rh.th_brut_total'), t('rh.th_net_verse'), t('rh.th_cout_employeur')].map((h, idx) => (
                <th key={idx} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.par_mois.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('rh.no_bulletin_year')}</td></tr>
            ) : stats.par_mois.map(m => (
              <tr key={m.mois} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: C.text }}>{t(MOIS_KEYS[parseInt(m.mois) - 1])} {annee}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: C.accent }}>{fmt(m.brut)}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: C.gold }}>{fmt(m.net)}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: C.red }}>{fmt(m.cout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
