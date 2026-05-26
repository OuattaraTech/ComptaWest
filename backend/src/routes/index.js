const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/entreprise');
const { MODULES, ACTIONS } = require('../utils/permissions');
const validate = require('../middleware/validate');
const checkQuota = require('../middleware/checkQuota');
const { getAbonnement, putAbonnement } = require('../controllers/abonnementController');

// Raccourci : can('factures', 'create') === requirePermission('factures', 'create')
// La matrice complète vit dans utils/permissions.js.
const can = (module, action) => requirePermission(module, action);

const { register, login, me, updateLangue, loginDemo, getInvitation, accepterInvitation, getMesPermissions, registerRules, loginRules } = require('../controllers/authController');
const entrepriseAccess = require('../middleware/entreprise');
const {
  getMesEntreprises, createEntreprise, updateEntreprise,
  getMembres, inviterMembre, updateRoleMembre, retirerMembre,
  updatePermissionsMembre, getTemplateRole,
  entrepriseRules,
} = require('../controllers/entreprisesController');
const { getClients, getClientById, createClient, updateClient, deleteClient, clientRules } = require('../controllers/clientsController');
const { getFactures, getFactureById, createFacture, updateFacture, updateStatut, addPaiement, deleteFacture, factureRules, paiementRules } = require('../controllers/facturesController');
const {
  creerLienPaiementFacture, creerLienWaveFacture,
  webhookFournisseur, webhookWave, simulerPaiementWave,
} = require('../controllers/paymentLinksController');
const { listerIntegrations, upsertIntegration, desactiverIntegration } = require('../controllers/integrationsPaiementController');
const { getDevis, getStatsDevis, updateDevisStatut, convertirEnFacture, supprimerDevis, convertirRules } = require('../controllers/devisController');
const { getStats, getTransactionsRecentes, getAnneesDisponibles } = require('../controllers/dashboardController');
const { getBilan, getBilanPDF, getFacturePDF } = require('../controllers/rapportsController');
const { getDepenses, getStatsDepenses, createDepense, updateDepense, deleteDepense, getCategories, createCategorie, depenseRules, categorieDepenseRules } = require('../controllers/depensesController');
const { scannerPiece, scannerRules } = require('../controllers/ocrController');
const {
  certifierFactureRoute, getCertification, getFneConfig, putFneConfig,
  fnePing, getQueue, rejouerQueueRoute,
} = require('../controllers/fneController');
const { getTaxes, getTableauBordTaxes, createTaxe, payerTaxe, calculerTVA, taxeRules, paiementTaxeRules } = require('../controllers/taxesController');
const { getAuditLog } = require('../controllers/auditController');
const {
  getPlanComptable, getJournaux, getExercices,
  getEcritures, getEcritureById, getGrandLivre, getBalance,
  createEcritureManuelle, exportFEC,
  exportJournalTxt, exportJournalExcel,
  exportGrandLivreTxt, exportGrandLivreExcel,
  getClotureChecks, cloturerExercice,
} = require('../controllers/comptabiliteController');
const {
  getOperateurs, getComptes, getCompteById, createCompte, updateCompte, archiveCompte,
  getMouvements, createMouvement, deleteMouvement, transfererEntreComptes,
  importerReleve, getReleves, getReleveDetail, autoMatch,
  rapprocherLigne, delierLigne, creerMouvementDepuisLigne, deleteReleve,
  compteRules, mouvementRules,
} = require('../controllers/tresorerieController');
const {
  getEmployes, getEmployeById, createEmploye, updateEmploye, archiveEmploye, employeRules,
  getRubriques, createRubrique, updateRubrique, deleteRubrique, rubriqueRules,
  getBulletins, getBulletinById, creerOuMajBulletin, genererMois,
  validerBulletin, payerBulletin, supprimerBulletin, getBulletinPDF, bulletinRules,
  getStatsPaie, getParametres,
} = require('../controllers/paieController');
const {
  immobilisationRules,
  getCategories: getCategoriesImmo,
  getImmobilisations, getImmobilisationById, createImmobilisation,
  updateImmobilisation, deleteImmobilisation,
  genererDotationsAnnee, supprimerDotation,
  cederImmobilisation, getStats: getStatsImmo,
  creerDepuisDepense, getTableauAmortissementPDF,
} = require('../controllers/immobilisationsController');
const {
  produitRules,
  getCategories: getCategoriesProduits, createCategorie: createCategorieProduit,
  getProduits, getProduitById, createProduit, updateProduit, archiveProduit,
  creerMouvement, getMouvementsProduit, getJournalMouvements,
  creerInventaire, getInventaires, getInventaireById,
  majLignesInventaire, validerInventaire, supprimerInventaire,
  getStatsProduits,
} = require('../controllers/produitsController');
const {
  fournisseurRules,
  getFournisseurs, getFournisseurById,
  createFournisseur, updateFournisseur, archiveFournisseur,
  getStatsFournisseurs,
} = require('../controllers/fournisseursController');
const {
  importerClients, importerFournisseurs, importerProduits,
  importerPlanComptable, importerBalanceOuverture, importerEcrituresHistoriques,
  telechargerModele,
} = require('../controllers/importController');
const {
  commandeRules, paiementFournisseurRules,
  getCommandes, getCommandeById, createCommande,
  envoyerCommande, receptionnerCommande, facturerCommande,
  annulerCommande, supprimerCommande,
  creerPaiementFournisseur, getPaiementsFournisseur,
} = require('../controllers/commandesAchatController');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Limiteur pour la route publique du compte démo : chaque appel déclenche un
// upsert + potentiellement la création d'une entreprise complète.
const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de connexions au compte démo. Réessayez dans quelques minutes.' },
});

