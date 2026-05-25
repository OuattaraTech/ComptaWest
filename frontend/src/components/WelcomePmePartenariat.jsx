import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, FileText, Users, Settings, X, ArrowRight, Check } from 'lucide-react';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';

/**
 * Modal de bienvenue affiché UNE SEULE FOIS pour les PME inscrites via
 * une invitation cabinet (parrainee_par_cabinet_id non null).
 *
 * Affiche 3 étapes guidées pour démarrer rapidement :
 *  1. Vérification du lien avec le cabinet (déjà fait à l'inscription)
 *  2. Configuration de la facturation FNE
 *  3. Création de la 1ère facture / import de clients
 *
 * Persistence via localStorage : 'cw_welcome_partenariat_<entrepriseId>_seen'.
 */
const SEEN_KEY = (eid) => `cw_welcome_partenariat_${eid}_seen`;

export default function WelcomePmePartenariat() {
  const { actuelle } = useEntreprise();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cabinetNom, setCabinetNom] = useState(null);

  useEffect(() => {
    if (!actuelle?.id) return;
    // Affichage UNIQUEMENT si :
    //   - L'entreprise est parrainée par un cabinet
    //   - Le modal n'a pas déjà été vu
    //   - On n'est pas sur une page de cabinet ou paramètres (éviter de chevaucher)
    const dejaVu = localStorage.getItem(SEEN_KEY(actuelle.id));
    if (dejaVu) return;
    if (!actuelle.parrainee_par_cabinet_id) return;

    // Récupère le nom du cabinet via l'API entreprise (publique aux membres)
    (async () => {
      try {
        const { data } = await api.get(`/entreprises/${actuelle.parrainee_par_cabinet_id}/public-info`);
        setCabinetNom(data.data?.nom || 'votre cabinet');
      } catch {
        setCabinetNom('votre cabinet');
      }
      setOpen(true);
    })();
  }, [actuelle?.id]);

  const close = () => {
    if (actuelle?.id) localStorage.setItem(SEEN_KEY(actuelle.id), '1');
    setOpen(false);
  };

  if (!open) return null;

  const C = dark
    ? { bg: '#0A0F18', card: '#11161D', border: '#2A3140', text: '#E5E7EB', muted: '#9CA3AF', accent: '#10B981' }
    : { bg: '#F8FAFC', card: '#FFF',    border: '#E5E7EB', text: '#111827', muted: '#6B7280', accent: '#0F8A6E' };

  const etapes = [
    {
      icon: Check, color: C.accent, statut: 'done',
      titre: `Lien actif avec ${cabinetNom}`,
      desc: 'Votre cabinet a déjà accès à votre dossier en lecture et écriture. Vous n\'aurez plus à lui transmettre vos pièces par WhatsApp.',
    },
    {
      icon: Settings, color: '#F59E0B', statut: 'todo',
      titre: 'Configurez votre facturation FNE',
      desc: 'Renseignez votre NCC, votre centre fiscal et votre clé API DGI pour émettre des factures certifiées en 1 clic.',
      cta: 'Configurer FNE', href: '/parametres?tab=fiscal',
    },
    {
      icon: FileText, color: '#3B82F6', statut: 'todo',
      titre: 'Émettez votre 1ère facture',
      desc: 'Créez votre 1er client + 1ère facture en 3 clics. ApeX la certifie auprès de la DGI automatiquement.',
      cta: 'Nouvelle facture', href: '/factures',
    },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      padding: 20,
    }}>
      <div style={{
        background: C.card, borderRadius: 18, maxWidth: 560, width: '100%',
        border: `1px solid ${C.border}`, color: C.text, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header avec gradient */}
        <div style={{
          padding: '32px 32px 24px',
          background: `linear-gradient(135deg, ${C.accent}, #0F8A6E)`,
          color: '#000', position: 'relative',
        }}>
          <button onClick={close} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 8,
            padding: 6, cursor: 'pointer', color: '#000',
          }}><X size={18} /></button>
          <Award size={42} color="#000" />
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: '12px 0 6px', letterSpacing: '-0.02em' }}>
            Bienvenue, {actuelle?.nom} 🎉
          </h2>
          <p style={{ fontSize: 14, margin: 0, opacity: 0.85 }}>
            Votre compte est lié au cabinet <strong>{cabinetNom}</strong>.<br />
            Voici 3 étapes pour démarrer.
          </p>
        </div>

        {/* Étapes */}
        <div style={{ padding: '24px 32px' }}>
          {etapes.map((e, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: i < etapes.length - 1 ? `1px solid ${C.border}66` : 'none',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${e.color}25`, color: e.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}><e.icon size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.titre}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{e.desc}</div>
                {e.cta && (
                  <button onClick={() => { close(); navigate(e.href); }} style={{
                    marginTop: 10, padding: '6px 14px', borderRadius: 8,
                    background: e.color, color: '#000', border: 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>{e.cta} <ArrowRight size={12} /></button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 32px', background: dark ? '#0D1220' : '#F9FAFB',
          borderTop: `1px solid ${C.border}66`, display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={close} style={{
            padding: '10px 20px', borderRadius: 10,
            background: 'transparent', color: C.muted,
            border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Je découvrirai par moi-même</button>
        </div>
      </div>
    </div>
  );
}
