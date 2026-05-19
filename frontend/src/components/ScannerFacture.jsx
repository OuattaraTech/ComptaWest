import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Upload, Loader2, CheckCircle, X, AlertTriangle } from 'lucide-react';
import api from '../utils/api.jsx';
import { getC, Modal } from './UI.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import toast from 'react-hot-toast';

// Compresse l'image côté navigateur avant envoi : la plupart des photos de
// factures prises au téléphone font 3–5 MB en JPEG natif, on peut diviser
// par 4 sans perdre en lisibilité OCR (1600px de largeur suffit largement).
async function compresserImage(file, maxLargeur = 1600, qualite = 0.8) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  // Si l'image est déjà petite, on ne touche pas
  if (img.width <= maxLargeur) return { dataUrl, mime: file.type || 'image/jpeg' };
  const ratio = maxLargeur / img.width;
  const canvas = document.createElement('canvas');
  canvas.width = maxLargeur;
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/jpeg', qualite), mime: 'image/jpeg' };
}

/**
 * Modale de scan : sélection (ou capture) d'une image → OCR → affichage des
 * champs extraits que l'utilisateur peut valider avant de pré-remplir le
 * formulaire parent via `onExtraction(data)`.
 */
export default function ScannerFacture({ open, onClose, onExtraction }) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [resultat, setResultat] = useState(null);

  const reset = () => { setPreview(null); setResultat(null); setAnalyzing(false); };

  const handleFichier = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('ocr.error_type'));
      return;
    }
    setResultat(null);
    setAnalyzing(true);
    try {
      const { dataUrl, mime } = await compresserImage(file);
      setPreview(dataUrl);
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      const res = await api.post('/ocr/scanner', { image_base64: base64, mime_type: mime });
      setResultat(res.data.data);
      if (res.data.data.mode === 'mock' || res.data.data.mode === 'mock_fallback') {
        toast(t('ocr.toast_mock_mode'), { icon: 'ℹ️' });
      } else {
        toast.success(t('ocr.toast_success'));
      }
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('ocr.error_generic'));
      setResultat(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const utiliser = () => {
    if (!resultat) return;
    onExtraction(resultat);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      title={t('ocr.title')}
      onClose={() => { reset(); onClose(); }}
      width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 11,
          padding: '12px 14px', fontSize: 12, color: C.sub, lineHeight: 1.55,
        }}>
          {t('ocr.intro')}
        </div>

        {/* Zone de dépôt / capture */}
        {!preview && !analyzing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFichier}
              style={{ display: 'none' }}
            />
            <button onClick={() => inputRef.current?.click()} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '36px 20px', borderRadius: 14,
              border: `2px dashed ${C.border}`, background: C.input,
              cursor: 'pointer', color: C.text, fontSize: 13, fontWeight: 600,
            }}>
              <Camera size={32} color={C.accent} />
              {t('ocr.btn_capture')}
              <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>
                {t('ocr.formats_hint')}
              </span>
            </button>
          </div>
        )}

        {/* Phase analyse */}
        {analyzing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <Loader2 size={32} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t('ocr.analyzing')}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{t('ocr.analyzing_hint')}</div>
          </div>
        )}

        {/* Bandeau « mode démo » — affiché de manière visible avant le
            résultat pour que l'utilisateur sache tout de suite que les
            valeurs lues ne sortent pas de sa pièce. Le service OCR est
            activé au niveau de l'abonnement (clé MISTRAL_API_KEY côté
            serveur) ; quand il sera configuré, ce bandeau disparaît. */}
        {resultat && !analyzing && (resultat.mode === 'mock' || resultat.mode === 'mock_fallback') && (
          <div style={{
            background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 11,
            padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={16} color={C.gold} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}>
              {t('ocr.notice_mock')}
            </div>
          </div>
        )}

        {/* Aperçu + résultat */}
        {resultat && !analyzing && (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16 }}>
            <div style={{
              borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`,
              background: '#fff', maxHeight: 220,
            }}>
              {preview && <img src={preview} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <Champ label={t('ocr.field_fournisseur')} value={resultat.fournisseur_nom || '—'} C={C} />
              <Champ label={t('ocr.field_date')}        value={resultat.date || '—'} C={C} />
              <Champ label={t('ocr.field_numero')}      value={resultat.numero || '—'} C={C} />
              <Champ label={t('ocr.field_ht')}          value={`${(resultat.montant_ht || 0).toLocaleString('fr-FR')} ${resultat.devise || 'XOF'}`} C={C} />
              <Champ label={t('ocr.field_tva')}         value={`${(resultat.montant_tva || 0).toLocaleString('fr-FR')} (${resultat.taux_tva}%)`} C={C} />
              <Champ label={t('ocr.field_ttc')}         value={`${(resultat.montant_ttc || 0).toLocaleString('fr-FR')} ${resultat.devise || 'XOF'}`} C={C} highlight />
              {resultat.mode !== 'mock' && resultat.mode !== 'mock_fallback' && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={12} color={C.accent} /> {t('ocr.confidence', { value: Math.round((resultat.confiance || 0) * 100) })}
                </div>
              )}
            </div>
          </div>
        )}

        {resultat && !analyzing && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={reset} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Upload size={14} /> {t('ocr.btn_retry')}
            </button>
            <button onClick={utiliser} style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <CheckCircle size={14} /> {t('ocr.btn_use')}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </Modal>
  );
}

function Champ({ label, value, C, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: highlight ? 14 : 12, fontWeight: highlight ? 800 : 600,
        color: highlight ? C.accent : C.text, textAlign: 'right', wordBreak: 'break-word',
      }}>{value}</span>
    </div>
  );
}