// ─── AUTH ──────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, registerRules, validate, register);
router.post('/auth/login',    authLimiter, loginRules,    validate, login);
router.post('/auth/demo',     demoLimiter, loginDemo);
router.get('/auth/me', auth, me);
router.put('/auth/me/langue', auth, updateLangue);
// Permissions sur l'entreprise courante (X-Entreprise-Id) — utilisé par le
// frontend pour adapter la nav et masquer les actions interdites.
router.get('/auth/me/permissions', auth, entrepriseAccess(), getMesPermissions);
// Invitations — routes publiques (pas d'auth : l'invité n'a pas encore de compte actif)
router.get('/auth/invitation/:token',  getInvitation);
router.post('/auth/invitation/:token', authLimiter, accepterInvitation);

// ─── CABINETS PARTENAIRES (migration 029) ───────────────────────────────────
const {
  activerPartenariat, getCabinetInfo, getMesClients,
  inviterPme, getInvitations, revoquerInvitation, revoquerConnection,
  getInvitationPublic, accepterInvitationPme,
  getEntreprisePublicInfo,
  mettreAJourConnection, getEcheancesFiscales,
} = require('../controllers/cabinetController');

router.post('/cabinets/activer-partenariat', auth, entrepriseAccess(), activerPartenariat);
router.get('/cabinets/me',                   auth, entrepriseAccess(), getCabinetInfo);
router.get('/cabinets/mes-clients',          auth, entrepriseAccess(), getMesClients);
router.get('/cabinets/echeances-fiscales',   auth, entrepriseAccess(), getEcheancesFiscales);
router.post('/cabinets/inviter-pme',         auth, entrepriseAccess(), authLimiter, inviterPme);
router.get('/cabinets/invitations',          auth, entrepriseAccess(), getInvitations);
router.delete('/cabinets/invitations/:id',   auth, entrepriseAccess(), revoquerInvitation);
router.patch('/cabinets/connections/:id',    auth, entrepriseAccess(), mettreAJourConnection);
router.delete('/cabinets/connections/:id',   auth, entrepriseAccess(), revoquerConnection);

// Routes PUBLIQUES (acceptation par la PME prospecte, pas encore inscrite)
router.get('/invitations/cabinet/:token',           getInvitationPublic);
router.post('/invitations/cabinet/:token/accepter', authLimiter, accepterInvitationPme);

// Infos publiques d'une entreprise (nom seul — pour Welcome Modal PME)
router.get('/entreprises/:id/public-info', auth, getEntreprisePublicInfo);

// ─── ADMIN (super-admin uniquement) — migration 029 ─────────────────────────
const { requireSuperAdmin } = require('../middleware/superAdmin');
const {
  getStats: adminGetStats, getCabinetsLeaderboard,
  getRelances: adminGetRelances,
  inviterCabinetDirect, envoyerEmailTest,
} = require('../controllers/adminController');

router.get('/admin/stats',                       auth, requireSuperAdmin, adminGetStats);
router.get('/admin/cabinets',                    auth, requireSuperAdmin, getCabinetsLeaderboard);
router.get('/admin/relances',                    auth, requireSuperAdmin, adminGetRelances);
router.post('/admin/inviter-cabinet',            auth, requireSuperAdmin, inviterCabinetDirect);
router.post('/admin/test-email',                 auth, requireSuperAdmin, envoyerEmailTest);

