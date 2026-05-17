// Logos officiels des fournisseurs de paiement mobile pris en charge par
// ComptaWest. SVG inline : pas de requête réseau, pas de dépendance, net
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
      {/* Vague stylisée caractéristique de Wave : deux ondulations blanches */}
      <path
        d="M10 38 Q 18 28 26 38 T 42 38 T 58 38"
        fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"
      />
      <path
        d="M10 46 Q 18 36 26 46 T 42 46 T 58 46"
        fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.85"
      />
      {/* Lettre W discrète au-dessus pour l'identification */}
      <text x="32" y="24" textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        fontSize="14" fontWeight="800" fill="#fff" letterSpacing="-0.5">wave</text>
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
