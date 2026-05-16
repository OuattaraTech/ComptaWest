/**
 * Matrice de permissions ComptaWest
 *
 * Source unique de vérité pour qui peut faire quoi sur chaque module.
 * Le middleware `requirePermission(module, action)` lit cette matrice ;
 * le frontend la consomme via /api/auth/me/permissions (lot 2) pour
 * adapter la navigation et masquer les champs sensibles.
 *
 * Conventions :
 * - Un rôle qui peut écrire (create/update) peut nécessairement lire.
 *   On l'ajoute quand même explicitement dans `read` pour rendre la
 *   matrice lisible sans avoir à inférer.
 * - La suppression d'écritures comptables n'est ouverte à PERSONNE :
 *   SYSCOHADA impose la contre-passation (correction #1 sur la proposition
 *   utilisateur). L'action dédiée s'appelle `counter_pass`.
 * - L'admin (chef d'entreprise) a un CRUD complet sur les immobilisations
 *   (correction #2). L'expert-comptable peut aussi delete (validation
 *   fiscale post-acquisition).
 * - L'auditeur peut lire la liste des utilisateurs pour ses contrôles
 *   (correction #3) mais n'a aucun droit de modification.
 * - Le masquage de champs sensibles (correction #4) est géré par
 *   `peutVoirChamp(role, module, champ)` consommé à la sérialisation.
 */

const ROLES = {
  PROPRIETAIRE:     'proprietaire',
  ADMIN:            'admin',
  EXPERT_COMPTABLE: 'expert_comptable',
  COMPTABLE:        'comptable',
  RH:               'rh',
  COMMERCIAL:       'commercial',
  MAGASINIER:       'magasinier',
  AUDITEUR:         'auditeur',
  USER:             'user',     // legacy — équivalent ancien rôle "utilisateur"
  LECTURE:          'lecture',  // legacy — équivalent ancien rôle "lecture seule"
};

const ALL_ROLES = Object.values(ROLES);

const MODULES = {
  DASHBOARD:        'dashboard',
  DASHBOARD_RH:     'dashboard_rh',
  ECRITURES:        'ecritures',
  CLOTURE:          'cloture',           // clôture + DSF (liasse fiscale)
  TRESORERIE:       'tresorerie',
  FACTURES:         'factures',
  CLIENTS:          'clients',
  DEVIS:            'devis',
  DEPENSES:         'depenses',
  FOURNISSEURS:     'fournisseurs',
  PAIE:             'paie',
  PRODUITS:         'produits',
  IMMOBILISATIONS:  'immobilisations',
  TAXES:            'taxes',
  RAPPORTS:         'rapports',
  AUDIT_LOG:        'audit_log',
  USERS:            'users',
  ENTREPRISE:       'entreprise',
};

const ACTIONS = {
  READ:         'read',
  CREATE:       'create',
  UPDATE:       'update',
  DELETE:       'delete',
  COUNTER_PASS: 'counter_pass',  // contre-passation (écritures comptables)
};

// Raccourcis pour rendre la matrice plus compacte
const { PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, RH,
        COMMERCIAL, MAGASINIER, AUDITEUR, USER, LECTURE } = ROLES;

const ADMINS         = [PROPRIETAIRE, ADMIN];
const COMPTABLES_ALL = [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE];

/**
 * Matrice principale : MODULE -> ACTION -> rôles autorisés.
 * Un rôle absent d'une cellule -> action interdite.
 */