// ─── ENTREPRISES ───────────────────────────────────────────────────────────
router.get('/entreprises', auth, getMesEntreprises);
router.post('/entreprises', auth, checkQuota('entreprises'), entrepriseRules, validate, createEntreprise);
router.put('/entreprises/:id', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), updateEntreprise);
router.get('/entreprises/:id/membres', auth, can(MODULES.USERS, ACTIONS.READ), getMembres);
router.post('/entreprises/:id/membres', auth, can(MODULES.USERS, ACTIONS.CREATE), checkQuota('utilisateurs'), inviterMembre);
router.put('/entreprises/:id/membres/:userId/role', auth, can(MODULES.USERS, ACTIONS.UPDATE), updateRoleMembre);
// Surcharge personnalisée des permissions d'un membre — Propriétaire / Admin
// uniquement (users.update). Body : { permissions_override: { module: [actions] } }
// ou { permissions_override: null } pour réinitialiser à la matrice rôle.
router.put('/entreprises/:id/membres/:userId/permissions', auth, can(MODULES.USERS, ACTIONS.UPDATE), updatePermissionsMembre);
router.delete('/entreprises/:id/membres/:userId', auth, can(MODULES.USERS, ACTIONS.DELETE), retirerMembre);
// Template de permissions par défaut pour un rôle (utilisé par l'UI
// pour pré-cocher les cases dans la modale d'invitation / édition).
router.get('/permissions/template/:role', auth, can(MODULES.USERS, ACTIONS.READ), getTemplateRole);

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
router.get('/dashboard/stats', auth, can(MODULES.DASHBOARD, ACTIONS.READ), getStats);
router.get('/dashboard/transactions-recentes', auth, can(MODULES.DASHBOARD, ACTIONS.READ), getTransactionsRecentes);
router.get('/dashboard/annees', auth, can(MODULES.DASHBOARD, ACTIONS.READ), getAnneesDisponibles);

// ─── CLIENTS ───────────────────────────────────────────────────────────────
router.get('/clients', auth, can(MODULES.CLIENTS, ACTIONS.READ), getClients);
router.get('/clients/:id', auth, can(MODULES.CLIENTS, ACTIONS.READ), getClientById);
router.post('/clients', auth, can(MODULES.CLIENTS, ACTIONS.CREATE), clientRules, validate, createClient);
router.put('/clients/:id', auth, can(MODULES.CLIENTS, ACTIONS.UPDATE), updateClient);
router.delete('/clients/:id', auth, can(MODULES.CLIENTS, ACTIONS.DELETE), deleteClient);

// ─── IMPORT EN MASSE (Excel / CSV / Sage / Ciel) ──────────────────────────
// `dry_run=true` (défaut) : aperçu validé sans insertion.
// `dry_run=false`         : insertion réelle si zéro erreur (rollback total
//                           à la moindre exception SQL).
// Le `:type` est /clients, /fournisseurs ou /produits — chaque endpoint
// utilise la permission CREATE du module correspondant pour rester
// cohérent avec la matrice de droits.
router.post('/import/clients',      auth, can(MODULES.CLIENTS,      ACTIONS.CREATE), importerClients);
router.post('/import/fournisseurs', auth, can(MODULES.FOURNISSEURS, ACTIONS.CREATE), importerFournisseurs);
router.post('/import/produits',     auth, can(MODULES.PRODUITS,     ACTIONS.CREATE), importerProduits);
// Imports comptables sensibles (gestion du plan, AN, reprise d'historique) :
// permission cloture.create — réservée à l'EC + admin + propriétaire.
// Tous les imports comptables passent par ecritures.create (Propriétaire +
// Admin + EC + Comptable). La clôture annuelle reste exclusivement EC via
// cloture.create — c'est la responsabilité ONECCA distincte de la reprise
// initiale qu'un propriétaire fait au démarrage de son entreprise.
router.post('/import/plan_comptable',         auth, can(MODULES.ECRITURES, ACTIONS.CREATE), importerPlanComptable);
router.post('/import/balance_ouverture',      auth, can(MODULES.ECRITURES, ACTIONS.CREATE), importerBalanceOuverture);
router.post('/import/ecritures_historiques', auth, can(MODULES.ECRITURES, ACTIONS.CREATE), importerEcrituresHistoriques);
// Modèle XLSX vide avec les en-têtes attendues — accessible aux mêmes rôles.
router.get('/import/template/:type', auth, telechargerModele);

