/**
 * Matrice des quotas par palier d'abonnement.
 *
 * La grille tarifaire et les limites vivent ici (pas en BD) pour qu'une
 * évolution commerciale soit un simple changement de code, déployable
 * sans migration. Les contrôleurs lisent le palier de l'entreprise
 * courante puis interrogent QUOTAS[palier] pour décider d'autoriser
 * ou non l'opération.
 *
 * Convention : `Infinity` pour « illimité » (toujours autorisé) ; un
 * entier pour un plafond (le middleware refuse au-delà). Les booléens
 * activent ou désactivent des modules entiers.
 */

const QUOTAS = {
  decouverte: {
    libelle:        'Découverte',
    prix_mensuel:   0,
    prix_annuel:    0,
    utilisateurs:   1,
    entreprises:   1,
    factures_mois:  10,
    ocr_scans_mois: 0,           // OCR désactivé en mode démo abonnement
    paiement_fournisseurs: 0,    // pas de Wave/Orange/MTN
    paie_bulletins: 0,
    immobilisations: false,
    api_publique:   false,
    support_sla:   'faq',
  },
  starter: {
    libelle:        'Starter',
    prix_mensuel:  10000,
    prix_annuel:  100000,
    utilisateurs:   2,
    entreprises:   1,
    factures_mois:  Infinity,
    ocr_scans_mois: 30,
    paiement_fournisseurs: 1,
    paie_bulletins: 0,
    immobilisations: false,
    api_publique:   false,
    support_sla:   'mail_48h',
  },
  pro: {
    libelle:        'Pro',
    prix_mensuel:  25000,
    prix_annuel:  240000,
    utilisateurs:   8,
    entreprises:   1,
    factures_mois:  Infinity,
    ocr_scans_mois: 300,
    paiement_fournisseurs: 2,  // 2 opérateurs Mobile Money au choix
    paie_bulletins: 25,
    immobilisations: true,
    api_publique:   false,
    support_sla:   'mail_wa_12h',
  },
  // Palier public Cabinet (60 000 FCFA / mois) retiré le 2026-05-30 : les
  // cabinets d'expertise comptable rejoignent désormais le Programme
  // Partenaires (cabinet_partenaire ci-dessous, licence offerte). Garder
  // un palier Cabinet public reviendrait à brouiller le message commercial.
  // Voir [[feedback-modele-cabinets]].
  //
  // Palier réservé aux cabinets d'experts-comptables PARTENAIRES (migration 029).
  // Licence gratuite à vie en échange de l'apport de PME clientes payantes.
  // Activé manuellement par le super-admin après validation du dossier ONECCA.
  cabinet_partenaire: {
    libelle:        'Cabinet Partenaire ONECCA',
    prix_mensuel:  0,
    prix_annuel:   0,
    utilisateurs:   Infinity,
    entreprises:   Infinity,     // accès illimité aux dossiers de leurs clients PME
    factures_mois:  Infinity,
    ocr_scans_mois: 2000,        // OCR un peu boosté pour la révision multi-dossiers
    paiement_fournisseurs: 3,
    paie_bulletins: Infinity,
    immobilisations: true,
    api_publique:   true,
    support_sla:   'partenaire_2h',
  },
};

const PALIERS_ORDONNES = ['decouverte', 'starter', 'pro', 'cabinet_partenaire'];

function getQuotas(palier) {
  return QUOTAS[palier] || QUOTAS.decouverte;
}

/** Vrai si `palierVoulu` est inclus ou supérieur à `palierMin`. */
function palierAuMoins(palierActuel, palierMin) {
  return PALIERS_ORDONNES.indexOf(palierActuel) >= PALIERS_ORDONNES.indexOf(palierMin);
}

module.exports = { QUOTAS, PALIERS_ORDONNES, getQuotas, palierAuMoins };
