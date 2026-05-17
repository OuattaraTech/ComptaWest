import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC } from '../components/UI.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { Shield, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

// Listes : la valeur reste le code interne, le libellé est résolu via t().
const ENTITES = ['', 'factures', 'depenses', 'taxes', 'clients', 'membres', 'entreprises', 'auth'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'PAY', 'LOGIN_OK', 'LOGIN_FAIL', 'INVITE', 'REVOKE', 'ROLE_CHANGE'];

const ACTION_COULEURS = {
  CREATE:      '#00D4AA',
  UPDATE:      '#4E8BF5',
  DELETE:      '#FF5C6B',
  PAY:         '#A855F7',
  LOGIN_OK:    '#00D4AA',
  LOGIN_FAIL:  '#FF5C6B',
  INVITE:      '#4E8BF5',
  REVOKE:      '#FF5C6B',
  ROLE_CHANGE: '#F5A623',
};

export default function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);

  // Plus de check de rôle local : la matrice (audit_log.read = admin + EC +
  // auditeur + propriétaire) est appliquée en amont via PermissionGate dans
  // App.jsx. Tout rôle qui arrive ici peut lire.

  const labelAction = (a) => a ? (i18n.exists(`audit.actions.${a}`) ? t(`audit.actions.${a}`) : a) : t('audit.actions.all');
  const labelEntite = (e) => e ? (i18n.exists(`audit.entites.${e}`) ? t(`audit.entites.${e}`) : e) : t('audit.entites.all');

  const formatDateTime = (d) => {
    if (!d) return '—';
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
    return new Date(d).toLocaleString(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [filtres, setFiltres] = useState({ entite: '', action: '', date_debut: '', date_fin: '' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      Object.entries(filtres).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await api.get(`/audit-log?${params.toString()}`);
      setLogs(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('audit.error_load'));
    } finally {
      setLoading(false);
    }
  }, [page, filtres, t]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const updateFiltre = (k) => (e) => {
    setPage(1);
    setFiltres(f => ({ ...f, [k]: e.target.value }));
  };

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer',
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} color={C.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>
              {t('audit.title')}
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              {t(pagination.total > 1 ? 'audit.count_other' : 'audit.count_one', { count: pagination.total })}
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div data-onboarding="filtres" style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 18px', marginBottom: 20, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Filter size={14} color={C.muted} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('audit.filters')}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <select value={filtres.entite} onChange={updateFiltre('entite')} style={selectStyle}>
            {ENTITES.map(v => <option key={v} value={v}>{t('audit.entity_prefix', { label: labelEntite(v) })}</option>)}
          </select>
          <select value={filtres.action} onChange={updateFiltre('action')} style={selectStyle}>
            {ACTIONS.map(v => <option key={v} value={v}>{t('audit.action_prefix', { label: labelAction(v) })}</option>)}
          </select>
          <input type="date" value={filtres.date_debut} onChange={updateFiltre('date_debut')} style={selectStyle} />
          <input type="date" value={filtres.date_fin} onChange={updateFiltre('date_fin')} style={selectStyle} />
        </div>
      </div>

      {/* Tableau */}
      <div data-onboarding="journal" style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: 'hidden', boxShadow: C.shadow,
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            {t('common.loading')}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            {t('audit.no_results')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  <th style={th(C)}>{t('audit.col_date')}</th>
                  <th style={th(C)}>{t('audit.col_user')}</th>
                  <th style={th(C)}>{t('audit.col_action')}</th>
                  <th style={th(C)}>{t('audit.col_entity')}</th>
                  <th style={th(C)}>{t('audit.col_details')}</th>
                  <th style={th(C)}>{t('audit.col_ip')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={td(C)}>
                      <div style={{ color: C.text, fontWeight: 600 }}>{formatDate(log.created_at)}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>{formatDateTime(log.created_at).split(' ').pop()}</div>
                    </td>
                    <td style={td(C)}>
                      <div style={{ color: C.text, fontWeight: 600 }}>
                        {log.utilisateur_nom || '—'}
                      </div>
                      <div style={{ color: C.muted, fontSize: 10 }}>
                        {log.utilisateur_email || ''}
                      </div>
                    </td>
                    <td style={td(C)}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                        background: `${ACTION_COULEURS[log.action] || C.muted}22`,
                        color: ACTION_COULEURS[log.action] || C.muted,
                        whiteSpace: 'nowrap',
                      }}>{labelAction(log.action)}</span>
                    </td>
                    <td style={{ ...td(C), color: C.sub }}>{labelEntite(log.entite)}</td>
                    <td style={{ ...td(C), maxWidth: 360 }}>
                      {log.details ? (
                        <code style={{
                          fontSize: 10, color: C.sub, fontFamily: 'ui-monospace, monospace',
                          background: C.cardAlt, padding: '3px 6px', borderRadius: 4,
                          display: 'inline-block', maxWidth: '100%',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{JSON.stringify(log.details)}</code>
                      ) : <span style={{ color: C.muted }}>—</span>}
                    </td>
                    <td style={{ ...td(C), color: C.muted, fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>
                      {log.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px', borderTop: `1px solid ${C.border}`, background: C.cardAlt,
          }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              {t('common.page')} {page} {t('common.of')} {pagination.pages}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={pagBtn(C, page === 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                style={pagBtn(C, page === pagination.pages)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Onboarding pageKey="audit-log" />
    </div>
  );
}

const th = (C) => ({
  textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700,
  color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
});

const td = (C) => ({
  padding: '10px 14px', color: C.text, verticalAlign: 'top',
});

const pagBtn = (C, disabled) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
  background: 'transparent', color: disabled ? C.muted : C.text,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
});
