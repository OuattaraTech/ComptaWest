import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Users, Headphones, TrendingUp, Check, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';

/**
 * Page publique /partenaires-cabinets — pitch + formulaire candidature
 * destinée aux experts-comptables membres ONECCA. Un seul CTA : soumettre
 * sa candidature au programme Partenaire (licence gratuite à vie).
 */
export default function PartenairesCabinetsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    nom_cabinet: '', nom_responsable: '', email_pro: '', telephone: '',
    numero_onecca: '', ville: 'Abidjan', nb_collaborateurs: '', nb_clients_pme: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/cabinets/candidature', { ...form, source: 'site_web' });
      setSubmitted(true);
      toast.success('Candidature reçue. À très bientôt 🤝');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(180deg, #0A0F18 0%, #1A1F2B 100%)',
      color: '#FFFFFF', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header avec logo */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: '#FFF', marginBottom: 40 }}>
          <svg width={42} height={42} viewBox="0 0 64 64">
            <rect width="64" height="64" rx="10" fill="#000" />
            <path d="M32 18 L40 32 L24 32 Z" fill="#8DE645" />
            <path d="M32 28 L52 50 L43 50 L32 38 L21 50 L12 50 Z" fill="#FFF" />
          </svg>
          <span style={{ fontSize: 26, fontWeight: 900 }}>ApeX</span>
        </Link>

        {/* Hero */}
        <div style={{ marginBottom: 60 }}>
          <div style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 999,
            background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B',
            fontSize: 13, fontWeight: 700, marginBottom: 24,
          }}>🏅 Programme Partenaires Cabinets — ONECCA</div>

          <h1 style={{
            fontSize: 56, fontWeight: 900, lineHeight: 1.05,
            margin: 0, letterSpacing: '-0.03em', maxWidth: 800,
          }}>
            Vos clients PME mériteraient mieux<br />
            <span style={{ color: '#10B981' }}>qu'Excel</span>. Et vous aussi.
          </h1>

          <p style={{
            fontSize: 19, lineHeight: 1.6, color: '#9CA3AF',
            marginTop: 24, marginBottom: 0, maxWidth: 700,
          }}>
            ApeX automatise la saisie comptable, la facturation FNE et la paie
            CNPS de vos clients. Vous récupérez le temps que vous y consacriez,
            et vous le réinvestissez dans le conseil — votre vraie valeur.
          </p>
        </div>

        {/* 3 bénéfices */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          marginBottom: 60,
        }}>
          {[
            {
              icon: Award, color: '#F59E0B',
              titre: 'Licence Cabinet GRATUITE à vie',
              desc: 'Accès illimité à vos dossiers clients. Multi-utilisateurs (collaborateurs, chefs de mission). Modules de révision avancée inclus.',
            },
            {
              icon: TrendingUp, color: '#10B981',
              titre: 'Vos clients payent -15 % la 1ère année',
              desc: 'Chaque PME que vous invitez via votre code parrain bénéficie automatiquement d\'une remise. Argument commercial direct.',
            },
            {
              icon: Headphones, color: '#3B82F6',
              titre: 'Support prioritaire 2h',
              desc: 'WhatsApp dédié + ligne directe. Vos questions techniques sont traitées avant celles des autres comptes.',
            },
          ].map(({ icon: Icon, color, titre, desc }) => (
            <div key={titre} style={{
              padding: 28, borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${color}20`, color, marginBottom: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={28} />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, marginBottom: 8 }}>{titre}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9CA3AF', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Modèle économique transparent */}
        <div style={{
          padding: 32, borderRadius: 16, marginBottom: 60,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 18 }}>
            🤝 Comment ça marche : modèle transparent
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 14, lineHeight: 1.7, color: '#D1D5DB' }}>
            <div>
              <strong style={{ color: '#FFF', fontSize: 15 }}>Pour vous (cabinet) :</strong>
              <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
                <li>Licence ApeX <strong>100 % gratuite</strong> à vie</li>
                <li>Multi-utilisateurs inclus (vos collaborateurs)</li>
                <li>Accès en lecture/écriture à tous les dossiers PME qui vous invitent</li>
                <li>Modules de révision SYSCOHADA + génération DSF</li>
                <li>Badge « Cabinet Partenaire ApeX » officiel</li>
              </ul>
            </div>
            <div>
              <strong style={{ color: '#FFF', fontSize: 15 }}>Pour vos clients PME :</strong>
              <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
                <li>Ils payent leur abonnement standard (15k à 60k FCFA/mois)</li>
                <li><strong>-15 % la 1ère année</strong> via votre code parrain</li>
                <li>Vous accédez à leur dossier sans qu'ils aient à vous redonner le mot de passe</li>
                <li>Vous gagnez du temps sur la saisie, vous facturez davantage pour le conseil</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Formulaire candidature */}
        <div id="candidature" style={{
          padding: '40px 32px', borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 8 }}>
            Postulez au programme
          </h2>
          <p style={{ fontSize: 15, color: '#9CA3AF', marginTop: 0, marginBottom: 28 }}>
            Notre équipe vous recontacte sous 48 h ouvrées pour valider votre dossier ONECCA et activer votre compte.
          </p>

          {submitted ? (
            <div style={{
              padding: 32, background: 'rgba(16, 185, 129, 0.15)',
              border: '1.5px solid #10B981', borderRadius: 16,
              textAlign: 'center',
            }}>
              <Check size={48} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Candidature reçue 🙌</h3>
              <p style={{ fontSize: 14, color: '#D1D5DB', marginTop: 8 }}>
                Notre équipe vous recontacte sous 48 h ouvrées. En attendant, vous pouvez tester ApeX en mode démo.
              </p>
              <Link to="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginTop: 20, padding: '12px 28px', borderRadius: 12,
                background: '#10B981', color: '#000', fontWeight: 700,
                textDecoration: 'none',
              }}>
                Tester ApeX en démo <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Input label="Nom du cabinet *" value={form.nom_cabinet} onChange={set('nom_cabinet')} required />
                <Input label="Nom du responsable *" value={form.nom_responsable} onChange={set('nom_responsable')} required />
                <Input label="Email professionnel *" type="email" value={form.email_pro} onChange={set('email_pro')} required />
                <Input label="Téléphone / WhatsApp" value={form.telephone} onChange={set('telephone')} placeholder="+225 ..." />
                <Input label="N° d'inscription ONECCA" value={form.numero_onecca} onChange={set('numero_onecca')} />
                <Input label="Ville" value={form.ville} onChange={set('ville')} />
                <Input label="Nb collaborateurs" type="number" value={form.nb_collaborateurs} onChange={set('nb_collaborateurs')} />
                <Input label="Nb clients PME actuels" type="number" value={form.nb_clients_pme} onChange={set('nb_clients_pme')} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Message (optionnel)
                </label>
                <textarea value={form.message} onChange={set('message')} rows={4}
                  placeholder="Parlez-nous brièvement de votre cabinet, vos spécialités, vos besoins…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#11161D', border: '1px solid #2A3140', borderRadius: 10,
                    padding: '12px 14px', color: '#FFF', fontSize: 14, fontFamily: 'inherit',
                    outline: 'none', resize: 'vertical',
                  }} />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: '16px 32px', borderRadius: 12, border: 'none',
                background: '#10B981', color: '#000', fontSize: 16, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}>
                {loading ? 'Envoi en cours…' : 'Soumettre ma candidature'} <ArrowRight size={18} />
              </button>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 16 }}>
                En soumettant, vous acceptez d'être recontacté(e) à propos de votre candidature. Aucune utilisation commerciale tierce.
              </p>
            </form>
          )}
        </div>

        {/* Footer minimaliste */}
        <div style={{
          marginTop: 60, paddingTop: 24, textAlign: 'center',
          fontSize: 12, color: '#6B7280',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          ApeX · Abidjan, Côte d'Ivoire ·{' '}
          <Link to="/cgu" style={{ color: '#9CA3AF' }}>CGU</Link> ·{' '}
          <Link to="/confidentialite" style={{ color: '#9CA3AF' }}>Confidentialité</Link>
        </div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <input {...props} style={{
        width: '100%', boxSizing: 'border-box',
        background: '#11161D', border: '1px solid #2A3140', borderRadius: 10,
        padding: '12px 14px', color: '#FFF', fontSize: 14, fontFamily: 'inherit', outline: 'none',
      }} />
    </div>
  );
}