const PERMISSIONS = {
  [MODULES.DASHBOARD]: {
    read: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR, USER, LECTURE],
  },
  [MODULES.DASHBOARD_RH]: {
    // Vue alternative dédiée à la masse salariale, sert d'écran d'accueil au RH
    read: [PROPRIETAIRE, ADMIN, RH, AUDITEUR],
  },

  [MODULES.ECRITURES]: {
    read:         [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
    create:       COMPTABLES_ALL,
    update:       COMPTABLES_ALL,
    // delete: VIDE — SYSCOHADA n'autorise pas la suppression. Utiliser counter_pass.
    delete:       [],
    counter_pass: COMPTABLES_ALL,
  },

  [MODULES.CLOTURE]: {
    // Clôture annuelle + DSF : exclusif à l'expert-comptable (responsabilité
    // ONECCA). Admin et auditeur consultent seulement.
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, AUDITEUR],
    create: [EXPERT_COMPTABLE],
    update: [EXPERT_COMPTABLE],
  },

  [MODULES.TRESORERIE]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
    create: COMPTABLES_ALL,
    update: COMPTABLES_ALL,
    delete: ADMINS,
  },

  [MODULES.FACTURES]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, COMMERCIAL, AUDITEUR, USER, LECTURE],
    create: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    update: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    delete: ADMINS,
  },

  [MODULES.CLIENTS]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, COMMERCIAL, AUDITEUR, USER, LECTURE],
    create: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    update: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    delete: ADMINS,
  },

  [MODULES.DEVIS]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, COMMERCIAL, AUDITEUR, USER, LECTURE],
    create: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    update: [PROPRIETAIRE, ADMIN, COMMERCIAL],
    delete: [PROPRIETAIRE, ADMIN, COMMERCIAL],
  },

  [MODULES.DEPENSES]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR, USER, LECTURE],
    create: COMPTABLES_ALL,
    update: COMPTABLES_ALL,
    delete: ADMINS,
  },

  [MODULES.FOURNISSEURS]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR, USER, LECTURE],
    create: COMPTABLES_ALL,
    update: COMPTABLES_ALL,
    delete: ADMINS,
  },

  [MODULES.PAIE]: {
    // Confidentialité salariale : le comptable interne est volontairement
    // exclu (proposition utilisateur). L'expert-comptable et l'auditeur ont
    // lecture pour audit conformité CNPS/ITS.
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, RH, AUDITEUR],
    create: [PROPRIETAIRE, ADMIN, RH],
    update: [PROPRIETAIRE, ADMIN, RH],
    delete: [PROPRIETAIRE, ADMIN, RH],
  },

  [MODULES.PRODUITS]: {
    // Magasinier : CRU sur stocks. Commercial : lecture catalogue (sans
    // prix d'achat, filtré via peutVoirChamp).
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, COMMERCIAL, MAGASINIER, AUDITEUR, USER, LECTURE],
    create: [PROPRIETAIRE, ADMIN, MAGASINIER],
    update: [PROPRIETAIRE, ADMIN, MAGASINIER],
    delete: ADMINS,
  },

  [MODULES.IMMOBILISATIONS]: {
    // Correction #2 : admin a CRUD complet (achat moto/groupe), l'EC
    // valide ensuite la durée/méthode d'amortissement.
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
    create: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE],
    update: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE],
    // Suppression réservée à l'EC (cession comptable) + admin (cas exceptionnel).
    delete: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE],
  },

  [MODULES.TAXES]: {
    read:   [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
    create: COMPTABLES_ALL,
    update: COMPTABLES_ALL,
    delete: ADMINS,
  },

  [MODULES.RAPPORTS]: {
    // Bilans, compte de résultat, exports PDF : lecture large mais
    // pas le commercial (qui ne doit pas voir la marge globale).
    read: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
  },

  [MODULES.AUDIT_LOG]: {
    // Comptable interne volontairement exclu (proposition utilisateur).
    read: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, AUDITEUR],
  },

  [MODULES.USERS]: {
    // Correction #3 : auditeur a lecture (pour ses rapports).
    read:   [PROPRIETAIRE, ADMIN, AUDITEUR],
    create: ADMINS,
    update: ADMINS,
    delete: ADMINS,
  },

  [MODULES.ENTREPRISE]: {
    // Paramètres de l'entreprise (raison sociale, NINEA, etc.)
    read:   ALL_ROLES,
    update: ADMINS,
  },
};

/**
 * Masquage de champs sensibles (correction #4).
 * Pour un module donné, liste les champs visibles uniquement par certains
 * rôles. Les champs non listés ici sont visibles par tous ceux qui ont
 * `read` sur le module.
 *
 * Utilisé à la sérialisation côté API : on enlève le champ du payload si
 * peutVoirChamp(role, module, champ) renvoie false.
 */
const VISIBILITY = {
  [MODULES.PRODUITS]: {
    // Le commercial et le magasinier voient le catalogue mais pas les
    // prix d'achat ni le coût moyen pondéré.
    prix_achat_ht: [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
    cout_moyen:    [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, COMPTABLE, AUDITEUR],
  },
  [MODULES.PAIE]: {
    // Préparé pour la suite : si un jour le comptable interne accède
    // à des stats paie globales, on masque les salaires individuels.
    salaire_base:     [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, RH, AUDITEUR],
    net_a_payer:      [PROPRIETAIRE, ADMIN, EXPERT_COMPTABLE, RH, AUDITEUR],
  },
};

/**
 * Vérifie si un rôle peut effectuer une action sur un module.
 * Inconnu -> false (refus par défaut).
 */
function peut(role, module, action) {
  if (!role || !module || !action) return false;
  const moduleConfig = PERMISSIONS[module];
  if (!moduleConfig) return false;
  const allowed = moduleConfig[action];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(role);
}

/**
 * Vérifie si un rôle a le droit de VOIR un champ sensible d'un module.
 * Renvoie true si le champ n'est pas listé dans VISIBILITY (donc public
 * dans le scope de read).
 */
function peutVoirChamp(role, module, champ) {
  const fields = VISIBILITY[module];
  if (!fields) return true;
  const allowed = fields[champ];
  if (!Array.isArray(allowed)) return true;
  return allowed.includes(role);
}

/**
 * Filtre un objet pour ne garder que les champs visibles par le rôle.
 * Utile à la sérialisation des collections.
 */
function masquerChamps(role, module, payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const fields = VISIBILITY[module];
  if (!fields) return payload;
  if (Array.isArray(payload)) {
    return payload.map(p => masquerChamps(role, module, p));
  }
  const out = { ...payload };
  for (const champ of Object.keys(fields)) {
    if (!peutVoirChamp(role, module, champ)) {
      delete out[champ];
    }
  }
  return out;
}

/**
 * Retourne la liste des rôles ayant une action sur un module — utile
 * pour migrer les routes existantes (eaWrite -> rolesPour('factures','create')).
 */
function rolesPour(module, action) {
  return PERMISSIONS[module]?.[action] || [];
}

module.exports = {
  ROLES,
  ALL_ROLES,
  MODULES,
  ACTIONS,
  PERMISSIONS,
  VISIBILITY,
  peut,
  peutVoirChamp,
  masquerChamps,
  rolesPour,
};