// ─── FACTURES ──────────────────────────────────────────────────────────────
router.get('/factures', auth, can(MODULES.FACTURES, ACTIONS.READ), getFactures);
router.get('/factures/:id', auth, can(MODULES.FACTURES, ACTIONS.READ), getFactureById);
router.post('/factures', auth, can(MODULES.FACTURES, ACTIONS.CREATE), checkQuota('factures'), factureRules, validate, createFacture);
router.put('/factures/:id', auth, can(MODULES.FACTURES, ACTIONS.UPDATE), factureRules, validate, updateFacture);
router.put('/factures/:id/statut', auth, can(MODULES.FACTURES, ACTIONS.UPDATE), updateStatut);
// Encaissement = mouvement de trésorerie ; on requiert plutôt tresorerie.update
// pour ne pas autoriser le commercial à manipuler les flux de caisse.
router.post('/factures/:id/paiement', auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), paiementRules, validate, addPaiement);
router.delete('/factures/:id', auth, can(MODULES.FACTURES, ACTIONS.DELETE), deleteFacture);
// Génération d'un lien de paiement Wave pour la facture. Nécessite update
// sur factures (le statut sera modifié au webhook) — le commercial qui
// émet la facture peut donc générer le lien lui-même.
// Génération de lien de paiement — endpoint générique multi-fournisseurs.
// Body : { fournisseur: 'wave' | 'orange_money' | 'mtn_momo', payer_mobile? }
router.post('/factures/:id/lien-paiement',
  auth, can(MODULES.FACTURES, ACTIONS.UPDATE),
  checkQuota('paiement_fournisseurs'), creerLienPaiementFacture);
// Alias rétrocompatible (lot A.1).
router.post('/factures/:id/lien-paiement-wave',
  auth, can(MODULES.FACTURES, ACTIONS.UPDATE),
  checkQuota('paiement_fournisseurs'), creerLienWaveFacture);

// Simulation paiement (mode démo / mock uniquement, multi-fournisseur).
router.post('/factures/:id/lien-paiement-wave/simuler-paiement',
  auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), simulerPaiementWave);

// Certification fiscale DGI (FNE — Facture Normalisée Électronique).
// Mode mock par défaut ; permet de générer numéro FNE + hash + QR code
// même sans raccordement à l'API DGI. Le commercial qui a émis la facture
// peut la certifier (factures.update).
router.post('/factures/:id/certifier-fne',
  auth, can(MODULES.FACTURES, ACTIONS.UPDATE), certifierFactureRoute);
router.get('/factures/:id/certification',
  auth, can(MODULES.FACTURES, ACTIONS.READ), getCertification);
// Configuration FNE (NCC, mode, credentials DGI) — restreint aux profils
// avec entreprise.update car ce sont des identifiants fiscaux sensibles.
router.get('/fne/config', auth, can(MODULES.ENTREPRISE, ACTIONS.READ),   getFneConfig);
router.put('/fne/config', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), putFneConfig);
// Diagnostic temps réel de l'API DGI (utilisé par la pastille verte/rouge
// de l'onglet Paramètres → Fiscal). Le ping HTTP est mis en cache 30 s
// pour limiter la charge côté DGI.
router.get('/fne/ping',           auth, can(MODULES.ENTREPRISE, ACTIONS.READ),   fnePing);
// File d'attente des certifications non confirmées (panne réseau / DGI down).
router.get('/fne/queue',          auth, can(MODULES.ENTREPRISE, ACTIONS.READ),   getQueue);
router.post('/fne/queue/rejouer', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), rejouerQueueRoute);

// Webhooks PUBLICS (Wave / Orange / MTN nous appellent directement).
// La sécurité est assurée par la signature configurée côté fournisseur.
router.post('/webhooks/:fournisseur/:entreprise_id', webhookFournisseur);
// Alias rétrocompatible explicite Wave (lot A.2).
router.post('/webhooks/wave/:entreprise_id', webhookWave);

// ─── INTÉGRATIONS DE PAIEMENT ─────────────────────────────────────────────
// Lecture : tout rôle ayant entreprise.read (paramètres généraux)
router.get('/integrations-paiement', auth, can(MODULES.ENTREPRISE, ACTIONS.READ), listerIntegrations);
// Écriture : seul admin/propriétaire (entreprise.update)
router.put('/integrations-paiement/:fournisseur', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), checkQuota('paiement_fournisseurs'), upsertIntegration);
router.delete('/integrations-paiement/:fournisseur', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), desactiverIntegration);

// ─── DEVIS ─────────────────────────────────────────────────────────────────
router.get('/devis', auth, can(MODULES.DEVIS, ACTIONS.READ), getDevis);
router.get('/devis/stats', auth, can(MODULES.DEVIS, ACTIONS.READ), getStatsDevis);
router.put('/devis/:id/statut', auth, can(MODULES.DEVIS, ACTIONS.UPDATE), updateDevisStatut);
// Convertir un devis = créer une facture : on aligne la permission sur factures.create
router.post('/devis/:id/convertir', auth, can(MODULES.FACTURES, ACTIONS.CREATE), convertirRules, validate, convertirEnFacture);
router.delete('/devis/:id', auth, can(MODULES.DEVIS, ACTIONS.DELETE), supprimerDevis);

