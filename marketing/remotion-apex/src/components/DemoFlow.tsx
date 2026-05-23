import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { LogoApex } from './LogoApex';

/**
 * 4 mini-démos en séquence : facture FNE, paiement Wave, bulletin paie, bilan.
 * Chaque écran apparaît 6 secondes (180 frames @ 30fps) avec un effet de
 * fondu + slide vers le haut. L'idée est de montrer la valeur réelle
 * d'ApeX, pas du texte abstrait.
 */
const DUREE_ECRAN = 30 * 6; // 6 secondes par écran

export const DemoFlow: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence durationInFrames={DUREE_ECRAN}>
        <EcranDemo
          titre="Facture FNE"
          sousTitre="Certifiée DGI en 1 clic"
          icone="🧾"
          metric="3 sec"
          metricLabel="pour émettre + certifier"
          couleur={COLORS.EMERAUDE}
          contenu={<MockFacture />}
        />
      </Sequence>
      <Sequence from={DUREE_ECRAN} durationInFrames={DUREE_ECRAN}>
        <EcranDemo
          titre="Mobile Money"
          sousTitre="Wave · Orange · MTN encaissés en direct"
          icone="📱"
          metric="10 sec"
          metricLabel="argent reçu sur ton compte"
          couleur={COLORS.BLEU}
          contenu={<MockPaiement />}
        />
      </Sequence>
      <Sequence from={DUREE_ECRAN * 2} durationInFrames={DUREE_ECRAN}>
        <EcranDemo
          titre="Paie CNPS"
          sousTitre="Bulletins ITS 2024 conformes"
          icone="👥"
          metric="30 sec"
          metricLabel="par employé, bulletin complet"
          couleur={COLORS.ORANGE}
          contenu={<MockBulletin />}
        />
      </Sequence>
      <Sequence from={DUREE_ECRAN * 3} durationInFrames={DUREE_ECRAN}>
        <EcranDemo
          titre="Bilan SYSCOHADA"
          sousTitre="Prêt pour ton comptable, sans Excel"
          icone="📊"
          metric="1 clic"
          metricLabel="rapport annuel complet"
          couleur={COLORS.VERT_CLAIR}
          contenu={<MockBilan />}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

