import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowLeft, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import LogoApex from '../components/LogoApex.jsx';
import api from '../utils/api.jsx';

/**
 * Réinitialisation du mot de passe — page publique servie à /reset-password.
 * Le jeton arrive en query (?token=…) depuis le lien email. Poste
 * /auth/reset-password { token, mot_de_passe } puis renvoie vers /login.
 */
export default function ResetPasswordPage() {
  const { dark } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const C = getC(dark);

  const token = params.get('token') || '';
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const inkSurAccent = dark ? '#04140F' : '#FFFFFF';

  const submit = async (e) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error(t('login.reset_too_short'));
    if (pwd !== confirm) return toast.error(t('login.reset_mismatch'));
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, mot_de_passe: pwd });
      toast.success(t('login.reset_success'));
      navigate('/login');
    } catch (err) {
      toast.error(err?.response?.data?.message || t('login.reset_error'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: C.input, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '13px 15px',
    color: C.text, fontSize: 14.5, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };
  const onFocus = (e) => { e.target.style.borderColor = C.accent; };
  const onBlur = (e) => { e.target.style.borderColor = C.border; };

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
          {!token ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: `${C.red}1F`, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} strokeWidth={2} />
              </div>
              <h1 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 10px 0', color: C.text }}>{t('login.reset_no_token_title')}</h1>
              <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.6, margin: '0 0 20px 0' }}>{t('login.reset_no_token_text')}</p>
              <button onClick={() => navigate('/mot-de-passe-oublie')} style={{
                padding: '12px 22px', borderRadius: 11, border: 'none',
                background: C.accent, color: inkSurAccent,
                fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              }}>{t('login.reset_request_again')}</button>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0', color: C.text, letterSpacing: '-0.02em' }}>{t('login.reset_title')}</h1>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: '0 0 22px 0' }}>{t('login.reset_subtitle')}</p>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)}
                  placeholder={t('login.reset_password_label')} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('login.reset_confirm_label')} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                <button type="submit" disabled={loading} style={{
                  padding: '13px 0', borderRadius: 12, border: 'none',
                  background: C.accent, color: inkSurAccent,
                  fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading ? 0.7 : 1,
                }}>
                  <Lock size={16} strokeWidth={2} />
                  {loading ? t('login.reset_submitting') : t('login.reset_submit')}
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
