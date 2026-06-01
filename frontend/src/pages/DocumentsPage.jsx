import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Upload, Download, FileText, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { getC } from '../components/UI.jsx';
import api from '../utils/api.jsx';

const fontDisplay = '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif';
const fmtTaille = (o) => o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(o / 1024)} Ko`;

/**
 * Documents demandés par le cabinet comptable — page PME (/documents).
 * La PME voit les pièces réclamées et les téléverse (glisser-déposer / clic).
 */
export default function DocumentsPage() {
  const { dark } = useTheme();
  const { t } = useTranslation();
  const { actuelle } = useEntreprise();
  const C = getC(dark);

  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadId, setUploadId] = useState(null);
  const inputs = useRef({});

  const charger = useCallback(() => {
    setLoading(true);
    api.get('/documents/demandes')
      .then(r => setDemandes(r.data.data || []))
      .catch(() => setDemandes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger, actuelle?.id]);

  const STATUTS = {
    demande: { label: t('documents.statut_demande'), color: C.gold,   icon: Clock },
    fourni:  { label: t('documents.statut_fourni'),  color: C.blue,   icon: FileText },
    valide:  { label: t('documents.statut_valide'),  color: C.accent, icon: CheckCircle2 },
    refuse:  { label: t('documents.statut_refuse'),  color: C.red,    icon: AlertTriangle },
  };

  const televerser = async (demandeId, file) => {
    if (!file) return;
    setUploadId(demandeId);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      await api.post(`/documents/demandes/${demandeId}/fichier`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('documents.upload_ok'));
      charger();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('documents.upload_err'));
    } finally {
      setUploadId(null);
    }
  };

  const telecharger = async (fichier) => {
    try {
      const res = await api.get(`/documents/fichiers/${fichier.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = fichier.nom_fichier;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t('documents.download_err'));
    }
  };

  const enAttente = demandes.filter(d => d.statut === 'demande' || d.statut === 'refuse').length;

  return (
    <div style={{ padding: '32px clamp(16px, 4vw, 36px)', minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: `${C.accent}1F`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderOpen size={24} />
          </div>
          <div>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{t('documents.title')}</h1>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{t('documents.subtitle')}</div>
          </div>
        </div>

        {enAttente > 0 && (
          <div style={{ margin: '18px 0 8px', padding: '11px 15px', borderRadius: 10, background: `${C.gold}14`, border: `1px solid ${C.gold}50`, fontSize: 13.5, color: C.text }}>
            <strong>{t('documents.en_attente', { count: enAttente })}</strong>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>{t('documents.loading')}</div>
        ) : demandes.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', color: C.muted }}>
            <FolderOpen size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.sub }}>{t('documents.vide_titre')}</div>
            <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>{t('documents.vide_texte')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {demandes.map((d) => {
              const st = STATUTS[d.statut] || STATUTS.demande;
              const Icon = st.icon;
              const peutEnvoyer = d.statut === 'demande' || d.statut === 'refuse';
              return (
                <div key={d.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{d.libelle}</span>
                        {d.periode && <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{d.periode}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                        {t('documents.demande_par', { cabinet: d.cabinet_nom })}
                        {d.note && <> · <span style={{ fontStyle: 'italic' }}>{d.note}</span></>}
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, background: `${st.color}1A`, color: st.color, fontSize: 12, fontWeight: 700 }}>
                      <Icon size={13} /> {st.label}
                    </span>
                  </div>

                  {/* Fichiers déjà déposés */}
                  {(d.fichiers || []).length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {d.fichiers.map((f) => (
                        <button key={f.id} onClick={() => telecharger(f)} style={{
                          display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px',
                          background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                          cursor: 'pointer', textAlign: 'left', color: C.text, fontSize: 13,
                        }}>
                          <FileText size={15} color={C.muted} />
                          <span style={{ flex: 1 }}>{f.nom_fichier}</span>
                          {f.taille_octets ? <span style={{ fontSize: 11, color: C.muted }}>{fmtTaille(f.taille_octets)}</span> : null}
                          <Download size={14} color={C.accent} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Téléversement */}
                  {peutEnvoyer && (
                    <div style={{ marginTop: 12 }}>
                      <input ref={(el) => (inputs.current[d.id] = el)} type="file" style={{ display: 'none' }}
                        onChange={(e) => { televerser(d.id, e.target.files?.[0]); e.target.value = ''; }} />
                      <button onClick={() => inputs.current[d.id]?.click()} disabled={uploadId === d.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '9px 16px', borderRadius: 9, border: 'none',
                        background: C.accent, color: dark ? '#04140F' : '#FFFFFF',
                        fontSize: 13.5, fontWeight: 700, cursor: uploadId === d.id ? 'wait' : 'pointer',
                      }}>
                        <Upload size={15} />
                        {uploadId === d.id ? t('documents.upload_en_cours') : t('documents.deposer')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
