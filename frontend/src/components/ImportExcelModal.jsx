import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from './UI.jsx';
import toast from 'react-hot-toast';
import {
  Upload, X, Download, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Loader, ChevronRight, RotateCcw,
} from 'lucide-react';

/**
 * Modale d'import en masse depuis Excel / CSV.
 *
 * Props :
 *   - type     : 'clients' | 'fournisseurs' | 'produits'
 *   - open     : booléen d'ouverture
 *   - onClose  : callback fermeture
 *   - onDone   : callback après commit réussi (typiquement re-fetch de la liste)
 *
 * Workflow : sélection fichier → POST dry_run=true → affichage rapport →
 * confirmation → POST dry_run=false → toast succès + onDone(). Le mode
 * preview permet de voir les erreurs ligne par ligne avant tout INSERT.
 */
export default function ImportExcelModal({ type, open, onClose, onDone }) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const inputRef = useRef(null);
  const [fichier, setFichier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [rapport, setRapport] = useState(null);  // résultat dry-run
  const [committed, setCommitted] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFichier(null); setRapport(null); setCommitted(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fermer = () => { reset(); onClose(); };

  // 1ʳᵉ requête : on uploade en dry-run pour récupérer l'aperçu + les erreurs.
  // Une fois validé visuellement par l'utilisateur, on relance en commit.
  const envoyer = async (dryRun) => {
    if (!fichier) return;
    setChargement(true);
    try {
      const form = new FormData();
      form.append('fichier', fichier);
      const res = await api.post(
        `/import/${type}?dry_run=${dryRun}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (dryRun) {
        setRapport(res.data.data);
      } else {
        setCommitted(true);
        toast.success(t('imports.toast_done', { count: res.data.data.ok_count }));
        onDone?.();
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('imports.error_generic');
      toast.error(msg);
      if (err.response?.data?.data?.erreurs) {
        // Garde l'aperçu d'erreurs même en cas de 400
        setRapport(prev => ({ ...(prev || {}), erreurs: err.response.data.data.erreurs, dry_run: true, ok_count: 0 }));
      }
    } finally {
      setChargement(false);
    }
  };

  const telechargerModele = async () => {
    try {
      const res = await api.get(`/import/template/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `modele_${type}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('imports.error_template'));
    }
  };

  const onChooseFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichier(f);
    setRapport(null);
    setCommitted(false);
  };

  return (
    <div onClick={fermer} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={dialogStyle(C, dark)}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              {t(`imports.title_${type}`)}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.55, maxWidth: 480 }}>
              {t(`imports.subtitle_${type}`)}
            </div>
          </div>
          <button onClick={fermer} style={btnIcon(C)}><X size={18} /></button>
        </div>

        {/* Étape 1 : choix du fichier */}
        {!fichier && !committed && (
          <div>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.accent; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = C.border; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = C.border;
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFichier(f);
                }
              }}
              style={{
                border: `2px dashed ${C.border}`, borderRadius: 14,
                padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.2s',
                background: dark ? '#0D1220' : '#F8FAFC',
              }}>
              <Upload size={32} color={C.accent} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {t('imports.drop_zone_title')}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {t('imports.drop_zone_help')}
              </div>
            </div>
            <input
              ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={onChooseFile} style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 }}>
              <button type="button" onClick={telechargerModele} style={btnSecondary(C)}>
                <Download size={14} /> {t('imports.download_template')}
              </button>
              <div style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>
                {t('imports.formats_supported')}
              </div>
            </div>
          </div>
        )}

        {/* Étape 2 : fichier sélectionné, dry-run pas encore lancé */}
        {fichier && !rapport && !committed && (
          <div>
            <FichierBadge fichier={fichier} C={C} onClear={reset} />
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={reset} style={btnSecondary(C)}>
                {t('imports.change_file')}
              </button>
              <button type="button" onClick={() => envoyer(true)} disabled={chargement} style={btnPrimary(C, dark)}>
                {chargement ? <Loader size={14} className="cw-spin" /> : <ChevronRight size={14} />}
                {chargement ? t('imports.analysing') : t('imports.analyse_file')}
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 : rapport dry-run affiché */}
        {rapport && !committed && (
          <div>
            <FichierBadge fichier={fichier} C={C} onClear={reset} />

            {/* Synthèse chiffrée */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
              marginTop: 16,
            }}>
              <StatCard C={C} value={rapport.total_lignes ?? 0} label={t('imports.stat_total')} />
              <StatCard C={C} value={rapport.ok_count ?? 0} label={t('imports.stat_ok')} positive />
              <StatCard C={C} value={rapport.erreurs_count ?? rapport.erreurs?.length ?? 0} label={t('imports.stat_errors')} negative={(rapport.erreurs_count ?? 0) > 0} />
            </div>

            {/* Liste d'erreurs détaillées */}
            {rapport.erreurs && rapport.erreurs.length > 0 && (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 10,
                background: `${C.red || '#E0606E'}15`,
                border: `1px solid ${C.red || '#E0606E'}40`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, fontSize: 12, fontWeight: 700, color: C.red || '#E0606E' }}>
                  <AlertTriangle size={13} />
                  {t('imports.errors_to_fix', { count: rapport.erreurs.length })}
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 11.5, color: C.text }}>
                  {rapport.erreurs.slice(0, 50).map((err, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '50px 100px 1fr', gap: 8,
                      padding: '4px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}33`,
                    }}>
                      <span style={{ fontFamily: 'monospace', color: C.muted }}>L{err.ligne_excel}</span>
                      <span style={{ color: C.sub, fontWeight: 600 }}>{err.champ}</span>
                      <span style={{ color: C.text }}>{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aperçu (10 premières lignes valides) */}
            {rapport.apercu && rapport.apercu.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  {t('imports.preview_title', { count: rapport.apercu.length })}
                </div>
                <div style={{
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  overflow: 'auto', maxHeight: 240,
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        {Object.keys(rapport.apercu[0]).map(k => (
                          <th key={k} style={{
                            padding: '8px 10px', textAlign: 'left',
                            background: dark ? '#0D1220' : '#F1F5F9',
                            color: C.muted, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontSize: 10, borderBottom: `1px solid ${C.border}`,
                            whiteSpace: 'nowrap',
                          }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.apercu.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(rapport.apercu[0]).map(k => (
                            <td key={k} style={{
                              padding: '6px 10px', color: C.text,
                              borderTop: `1px solid ${C.border}33`,
                              whiteSpace: 'nowrap',
                            }}>{row[k] ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={reset} style={btnSecondary(C)}>
                <RotateCcw size={13} /> {t('imports.restart')}
              </button>
              <button type="button" onClick={() => envoyer(false)}
                disabled={chargement || (rapport.erreurs_count ?? 0) > 0 || (rapport.ok_count ?? 0) === 0}
                style={btnPrimary(C, dark, (rapport.erreurs_count ?? 0) > 0 || (rapport.ok_count ?? 0) === 0)}>
                {chargement ? <Loader size={14} className="cw-spin" /> : <CheckCircle2 size={14} />}
                {chargement ? t('imports.importing') : t('imports.confirm_import', { count: rapport.ok_count ?? 0 })}
              </button>
            </div>
          </div>
        )}

        {/* Étape 4 : import réussi */}
        {committed && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: `${C.accent}20`, color: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <CheckCircle2 size={32} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              {t('imports.success_title')}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              {t('imports.success_subtitle', { count: rapport?.ok_count ?? 0 })}
            </div>
            <button type="button" onClick={fermer} style={btnPrimary(C, dark)}>
              {t('common.close')}
            </button>
          </div>
        )}

        {/* CSS animations */}
        <style>{`
          @keyframes cw-spin { to { transform: rotate(360deg); } }
          .cw-spin { animation: cw-spin 0.9s linear infinite; }
        `}</style>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────
function FichierBadge({ fichier, C, onClear }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      background: `${C.accent}10`, border: `1px solid ${C.accent}40`,
    }}>
      <FileSpreadsheet size={18} color={C.accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fichier.name}
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {(fichier.size / 1024).toFixed(1)} Ko
        </div>
      </div>
      <button onClick={onClear} style={{
        background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 4,
      }}><X size={14} /></button>
    </div>
  );
}

function StatCard({ C, value, label, positive, negative }) {
  const color = negative ? '#E0606E' : positive ? C.accent : C.text;
  return (
    <div style={{
      background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '14px 12px',
    }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 22, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{label}</div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};

const dialogStyle = (C, dark) => ({
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
  padding: 28, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.55)' : '0 16px 40px rgba(14,17,22,0.15)',
});

const btnIcon = (C) => ({
  background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 6,
});

const btnPrimary = (C, dark, disabled = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '11px 20px', borderRadius: 10, border: 'none',
  background: disabled ? C.border : C.accent,
  color: disabled ? C.muted : (dark ? '#000' : '#fff'),
  fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
});

const btnSecondary = (C) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '10px 16px', borderRadius: 10,
  border: `1px solid ${C.border}`, background: 'transparent',
  color: C.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
});
