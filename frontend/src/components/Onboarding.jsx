/**
 * Composant Onboarding réutilisable
 *
 * Combine deux mécanismes :
 *   1. Modal d'introduction multi-étapes (présentation générale de la page)
 *   2. Tour guidé spotlight (cible des éléments via [data-onboarding="..."])
 *
 * Comportement :
 *   - Au 1er accès à la page : ouverture automatique du modal d'intro
 *   - Bouton flottant « ? » en bas à droite pour relancer à tout moment
 *   - Persistance localStorage : `cw_onboarding_<pageKey>_seen`
 *
 * Usage dans une page :
 *   <Onboarding pageKey="dashboard" />
 *   ... et ajouter data-onboarding="kpis" sur les éléments cibles
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from './UI.jsx';
import { getOnboarding as getOnboardingFr } from '../utils/onboardingContent.jsx';
import { getOnboarding as getOnboardingEn } from '../utils/onboardingContent.en.jsx';
import { X, ChevronLeft, ChevronRight, HelpCircle, Sparkles } from 'lucide-react';

const SEEN_KEY = (pageKey) => `cw_onboarding_${pageKey}_seen`;

export default function Onboarding({ pageKey }) {
  const { t, i18n } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  // Charge le contenu d'onboarding dans la langue active. Le fichier .en suit
  // la même structure que la version FR — seules les chaînes diffèrent.
  const getOnboarding = i18n.language?.startsWith('en') ? getOnboardingEn : getOnboardingFr;
  const content = getOnboarding(pageKey);

  // 'closed' | 'intro' | 'spotlight'
  const [mode, setMode] = useState('closed');
  const [introStep, setIntroStep] = useState(0);
  const [spotStep, setSpotStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  // Ouverture automatique au 1er accès
  useEffect(() => {
    if (!content) return;
    const seen = localStorage.getItem(SEEN_KEY(pageKey));
    if (!seen) {
      const t = setTimeout(() => setMode('intro'), 350);
      return () => clearTimeout(t);
    }
  }, [pageKey, content]);

  // Calcul de la position du spotlight
  useEffect(() => {
    if (mode !== 'spotlight' || !content?.spotlight?.length) return;
    const step = content.spotlight[spotStep];
    if (!step) return;
    const update = () => {
      const el = document.querySelector(`[data-onboarding="${step.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [mode, spotStep, content]);

  if (!content) return null;

  const introSlides = content.intro || [];
  const spotlightSteps = content.spotlight || [];
  const hasSpotlight = spotlightSteps.length > 0;

  const finish = () => {
    localStorage.setItem(SEEN_KEY(pageKey), '1');
    setMode('closed');
    setIntroStep(0);
    setSpotStep(0);
  };

  const launchSpotlight = () => {
    if (!hasSpotlight) return finish();
    setMode('spotlight');
    setSpotStep(0);
  };

  // ─── Bouton flottant « ? » ────────────────────────────────────────────
  const FloatingHelp = (
    <button
      onClick={() => { setIntroStep(0); setMode('intro'); }}
      title={t('onboarding.fab_tooltip')}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 90,
        width: 48, height: 48, borderRadius: '50%',
        background: `linear-gradient(135deg, ${C.accent}, ${dark ? '#00A882' : '#005a48'})`,
        border: 'none', cursor: 'pointer', color: dark ? '#000' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: dark ? '0 6px 20px rgba(0,212,170,0.35)' : '0 6px 20px rgba(0,122,99,0.35)',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <HelpCircle size={22} />
    </button>
  );

  // ─── MODAL D'INTRODUCTION ─────────────────────────────────────────────
  if (mode === 'intro' && introSlides.length > 0) {
    const slide = introSlides[introStep];
    const Icon = slide.icon || Sparkles;
    const isFirst = introStep === 0;
    const isLast = introStep === introSlides.length - 1;

    return (
      <>
        {FloatingHelp}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: dark ? 'rgba(0,0,0,0.78)' : 'rgba(10,22,40,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 22,
            width: '100%', maxWidth: 560, overflow: 'hidden',
            boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.6)' : '0 20px 60px rgba(10,22,40,0.25)',
            position: 'relative',
          }}>
            {/* Bandeau dégradé en haut */}
            <div style={{
              height: 6, background: `linear-gradient(90deg, ${C.accent}, ${dark ? '#4E8BF5' : '#1A52B0'})`,
            }} />

            {/* Header */}
            <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: `${C.accent}18`, color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {content.titre}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 2 }}>
                    {slide.titre}
                  </div>
                </div>
              </div>
              <button onClick={finish} style={{
                background: C.hover, border: `1px solid ${C.border}`, borderRadius: 8,
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: C.muted,
              }}><X size={15} /></button>
            </div>

            {/* Contenu */}
            <div style={{ padding: '20px 28px 8px' }}>
              <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.65, margin: 0 }}>
                {slide.description}
              </p>
              {slide.points && slide.points.length > 0 && (
                <ul style={{ marginTop: 16, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slide.points.map((p, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.text }}>
                      <span style={{
                        flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: '50%',
                        background: C.accent,
                      }} />
                      <span style={{ lineHeight: 1.55 }}>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Indicateur d'étapes */}
            <div style={{ padding: '20px 28px 0', display: 'flex', gap: 6, justifyContent: 'center' }}>
              {introSlides.map((_, i) => (
                <span key={i} style={{
                  width: i === introStep ? 22 : 6, height: 6, borderRadius: 3,
                  background: i === introStep ? C.accent : C.border,
                  transition: 'all 0.25s',
                }} />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '22px 28px', marginTop: 16, borderTop: `1px solid ${C.border}`,
              background: dark ? 'transparent' : C.cardAlt,
            }}>
              <button onClick={finish} style={{
                background: 'transparent', border: 'none', color: C.muted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 0',
              }}>
                {t('onboarding.skip')}
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {!isFirst && (
                  <button onClick={() => setIntroStep(s => s - 1)} style={{
                    padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ChevronLeft size={14} /> {t('onboarding.previous')}
                  </button>
                )}
                {!isLast ? (
                  <button onClick={() => setIntroStep(s => s + 1)} style={{
                    padding: '10px 18px', borderRadius: 10, border: 'none',
                    background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {t('onboarding.next')} <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={hasSpotlight ? launchSpotlight : finish} style={{
                    padding: '10px 18px', borderRadius: 10, border: 'none',
                    background: C.accent, color: dark ? '#000' : '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {hasSpotlight ? t('onboarding.discover_ui') : t('onboarding.lets_go')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── TOUR SPOTLIGHT ───────────────────────────────────────────────────
  if (mode === 'spotlight' && hasSpotlight) {
    const step = spotlightSteps[spotStep];
    const isLast = spotStep === spotlightSteps.length - 1;
    const isFirst = spotStep === 0;

    // Position de la bulle d'aide (sous ou au-dessus de la cible)
    const tooltipStyle = (() => {
      if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      const tipWidth = 340;
      const tipHeight = 200;
      const margin = 16;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      let top = targetRect.top + targetRect.height + margin;
      let left = targetRect.left + targetRect.width / 2 - tipWidth / 2;

      // Si pas la place en dessous, on met au dessus
      if (top + tipHeight > vh - 20) {
        top = targetRect.top - tipHeight - margin;
      }
      if (top < 20) top = 20;
      if (left < 16) left = 16;
      if (left + tipWidth > vw - 16) left = vw - tipWidth - 16;
      return { top, left, width: tipWidth };
    })();

    const PADDING = 8;
    const holeStyle = targetRect ? {
      top: targetRect.top - PADDING,
      left: targetRect.left - PADDING,
      width: targetRect.width + PADDING * 2,
      height: targetRect.height + PADDING * 2,
    } : null;

    return (
      <>
        {FloatingHelp}
        {/* Overlay avec trou découpé via box-shadow */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 280, pointerEvents: 'none',
        }}>
          {holeStyle ? (
            <div style={{
              position: 'absolute',
              top: holeStyle.top, left: holeStyle.left,
              width: holeStyle.width, height: holeStyle.height,
              borderRadius: 12,
              boxShadow: `0 0 0 9999px ${dark ? 'rgba(0,0,0,0.72)' : 'rgba(10,22,40,0.55)'}`,
              border: `2px solid ${C.accent}`,
              transition: 'all 0.3s ease',
              pointerEvents: 'none',
            }} />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: dark ? 'rgba(0,0,0,0.72)' : 'rgba(10,22,40,0.55)',
            }} />
          )}
        </div>

        {/* Bulle d'aide */}
        <div style={{
          position: 'fixed', zIndex: 290,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '18px 20px',
          boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 16px 40px rgba(10,22,40,0.25)',
          pointerEvents: 'auto', transition: 'top 0.3s, left 0.3s',
          ...tooltipStyle,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('onboarding.step_indicator', { current: spotStep + 1, total: spotlightSteps.length })}
            </div>
            <button onClick={finish} style={{
              background: 'transparent', border: 'none', color: C.muted,
              cursor: 'pointer', padding: 0, display: 'flex',
            }}><X size={14} /></button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {step.titre}
          </div>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, marginBottom: 16 }}>
            {step.description}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button onClick={finish} style={{
              background: 'transparent', border: 'none', color: C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{t('onboarding.close')}</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isFirst && (
                <button onClick={() => setSpotStep(s => s - 1)} style={{
                  padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <ChevronLeft size={13} />
                </button>
              )}
              <button
                onClick={() => isLast ? finish() : setSpotStep(s => s + 1)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: C.accent, color: dark ? '#000' : '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {isLast ? t('onboarding.finish') : <>{t('onboarding.next')} <ChevronRight size={13} /></>}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Mode fermé : juste le bouton flottant
  return FloatingHelp;
}
