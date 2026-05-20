// Logos officiels des fournisseurs de paiement mobile pris en charge par
// ApeX. SVG inline : pas de requête réseau, pas de dépendance, net
// à toute taille. Pour remplacer un logo par la version officielle exacte
// (ex. kit presse à jour), il suffit de remplacer le <svg> correspondant.
//
// Couleurs vérifiées :
//   - Wave         : #1AA1F1 (cyan officiel de l'app)
//   - Orange Money : #FF7900 (orange officiel Orange Group)
//   - MTN          : #FFCC00 fond, #00407A texte (charte MTN Group)

function LogoWave({ size = 36, radius }) {
  const r = radius ?? Math.round(size * 0.28);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Wave">
      <rect width="64" height="64" rx={r * 64 / size} fill="#1AA1F1" />
      {/* Mascotte Wave : pingouin stylisé vu de face, version simplifiée
          pour rester lisible aux petites tailles (36–44 px). */}
      {/* Corps blanc (ventre) — ovale légèrement bombé */}
      <ellipse cx="32" cy="40" rx="15" ry="17" fill="#fff" />
      {/* Dos noir : forme en goutte qui enveloppe le corps par l'arrière */}
      <path
        d="M32 10
           C 18 10 15 24 16 38
           C 17 49 22 56 27 56
           L 27 33
           C 27 26 29 22 32 22
           C 35 22 37 26 37 33
           L 37 56
           C 42 56 47 49 48 38
           C 49 24 46 10 32 10 Z"
        fill="#1A1A1A"
      />
      {/* Yeux blancs avec pupilles noires */}
      <circle cx="28" cy="22" r="3" fill="#fff" />
      <circle cx="36" cy="22" r="3" fill="#fff" />
      <circle cx="28.5" cy="22.5" r="1.4" fill="#1A1A1A" />
      <circle cx="36.5" cy="22.5" r="1.4" fill="#1A1A1A" />
      {/* Bec orange triangulaire */}
      <path d="M29 27 L 35 27 L 32 31 Z" fill="#FF8A1F" />
      {/* Pattes orange */}
      <ellipse cx="27" cy="56" rx="3.5" ry="2.2" fill="#FF8A1F" />
      <ellipse cx="37" cy="56" rx="3.5" ry="2.2" fill="#FF8A1F" />
    </svg>
  );
}

function LogoOrangeMoney({ size = 36, radius }) {
  const r = radius ?? Math.round(size * 0.18);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Orange Money">
      <rect width="64" height="64" rx={r * 64 / size} fill="#FF7900" />
      {/* Logotype « orange » officiel : minuscules, sans-serif, blanc */}
      <text x="32" y="42" textAnchor="middle"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="16" fontWeight="700" fill="#fff" letterSpacing="-0.5">orange</text>
    </svg>
  );
}

function LogoMtnMomo({ size = 36, radius }) {
  const r = radius ?? Math.round(size * 0.18);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="MTN MoMo">
      <rect width="64" height="64" rx={r * 64 / size} fill="#FFCC00" />
      {/* Logotype MTN : capitales bleu marine, légèrement italique */}
      <text x="32" y="38" textAnchor="middle"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="20" fontWeight="900" fill="#00407A" letterSpacing="-1">MTN</text>
      <text x="32" y="52" textAnchor="middle"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="9" fontWeight="700" fill="#00407A" letterSpacing="0.5">MoMo</text>
    </svg>
  );
}

const LOGOS = {
  wave: LogoWave,
  orange_money: LogoOrangeMoney,
  mtn_momo: LogoMtnMomo,
};

export default function LogoFournisseur({ fournisseur, size = 36, radius }) {
  const Logo = LOGOS[fournisseur];
  if (!Logo) {
    // Fallback générique si un nouveau fournisseur est ajouté côté backend
    // sans qu'on ait encore son SVG dédié.
    return (
      <div style={{
        width: size, height: size, borderRadius: radius ?? Math.round(size * 0.18),
        background: '#999', color: '#fff', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.45,
      }}>?</div>
    );
  }
  return <Logo size={size} radius={radius} />;
}