const EcranDemo: React.FC<{
  titre: string; sousTitre: string; icone: string;
  metric: string; metricLabel: string; couleur: string;
  contenu: React.ReactNode;
}> = ({ titre, sousTitre, icone, metric, metricLabel, couleur, contenu }) => {
  const frame = useCurrentFrame();
  const slideUp = interpolate(frame, [0, 15], [80, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      padding: '80px 60px',
      flexDirection: 'column', gap: 40,
      opacity, transform: `translateY(${slideUp}px)`,
    }}>
      {/* Header — icône + titre + métrique */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{
          width: 130, height: 130, borderRadius: 28,
          background: `${couleur}25`, border: `3px solid ${couleur}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 80,
        }}>{icone}</div>
        <div>
          <div style={{ fontFamily: FONTS.bold, fontSize: 72, fontWeight: 900, color: COLORS.BLANC }}>{titre}</div>
          <div style={{ fontFamily: FONTS.bold, fontSize: 34, color: COLORS.GRIS_TEXTE, marginTop: 4 }}>{sousTitre}</div>
        </div>
      </div>

      {/* Mockup central */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {contenu}
      </div>

      {/* Métrique chiffrée en bas */}
      <div style={{
        background: couleur, borderRadius: 24, padding: '32px 48px',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 130, fontWeight: 900, color: COLORS.NOIR, lineHeight: 1 }}>{metric}</div>
        <div style={{ fontFamily: FONTS.bold, fontSize: 32, color: COLORS.NOIR, marginTop: 8 }}>{metricLabel}</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Mockups simplifiés des écrans ApeX ────────────────────────────────────
const MockFacture: React.FC = () => (
  <div style={{
    background: COLORS.BLANC, borderRadius: 16, padding: 40,
    width: '100%', maxWidth: 700, fontFamily: FONTS.bold,
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
  }}>
    <div style={{ fontSize: 38, fontWeight: 900, color: COLORS.NOIR }}>FACTURE F-2026-042</div>
    <div style={{ fontSize: 22, color: '#666', marginTop: 4 }}>Banque Atlantique CI</div>
    <div style={{ marginTop: 30, padding: 20, background: '#F1F5F9', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
        <span>Total TTC</span>
        <span style={{ fontWeight: 900 }}>1 593 000 FCFA</span>
      </div>
    </div>
    <div style={{
      marginTop: 30, padding: 16, border: `2px solid ${COLORS.EMERAUDE_FONCE}`,
      borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, background: '#ECFDF5',
    }}>
      <div style={{ fontSize: 60 }}>✓</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.EMERAUDE_FONCE }}>CERTIFIÉE FNE</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 18, color: '#666' }}>9606123E25000000042 · DGI</div>
      </div>
    </div>
  </div>
);

const MockPaiement: React.FC = () => (
  <div style={{
    background: COLORS.BLANC, borderRadius: 16, padding: 40,
    width: '100%', maxWidth: 700, fontFamily: FONTS.bold,
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
  }}>
    <div style={{ display: 'flex', gap: 20, marginBottom: 30 }}>
      <span style={{ padding: '12px 24px', background: '#3B82F6', color: '#FFF', borderRadius: 12, fontSize: 22, fontWeight: 900 }}>Wave</span>
      <span style={{ padding: '12px 24px', background: '#F97316', color: '#FFF', borderRadius: 12, fontSize: 22, fontWeight: 900 }}>Orange Money</span>
      <span style={{ padding: '12px 24px', background: '#FBBF24', color: '#000', borderRadius: 12, fontSize: 22, fontWeight: 900 }}>MTN MoMo</span>
    </div>
    <div style={{
      padding: 30, background: '#ECFDF5', border: `3px solid ${COLORS.EMERAUDE}`,
      borderRadius: 16,
    }}>
      <div style={{ fontSize: 22, color: '#666' }}>Reçu de Banque Atlantique</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: COLORS.EMERAUDE_FONCE, marginTop: 4 }}>+1 593 000 FCFA</div>
      <div style={{ fontSize: 22, color: COLORS.NOIR, marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.EMERAUDE, display: 'inline-block' }} />
        Encaissement comptabilisé · Débit 521 / Crédit 411
      </div>
    </div>
  </div>
);

const MockBulletin: React.FC = () => (
  <div style={{
    background: COLORS.BLANC, borderRadius: 16, padding: 36,
    width: '100%', maxWidth: 700, fontFamily: FONTS.bold,
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
  }}>
    <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.NOIR }}>BULLETIN MAI 2026</div>
    <div style={{ fontSize: 20, color: '#666', marginTop: 4 }}>KOUADIO Marc · EMP-001</div>
    <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px 20px', fontSize: 22 }}>
      <span>Salaire base</span><span style={{ fontFamily: FONTS.mono, textAlign: 'right' }}>450 000</span>
      <span style={{ color: COLORS.ROUGE }}>CNPS sal (6,6 %)</span><span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: COLORS.ROUGE }}>−29 700</span>
      <span style={{ color: COLORS.ROUGE }}>ITS net (réforme 2024)</span><span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: COLORS.ROUGE }}>−53 263</span>
    </div>
    <div style={{
      marginTop: 24, padding: 20, background: COLORS.EMERAUDE_FONCE,
      borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ fontSize: 26, color: COLORS.BLANC, fontWeight: 900 }}>NET À PAYER</span>
      <span style={{ fontSize: 38, color: COLORS.BLANC, fontWeight: 900, fontFamily: FONTS.mono }}>367 037 FCFA</span>
    </div>
  </div>
);

const MockBilan: React.FC = () => (
  <div style={{
    background: COLORS.BLANC, borderRadius: 16, padding: 40,
    width: '100%', maxWidth: 700, fontFamily: FONTS.bold,
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
  }}>
    <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.NOIR }}>BILAN AU 31/12/2026</div>
    <div style={{ fontSize: 20, color: '#666', marginTop: 4 }}>SARL Démo · Régime RNI</div>
    <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={{ padding: 20, background: '#EFF6FF', borderRadius: 12 }}>
        <div style={{ fontSize: 18, color: '#666' }}>ACTIF</div>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: FONTS.mono, marginTop: 6, color: '#1E40AF' }}>42 850 000</div>
      </div>
      <div style={{ padding: 20, background: '#FEF3C7', borderRadius: 12 }}>
        <div style={{ fontSize: 18, color: '#666' }}>PASSIF</div>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: FONTS.mono, marginTop: 6, color: '#92400E' }}>42 850 000</div>
      </div>
    </div>
    <div style={{
      marginTop: 24, padding: 16, background: '#ECFDF5', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 24 }}>✓</span>
      <span style={{ fontSize: 20, color: COLORS.EMERAUDE_FONCE, fontWeight: 700 }}>Bilan équilibré · SYSCOHADA conforme</span>
    </div>
  </div>
);