// ─── DÉPENSES ──────────────────────────────────────────────────────────────
router.get('/depenses/stats', auth, can(MODULES.DEPENSES, ACTIONS.READ), getStatsDepenses);
router.get('/depenses/categories', auth, can(MODULES.DEPENSES, ACTIONS.READ), getCategories);
router.post('/depenses/categories', auth, can(MODULES.DEPENSES, ACTIONS.CREATE), categorieDepenseRules, validate, createCategorie);
router.get('/depenses', auth, can(MODULES.DEPENSES, ACTIONS.READ), getDepenses);
router.post('/depenses', auth, can(MODULES.DEPENSES, ACTIONS.CREATE), depenseRules, validate, createDepense);
router.put('/depenses/:id', auth, can(MODULES.DEPENSES, ACTIONS.UPDATE), depenseRules, validate, updateDepense);
router.delete('/depenses/:id', auth, can(MODULES.DEPENSES, ACTIONS.DELETE), deleteDepense);

// ─── OCR (scan de factures et reçus) ───────────────────────────────────────
// Réservé à ceux qui peuvent au moins créer une dépense, car le résultat
// sert à pré-remplir un formulaire de dépense ou de facture fournisseur.
router.post('/ocr/scanner',
  auth, can(MODULES.DEPENSES, ACTIONS.CREATE),
  checkQuota('ocr'),
  scannerRules, validate, scannerPiece);

// ─── ABONNEMENT ────────────────────────────────────────────────────────────
// Lecture : tout rôle ayant accès à l'entreprise (utile pour afficher la
// bannière « X scans restants » dans le module dépenses, par ex.).
// Écriture : réservée aux propriétaires/admins via entreprise.update.
router.get('/abonnement', auth, can(MODULES.ENTREPRISE, ACTIONS.READ),   getAbonnement);
router.put('/abonnement', auth, can(MODULES.ENTREPRISE, ACTIONS.UPDATE), putAbonnement);

// ─── TAXES ─────────────────────────────────────────────────────────────────
router.get('/taxes/tableau-de-bord', auth, can(MODULES.TAXES, ACTIONS.READ), getTableauBordTaxes);
router.get('/taxes/calculer-tva', auth, can(MODULES.TAXES, ACTIONS.READ), calculerTVA);
router.get('/taxes', auth, can(MODULES.TAXES, ACTIONS.READ), getTaxes);
router.post('/taxes', auth, can(MODULES.TAXES, ACTIONS.CREATE), taxeRules, validate, createTaxe);
router.post('/taxes/:id/paiement', auth, can(MODULES.TAXES, ACTIONS.UPDATE), paiementTaxeRules, validate, payerTaxe);

// ─── RAPPORTS ──────────────────────────────────────────────────────────────
router.get('/rapports/bilan', auth, can(MODULES.RAPPORTS, ACTIONS.READ), getBilan);
router.get('/rapports/bilan/pdf', auth, can(MODULES.RAPPORTS, ACTIONS.READ), getBilanPDF);
// PDF facture : lecture facture (commercial doit pouvoir imprimer)
router.get('/rapports/facture/:id/pdf', auth, can(MODULES.FACTURES, ACTIONS.READ), getFacturePDF);

// ─── AUDIT LOG ─────────────────────────────────────────────────────────────
router.get('/audit-log', auth, can(MODULES.AUDIT_LOG, ACTIONS.READ), getAuditLog);

// ─── COMPTABILITÉ ──────────────────────────────────────────────────────────
router.get('/comptabilite/plan',         auth, can(MODULES.ECRITURES, ACTIONS.READ), getPlanComptable);
router.get('/comptabilite/journaux',     auth, can(MODULES.ECRITURES, ACTIONS.READ), getJournaux);
router.get('/comptabilite/exercices',    auth, can(MODULES.CLOTURE,   ACTIONS.READ), getExercices);
router.get('/comptabilite/exercices/:id/pre-cloture', auth, can(MODULES.CLOTURE, ACTIONS.READ),   getClotureChecks);
// Clôture annuelle : exclusivité expert_comptable (matrice cloture.create)
router.post('/comptabilite/exercices/:id/cloturer',   auth, can(MODULES.CLOTURE, ACTIONS.CREATE), cloturerExercice);
router.get('/comptabilite/ecritures',    auth, can(MODULES.ECRITURES, ACTIONS.READ),   getEcritures);
router.get('/comptabilite/ecritures/:id',auth, can(MODULES.ECRITURES, ACTIONS.READ),   getEcritureById);
router.post('/comptabilite/ecritures',   auth, can(MODULES.ECRITURES, ACTIONS.CREATE), createEcritureManuelle);
router.get('/comptabilite/grand-livre',  auth, can(MODULES.ECRITURES, ACTIONS.READ),   getGrandLivre);
router.get('/comptabilite/balance',      auth, can(MODULES.ECRITURES, ACTIONS.READ),   getBalance);
// Exports comptables — article 17 OHADA (intangibilité + extraction
// numérique en cas de contrôle DGI). Toutes les routes vérifient
// cloture.read (Propriétaire + Admin + Expert-comptable + Auditeur).
// Journal général = chronologique. Grand-Livre = tri par compte + solde.
router.get('/comptabilite/journal/txt',         auth, can(MODULES.CLOTURE, ACTIONS.READ), exportJournalTxt);
router.get('/comptabilite/journal/excel',       auth, can(MODULES.CLOTURE, ACTIONS.READ), exportJournalExcel);
router.get('/comptabilite/grand-livre/txt',     auth, can(MODULES.CLOTURE, ACTIONS.READ), exportGrandLivreTxt);
router.get('/comptabilite/grand-livre/excel',   auth, can(MODULES.CLOTURE, ACTIONS.READ), exportGrandLivreExcel);
// Alias historique préservé pour compat (= Journal général en TXT)
router.get('/comptabilite/fec',                 auth, can(MODULES.CLOTURE, ACTIONS.READ), exportFEC);

