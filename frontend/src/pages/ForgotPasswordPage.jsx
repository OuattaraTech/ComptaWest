import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import LogoApex from '../components/LogoApex.jsx';
import api from '../utils/api.jsx';

/**
 * « Mot de passe oublié » — page publique servie à /mot-de-passe-oublie.
 * Demande l'email puis poste /auth/forgot-password. La réponse backend est
 * toujours neutre (anti-énumération) : on affiche donc systématiquement un
 * message « vérifiez votre boîte mail ».
 */
export default function ForgotPasswordPage() {
  const { dark } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const C = getC(dark);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const inkSurAccent = dark ? '#04140F' : '#FFFFFF';

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setStatus('loading');
    try {
      await api.post('/auth/forgot-password', { email });
    } catch (_) { /* réponse neutre côté serveur, on ignore */ }
    setStatus('done');
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: C.input, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '13px 15px',
    color: C.text, fontSize: 14.5, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px clamp(16px, 5vw, 40px)',
      fontFamily: '"Satoshi", "Cabinet Grotesk", system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <LogoApex height={40} textColor={C.text} textSize={19} gap={10}
            fallback={<div style={{ width: 40, height: 40, borderRadius: 11, background: C.accent, color: inkSurAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800 }}>₣</div>} />
        </div>

        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 18, padding: '32px 28px',
          boxShadow: dark ? '0 20px 50px rgba(0,0,0,0.45)' : '0 16px 40px -8px rgba(14,17,22,0.12)',
        }}>
          {status === 'done' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: `${C.accent}22`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={28} strokeWidth={2} />
              </div>
              <h1 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 10px 0', color: C.text }}>{t('login.forgot_done_title')}</h1>
              <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.6, margin: 0 }}>{t('login.forgot_done_text')}</p>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0', color: C.text, letterSpacing: '-0.02em' }}>{t('login.forgot_title')}</h1>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: '0 0 22px 0' }}>{t('login.forgot_subtitle')}</p>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.email')} style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = C.accent; }}
                  onBlur={(e) => { e.target.style.borderColor = C.border; }} />
                <button type="submit" disabled={status === 'loading'} style={{
                  padding: '13px 0', borderRadius: 12, border: 'none',
                  background: C.accent, color: inkSurAccent,
                  fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                  cursor: status === 'loading' ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: status === 'loading' ? 0.7 : 1,
                }}>
                  <Mail size={16} strokeWidth={2} />
                  {status === 'loading' ? t('login.forgot_sending') : t('login.forgot_submit')}
                </button>
              </form>
            </>
          )}

          <button onClick={() => navigate('/login')} style={{
            marginTop: 22, width: '100%', background: 'transparent', border: 'none',
            color: C.muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontFamily: 'inherit',
          }}>
            <ArrowLeft size={14} /> {t('login.forgot_back')}
          </button>
        </div>
      </div>
    </div>
  );
}
