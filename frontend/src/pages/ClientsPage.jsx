import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate, initiales, truncate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Input, Modal } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { Can, ReadOnlyBanner } from '../components/Can.jsx';
import { Plus, Search, Trash2, Phone, Mail, MapPin, FileText } from 'lucide-react';

const PAYS = ["Côte d'Ivoire","Sénégal","Mali","Burkina Faso","Guinée","Togo","Bénin","Niger","Cameroun","France"];

const emptyForm = {
  nom: '', email: '', telephone: '', adresse: '', ville: '',
  pays: "Côte d'Ivoire", ninea: '', rccm: '', notes: '', type: 'entreprise',
};

export default function ClientsPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clients?search=${search}&page=${page}&limit=15`);
      setClients(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error(t('clients.error_load')); }
    finally { setLoading(false); }
  }, [search, page, t]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/clients', form);
      toast.success(t('clients.created'));
      setShowModal(false); setForm(emptyForm); fetchClients();
    } catch (err) { toast.error(err.response?.data?.message || t('common.error_generic')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('clients.confirm_archive'))) return;
    try { await api.delete(`/clients/${id}`); toast.success(t('clients.archived')); fetchClients(); }
    catch { toast.error(t('clients.error_delete')); }
  };

  const openDetail = async (id) => {
    try { const res = await api.get(`/clients/${id}`); setShowDetail(res.data.data); }
    catch { toast.error(t('clients.error_load_one')); }
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%',
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('clients.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {t(pagination.total > 1 ? 'clients.count_other' : 'clients.count_one', { count: pagination.total })}
          </p>
        </div>
        <Can module="clients" action="create">
          <button data-onboarding="btn-nouveau" onClick={() => { setForm(emptyForm); setShowModal(true); }} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10,
            border: 'none', background: C.accent, color: dark ? '#000' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={16} /> {t('clients.new')}
          </button>
        </Can>
      </div>

      <ReadOnlyBanner module="clients" />

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 380 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('clients.search_placeholder')}
          style={{
            width: '100%', background: C.card, border: `1.5px solid ${C.border}`,
            borderRadius: 10, padding: '10px 12px 10px 36px', color: C.text, fontSize: 13,
            outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.border}
        />
      </div>

      {/* Table */}
      <div data-onboarding="liste-clients" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('clients.col_client'),
                t('clients.col_contact'),
                t('clients.col_city'),
                t('clients.col_invoices'),
                t('clients.col_revenue'),
                t('clients.col_pending'),
                t('common.actions'),
              ].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {search ? t('clients.no_results') : t('clients.empty')}
              </td></tr>
            ) : clients.map(c => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.accent}70, ${C.blue}70)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: dark ? '#000' : '#fff',
                    }}>{initiales(c.nom)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{truncate(c.nom, 25)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{c.code} · {c.type}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, color: C.sub }}>{c.email || '—'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{c.telephone || '—'}</div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: C.sub }}>{c.ville || '—'}</td>
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{c.nb_factures}</td>
                <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{formatFCFA(c.ca_total, true)}</td>
                <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: parseFloat(c.encours) > 0 ? C.gold : C.muted }}>
                  {parseFloat(c.encours) > 0 ? formatFCFA(c.encours, true) : '—'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openDetail(c.id)} style={{ padding: '6px 8px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.sub }}>
                      <FileText size={13} />
                    </button>
                    <Can module="clients" action="delete">
                      <button onClick={() => handleDelete(c.id)} style={{ padding: '6px 8px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.muted }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>
                        <Trash2 size={13} />
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: dark ? 'transparent' : C.cardAlt }}>
            <span style={{ fontSize: 12, color: C.muted }}>{t('common.page')} {page} {t('common.of')} {pagination.pages}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} style={{
                  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${page === i + 1 ? C.accent : C.border}`,
                  background: page === i + 1 ? `${C.accent}15` : 'transparent',
                  color: page === i + 1 ? C.accent : C.muted,
                }}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal création */}
      {showModal && (
        <Modal title={t('clients.new')} onClose={() => { setShowModal(false); setForm(emptyForm); }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'entreprise',  label: t('clients.type_company')   },
                { v: 'particulier', label: t('clients.type_individual')},
              ].map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${form.type === v ? C.accent : C.border}`,
                  background: form.type === v ? `${C.accent}15` : 'transparent',
                  color: form.type === v ? C.accent : C.muted, transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>
            <Input label={t('clients.field_name')} value={form.nom} onChange={set('nom')} placeholder="SARL Konan & Fils" required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('common.email')} type="email" value={form.email} onChange={set('email')} placeholder="contact@exemple.ci" />
              <Input label={t('common.phone')} value={form.telephone} onChange={set('telephone')} placeholder="+225 07 00 00 00" />
            </div>
            <Input label={t('common.address')} value={form.adresse} onChange={set('adresse')} placeholder="Rue des Jardins, Cocody" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('common.city')} value={form.ville} onChange={set('ville')} placeholder="Abidjan" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.country')}</label>
                <select value={form.pays} onChange={set('pays')} style={selectStyle}>
                  {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {form.type === 'entreprise' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="NINEA / NIF" value={form.ninea} onChange={set('ninea')} placeholder="CI-2024-A-12345" />
                <Input label="RCCM" value={form.rccm} onChange={set('rccm')} placeholder="RCC/ABC/2024/..." />
              </div>
            )}
            <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => { setShowModal(false); setForm(emptyForm); }} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t('common.cancel')}</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? t('common.saving') : t('clients.create_button')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Onboarding pageKey="clients" />

      {/* Modal détail */}
      {showDetail && (
        <Modal title={showDetail.nom} onClose={() => setShowDetail(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: Mail,    label: showDetail.email || '—' },
                { icon: Phone,   label: showDetail.telephone || '—' },
                { icon: MapPin,  label: [showDetail.ville, showDetail.pays].filter(Boolean).join(', ') || '—' },
                { icon: FileText, label: showDetail.ninea ? t('clients.ninea_label', { value: showDetail.ninea }) : t('clients.ninea_empty') },
              ].map(({ icon: Icon, label }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.hover, padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.border}` }}>
                  <Icon size={13} color={C.muted} />
                  <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
                </div>
              ))}
            </div>
            {showDetail.factures?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('clients.recent_invoices')}</div>
                {showDetail.factures.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: C.text }}>{f.numero}</span>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{formatDate(f.date_emission)}</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{formatFCFA(f.total_ttc, true)} {t('common.currency')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}