// ─── TRÉSORERIE ────────────────────────────────────────────────────────────
router.get('/tresorerie/operateurs',              auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getOperateurs);
router.get('/tresorerie/comptes',                 auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getComptes);
router.post('/tresorerie/comptes',                auth, can(MODULES.TRESORERIE, ACTIONS.CREATE), compteRules, validate, createCompte);
router.get('/tresorerie/comptes/:id',             auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getCompteById);
router.put('/tresorerie/comptes/:id',             auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), updateCompte);
router.delete('/tresorerie/comptes/:id',          auth, can(MODULES.TRESORERIE, ACTIONS.DELETE), archiveCompte);
router.get('/tresorerie/comptes/:id/mouvements',  auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getMouvements);
router.post('/tresorerie/comptes/:id/mouvements', auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), mouvementRules, validate, createMouvement);
router.delete('/tresorerie/mouvements/:id',       auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), deleteMouvement);
router.post('/tresorerie/transfert',              auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), transfererEntreComptes);

// Relevés et rapprochement
router.get('/tresorerie/comptes/:id/releves',     auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getReleves);
router.post('/tresorerie/comptes/:id/releves',    auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), importerReleve);
router.get('/tresorerie/releves/:id',             auth, can(MODULES.TRESORERIE, ACTIONS.READ),   getReleveDetail);
router.delete('/tresorerie/releves/:id',          auth, can(MODULES.TRESORERIE, ACTIONS.DELETE), deleteReleve);
router.post('/tresorerie/releves/:id/auto-match', auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), autoMatch);
router.post('/tresorerie/lignes-releve/:id/rapprocher',       auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), rapprocherLigne);
router.post('/tresorerie/lignes-releve/:id/delier',           auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), delierLigne);
router.post('/tresorerie/lignes-releve/:id/creer-mouvement',  auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), creerMouvementDepuisLigne);

// ─── PAIE & RH ─────────────────────────────────────────────────────────────
// La matrice paie.* exclut volontairement le comptable interne (confidentialité
// salariale) et tous les rôles legacy (user/lecture). Seuls admin, RH,
// expert_comptable et auditeur lisent ; seuls admin et RH écrivent.
router.get('/paie/parametres',          auth, can(MODULES.PAIE, ACTIONS.READ),   getParametres);
router.get('/paie/stats',               auth, can(MODULES.PAIE, ACTIONS.READ),   getStatsPaie);

// Module paie : la lecture (GET) reste ouverte pour permettre l'aperçu
// en lecture seule sur les paliers qui ne l'incluent pas. Toutes les
// écritures passent par checkQuota('paie') qui refuse 402 si le palier
// autorise 0 bulletin/mois (Découverte, Starter).
// Employés
router.get('/paie/employes',            auth, can(MODULES.PAIE, ACTIONS.READ),   getEmployes);
router.post('/paie/employes',           auth, can(MODULES.PAIE, ACTIONS.CREATE), checkQuota('paie'), employeRules, validate, createEmploye);
router.get('/paie/employes/:id',        auth, can(MODULES.PAIE, ACTIONS.READ),   getEmployeById);
router.put('/paie/employes/:id',        auth, can(MODULES.PAIE, ACTIONS.UPDATE), checkQuota('paie'), updateEmploye);
router.delete('/paie/employes/:id',     auth, can(MODULES.PAIE, ACTIONS.DELETE), checkQuota('paie'), archiveEmploye);

// Rubriques
router.get('/paie/rubriques',           auth, can(MODULES.PAIE, ACTIONS.READ),   getRubriques);
router.post('/paie/rubriques',          auth, can(MODULES.PAIE, ACTIONS.CREATE), checkQuota('paie'), rubriqueRules, validate, createRubrique);
router.put('/paie/rubriques/:id',       auth, can(MODULES.PAIE, ACTIONS.UPDATE), checkQuota('paie'), updateRubrique);
router.delete('/paie/rubriques/:id',    auth, can(MODULES.PAIE, ACTIONS.DELETE), checkQuota('paie'), deleteRubrique);

// Bulletins
router.get('/paie/bulletins',           auth, can(MODULES.PAIE, ACTIONS.READ),   getBulletins);
router.post('/paie/bulletins',          auth, can(MODULES.PAIE, ACTIONS.CREATE), checkQuota('paie'), bulletinRules, validate, creerOuMajBulletin);
router.post('/paie/bulletins/generer-mois', auth, can(MODULES.PAIE, ACTIONS.CREATE), checkQuota('paie'), genererMois);
router.get('/paie/bulletins/:id',       auth, can(MODULES.PAIE, ACTIONS.READ),   getBulletinById);
router.get('/paie/bulletins/:id/pdf',   auth, can(MODULES.PAIE, ACTIONS.READ),   getBulletinPDF);
router.post('/paie/bulletins/:id/valider', auth, can(MODULES.PAIE, ACTIONS.UPDATE), checkQuota('paie'), validerBulletin);
// Paiement bulletin = sortie de trésorerie : on requiert tresorerie.update
router.post('/paie/bulletins/:id/payer',   auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE), payerBulletin);
router.delete('/paie/bulletins/:id',    auth, can(MODULES.PAIE, ACTIONS.DELETE), checkQuota('paie'), supprimerBulletin);

// ─── IMMOBILISATIONS ───────────────────────────────────────────────────────
router.get('/immobilisations/categories',         auth, can(MODULES.IMMOBILISATIONS, ACTIONS.READ),   getCategoriesImmo);
router.get('/immobilisations/stats',              auth, can(MODULES.IMMOBILISATIONS, ACTIONS.READ),   getStatsImmo);
router.get('/immobilisations',                    auth, can(MODULES.IMMOBILISATIONS, ACTIONS.READ),   getImmobilisations);
// Toutes les actions d'écriture sur immobilisations sont protégées par
// le quota du module (booléen disponible/indisponible selon le palier).
// La lecture (GET) reste ouverte pour permettre l'aperçu en mode "lecture
// seule" côté front quand le module n'est pas inclus dans la formule.
router.post('/immobilisations',                   auth, can(MODULES.IMMOBILISATIONS, ACTIONS.CREATE), checkQuota('immobilisations'), immobilisationRules, validate, createImmobilisation);
router.post('/immobilisations/depuis-depense/:depenseId', auth, can(MODULES.IMMOBILISATIONS, ACTIONS.CREATE), checkQuota('immobilisations'), creerDepuisDepense);
router.post('/immobilisations/dotations/generer', auth, can(MODULES.IMMOBILISATIONS, ACTIONS.UPDATE), checkQuota('immobilisations'), genererDotationsAnnee);
router.delete('/immobilisations/dotations/:id',   auth, can(MODULES.IMMOBILISATIONS, ACTIONS.DELETE), checkQuota('immobilisations'), supprimerDotation);
router.get('/immobilisations/:id',                auth, can(MODULES.IMMOBILISATIONS, ACTIONS.READ),   getImmobilisationById);
router.put('/immobilisations/:id',                auth, can(MODULES.IMMOBILISATIONS, ACTIONS.UPDATE), checkQuota('immobilisations'), updateImmobilisation);
router.delete('/immobilisations/:id',             auth, can(MODULES.IMMOBILISATIONS, ACTIONS.DELETE), checkQuota('immobilisations'), deleteImmobilisation);
router.post('/immobilisations/:id/cession',       auth, can(MODULES.IMMOBILISATIONS, ACTIONS.UPDATE), checkQuota('immobilisations'), cederImmobilisation);
router.get('/immobilisations/:id/pdf',            auth, can(MODULES.IMMOBILISATIONS, ACTIONS.READ),   getTableauAmortissementPDF);

// ─── PRODUITS / STOCKS ─────────────────────────────────────────────────────
router.get('/produits/categories',        auth, can(MODULES.PRODUITS, ACTIONS.READ),   getCategoriesProduits);
router.post('/produits/categories',       auth, can(MODULES.PRODUITS, ACTIONS.CREATE), createCategorieProduit);
router.get('/produits/stats',             auth, can(MODULES.PRODUITS, ACTIONS.READ),   getStatsProduits);
router.get('/produits/stocks/mouvements', auth, can(MODULES.PRODUITS, ACTIONS.READ),   getJournalMouvements);

// Inventaires (avant /:id pour éviter conflits)
router.get('/produits/inventaires',           auth, can(MODULES.PRODUITS, ACTIONS.READ),   getInventaires);
router.post('/produits/inventaires',          auth, can(MODULES.PRODUITS, ACTIONS.CREATE), creerInventaire);
router.get('/produits/inventaires/:id',       auth, can(MODULES.PRODUITS, ACTIONS.READ),   getInventaireById);
router.put('/produits/inventaires/:id/lignes',auth, can(MODULES.PRODUITS, ACTIONS.UPDATE), majLignesInventaire);
router.post('/produits/inventaires/:id/valider', auth, can(MODULES.PRODUITS, ACTIONS.UPDATE), validerInventaire);
router.delete('/produits/inventaires/:id',    auth, can(MODULES.PRODUITS, ACTIONS.DELETE), supprimerInventaire);

// Produits
router.get('/produits',               auth, can(MODULES.PRODUITS, ACTIONS.READ),   getProduits);
router.post('/produits',              auth, can(MODULES.PRODUITS, ACTIONS.CREATE), produitRules, validate, createProduit);
router.get('/produits/:id',           auth, can(MODULES.PRODUITS, ACTIONS.READ),   getProduitById);
router.put('/produits/:id',           auth, can(MODULES.PRODUITS, ACTIONS.UPDATE), updateProduit);
router.delete('/produits/:id',        auth, can(MODULES.PRODUITS, ACTIONS.DELETE), archiveProduit);
router.post('/produits/:id/mouvement', auth, can(MODULES.PRODUITS, ACTIONS.UPDATE), creerMouvement);
router.get('/produits/:id/mouvements', auth, can(MODULES.PRODUITS, ACTIONS.READ),   getMouvementsProduit);

// ─── FOURNISSEURS ─────────────────────────────────────────────────────────
router.get('/fournisseurs/stats',          auth, can(MODULES.FOURNISSEURS, ACTIONS.READ),   getStatsFournisseurs);
router.post('/fournisseurs/paiements',     auth, can(MODULES.TRESORERIE, ACTIONS.UPDATE),   paiementFournisseurRules, validate, creerPaiementFournisseur);
router.get('/fournisseurs',                auth, can(MODULES.FOURNISSEURS, ACTIONS.READ),   getFournisseurs);
router.post('/fournisseurs',               auth, can(MODULES.FOURNISSEURS, ACTIONS.CREATE), fournisseurRules, validate, createFournisseur);
router.get('/fournisseurs/:id',            auth, can(MODULES.FOURNISSEURS, ACTIONS.READ),   getFournisseurById);
router.put('/fournisseurs/:id',            auth, can(MODULES.FOURNISSEURS, ACTIONS.UPDATE), updateFournisseur);
router.delete('/fournisseurs/:id',         auth, can(MODULES.FOURNISSEURS, ACTIONS.DELETE), archiveFournisseur);
router.get('/fournisseurs/:id/paiements',  auth, can(MODULES.TRESORERIE,   ACTIONS.READ),   getPaiementsFournisseur);

// ─── COMMANDES D'ACHAT ────────────────────────────────────────────────────
// Les commandes d'achat sont rattachées au scope fournisseurs (négociation
// commerciale) sauf la réception qui ajuste les stocks (produits.update).
router.get('/commandes-achat',                  auth, can(MODULES.FOURNISSEURS, ACTIONS.READ),   getCommandes);
router.post('/commandes-achat',                 auth, can(MODULES.FOURNISSEURS, ACTIONS.CREATE), commandeRules, validate, createCommande);
router.get('/commandes-achat/:id',              auth, can(MODULES.FOURNISSEURS, ACTIONS.READ),   getCommandeById);
router.delete('/commandes-achat/:id',           auth, can(MODULES.FOURNISSEURS, ACTIONS.DELETE), supprimerCommande);
router.post('/commandes-achat/:id/envoyer',     auth, can(MODULES.FOURNISSEURS, ACTIONS.UPDATE), envoyerCommande);
router.post('/commandes-achat/:id/receptionner',auth, can(MODULES.PRODUITS,     ACTIONS.UPDATE), receptionnerCommande);
router.post('/commandes-achat/:id/facturer',    auth, can(MODULES.DEPENSES,     ACTIONS.CREATE), facturerCommande);
router.post('/commandes-achat/:id/annuler',     auth, can(MODULES.FOURNISSEURS, ACTIONS.UPDATE), annulerCommande);

module.exports = router;