const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const auth = require('../middleware/auth');
const entrepriseAccess = require('../middleware/entreprise');
const validate = require('../middleware/validate');

const { register, login, me, updateLangue, loginDemo, getInvitation, accepterInvitation, registerRules, loginRules } = require('../controllers/authController');
const {
  getMesEntreprises, createEntreprise, updateEntreprise,
  getMembres, inviterMembre, updateRoleMembre, retirerMembre, entrepriseRules,
} = require('../controllers/entreprisesController');
const { getClients, getClientById, createClient, updateClient, deleteClient, clientRules } = require('../controllers/clientsController');
const { getFactures, getFactureById, createFacture, updateFacture, updateStatut, addPaiement, deleteFacture, factureRules, paiementRules } = require('../controllers/facturesController');
const { getDevis, getStatsDevis, updateDevisStatut, convertirEnFacture, supprimerDevis, convertirRules } = require('../controllers/devisController');
const { getStats, getTransactionsRecentes, getAnneesDisponibles } = require('../controllers/dashboardController');
const { getBilan, getBilanPDF, getFacturePDF } = require('../controllers/rapportsController');
const { getDepenses, getStatsDepenses, createDepense, updateDepense, deleteDepense, getCategories, createCategorie, depenseRules, categorieDepenseRules } = require('../controllers/depensesController');
const { getTaxes, getTableauBordTaxes, createTaxe, payerTaxe, calculerTVA, taxeRules, paiementTaxeRules } = require('../controllers/taxesController');
const { getAuditLog } = require('../controllers/auditController');
const {
  getPlanComptable, getJournaux, getExercices,
  getEcritures, getEcritureById, getGrandLivre, getBalance,
  createEcritureManuelle, exportFEC,
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

const ea      = entrepriseAccess();
const eaWrite = entrepriseAccess(['proprietaire', 'admin', 'comptable']);
const eaAdmin = entrepriseAccess(['proprietaire', 'admin']);
// Paie & RH : accessible au comptable ET au rôle dédié "rh", en lecture comme en écriture.
// Volontairement appliqué aussi aux GET : les bulletins/salaires ne doivent pas être
// lisibles par les rôles 'user'/'lecture'.
const eaPaie      = entrepriseAccess(['proprietaire', 'admin', 'comptable', 'rh']);
const eaPaieAdmin = entrepriseAccess(['proprietaire', 'admin', 'rh']);

// ─── AUTH ──────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, registerRules, validate, register);
router.post('/auth/login',    authLimiter, loginRules,    validate, login);
router.post('/auth/demo',     demoLimiter, loginDemo);
router.get('/auth/me', auth, me);
router.put('/auth/me/langue', auth, updateLangue);
// Invitations — routes publiques (pas d'auth : l'invité n'a pas encore de compte actif)
router.get('/auth/invitation/:token',  getInvitation);
router.post('/auth/invitation/:token', authLimiter, accepterInvitation);

// ─── ENTREPRISES ───────────────────────────────────────────────────────────
router.get('/entreprises', auth, getMesEntreprises);
router.post('/entreprises', auth, entrepriseRules, validate, createEntreprise);
router.put('/entreprises/:id', auth, eaAdmin, updateEntreprise);
router.get('/entreprises/:id/membres', auth, ea, getMembres);
router.post('/entreprises/:id/membres', auth, eaAdmin, inviterMembre);
router.put('/entreprises/:id/membres/:userId/role', auth, eaAdmin, updateRoleMembre);
router.delete('/entreprises/:id/membres/:userId', auth, eaAdmin, retirerMembre);

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
router.get('/dashboard/stats', auth, ea, getStats);
router.get('/dashboard/transactions-recentes', auth, ea, getTransactionsRecentes);
router.get('/dashboard/annees', auth, ea, getAnneesDisponibles);

// ─── CLIENTS ───────────────────────────────────────────────────────────────
router.get('/clients', auth, ea, getClients);
router.get('/clients/:id', auth, ea, getClientById);
router.post('/clients', auth, eaWrite, clientRules, validate, createClient);
router.put('/clients/:id', auth, eaWrite, updateClient);
router.delete('/clients/:id', auth, eaAdmin, deleteClient);

// ─── FACTURES ──────────────────────────────────────────────────────────────
router.get('/factures', auth, ea, getFactures);
router.get('/factures/:id', auth, ea, getFactureById);
router.post('/factures', auth, eaWrite, factureRules, validate, createFacture);
router.put('/factures/:id', auth, eaWrite, factureRules, validate, updateFacture);
router.put('/factures/:id/statut', auth, eaWrite, updateStatut);
router.post('/factures/:id/paiement', auth, eaWrite, paiementRules, validate, addPaiement);
router.delete('/factures/:id', auth, eaAdmin, deleteFacture);

// ─── DEVIS ─────────────────────────────────────────────────────────────────
router.get('/devis', auth, ea, getDevis);
router.get('/devis/stats', auth, ea, getStatsDevis);
router.put('/devis/:id/statut', auth, eaWrite, updateDevisStatut);
router.post('/devis/:id/convertir', auth, eaWrite, convertirRules, validate, convertirEnFacture);
router.delete('/devis/:id', auth, eaWrite, supprimerDevis);

// ─── DÉPENSES ──────────────────────────────────────────────────────────────
router.get('/depenses/stats', auth, ea, getStatsDepenses);
router.get('/depenses/categories', auth, ea, getCategories);
router.post('/depenses/categories', auth, eaWrite, categorieDepenseRules, validate, createCategorie);
router.get('/depenses', auth, ea, getDepenses);
router.post('/depenses', auth, eaWrite, depenseRules, validate, createDepense);
router.put('/depenses/:id', auth, eaWrite, depenseRules, validate, updateDepense);
router.delete('/depenses/:id', auth, eaAdmin, deleteDepense);

// ─── TAXES ─────────────────────────────────────────────────────────────────
router.get('/taxes/tableau-de-bord', auth, ea, getTableauBordTaxes);
router.get('/taxes/calculer-tva', auth, ea, calculerTVA);
router.get('/taxes', auth, ea, getTaxes);
router.post('/taxes', auth, eaWrite, taxeRules, validate, createTaxe);
router.post('/taxes/:id/paiement', auth, eaWrite, paiementTaxeRules, validate, payerTaxe);

// ─── RAPPORTS ──────────────────────────────────────────────────────────────
router.get('/rapports/bilan', auth, ea, getBilan);
router.get('/rapports/bilan/pdf', auth, ea, getBilanPDF);
router.get('/rapports/facture/:id/pdf', auth, ea, getFacturePDF);

// ─── AUDIT LOG ─────────────────────────────────────────────────────────────
router.get('/audit-log', auth, eaAdmin, getAuditLog);

// ─── COMPTABILITÉ ──────────────────────────────────────────────────────────
router.get('/comptabilite/plan',         auth, ea,      getPlanComptable);
router.get('/comptabilite/journaux',     auth, ea,      getJournaux);
router.get('/comptabilite/exercices',    auth, ea,      getExercices);
router.get('/comptabilite/exercices/:id/pre-cloture', auth, ea,       getClotureChecks);
router.post('/comptabilite/exercices/:id/cloturer',   auth, eaAdmin,  cloturerExercice);
router.get('/comptabilite/ecritures',    auth, ea,      getEcritures);
router.get('/comptabilite/ecritures/:id',auth, ea,      getEcritureById);
router.post('/comptabilite/ecritures',   auth, eaWrite, createEcritureManuelle);
router.get('/comptabilite/grand-livre',  auth, ea,      getGrandLivre);
router.get('/comptabilite/balance',      auth, ea,      getBalance);
router.get('/comptabilite/fec',          auth, eaAdmin, exportFEC);

// ─── TRÉSORERIE ────────────────────────────────────────────────────────────
router.get('/tresorerie/operateurs',              auth, ea,      getOperateurs);
router.get('/tresorerie/comptes',                 auth, ea,      getComptes);
router.post('/tresorerie/comptes',                auth, eaWrite, compteRules, validate, createCompte);
router.get('/tresorerie/comptes/:id',             auth, ea,      getCompteById);
router.put('/tresorerie/comptes/:id',             auth, eaWrite, updateCompte);
router.delete('/tresorerie/comptes/:id',          auth, eaAdmin, archiveCompte);
router.get('/tresorerie/comptes/:id/mouvements',  auth, ea,      getMouvements);
router.post('/tresorerie/comptes/:id/mouvements', auth, eaWrite, mouvementRules, validate, createMouvement);
router.delete('/tresorerie/mouvements/:id',       auth, eaWrite, deleteMouvement);
router.post('/tresorerie/transfert',              auth, eaWrite, transfererEntreComptes);

// Relevés et rapprochement
router.get('/tresorerie/comptes/:id/releves',     auth, ea,      getReleves);
router.post('/tresorerie/comptes/:id/releves',    auth, eaWrite, importerReleve);
router.get('/tresorerie/releves/:id',             auth, ea,      getReleveDetail);
router.delete('/tresorerie/releves/:id',          auth, eaAdmin, deleteReleve);
router.post('/tresorerie/releves/:id/auto-match', auth, eaWrite, autoMatch);
router.post('/tresorerie/lignes-releve/:id/rapprocher',       auth, eaWrite, rapprocherLigne);
router.post('/tresorerie/lignes-releve/:id/delier',           auth, eaWrite, delierLigne);
router.post('/tresorerie/lignes-releve/:id/creer-mouvement',  auth, eaWrite, creerMouvementDepuisLigne);

// ─── PAIE & RH ─────────────────────────────────────────────────────────────
// Toutes les routes /paie/* sont réservées à proprietaire/admin/comptable/rh
// (eaPaie), y compris les lectures : les salaires et bulletins ne doivent pas
// être accessibles aux rôles 'user'/'lecture'.
router.get('/paie/parametres',          auth, eaPaie,      getParametres);
router.get('/paie/stats',               auth, eaPaie,      getStatsPaie);

// Employés
router.get('/paie/employes',            auth, eaPaie,      getEmployes);
router.post('/paie/employes',           auth, eaPaie,      employeRules, validate, createEmploye);
router.get('/paie/employes/:id',        auth, eaPaie,      getEmployeById);
router.put('/paie/employes/:id',        auth, eaPaie,      updateEmploye);
router.delete('/paie/employes/:id',     auth, eaPaieAdmin, archiveEmploye);

// Rubriques
router.get('/paie/rubriques',           auth, eaPaie,      getRubriques);
router.post('/paie/rubriques',          auth, eaPaie,      rubriqueRules, validate, createRubrique);
router.put('/paie/rubriques/:id',       auth, eaPaie,      updateRubrique);
router.delete('/paie/rubriques/:id',    auth, eaPaieAdmin, deleteRubrique);

// Bulletins
router.get('/paie/bulletins',           auth, eaPaie,      getBulletins);
router.post('/paie/bulletins',          auth, eaPaie,      bulletinRules, validate, creerOuMajBulletin);
router.post('/paie/bulletins/generer-mois', auth, eaPaie,  genererMois);
router.get('/paie/bulletins/:id',       auth, eaPaie,      getBulletinById);
router.get('/paie/bulletins/:id/pdf',   auth, eaPaie,      getBulletinPDF);
router.post('/paie/bulletins/:id/valider', auth, eaPaie,   validerBulletin);
router.post('/paie/bulletins/:id/payer',   auth, eaPaie,   payerBulletin);
router.delete('/paie/bulletins/:id',    auth, eaPaie,      supprimerBulletin);

// ─── IMMOBILISATIONS ───────────────────────────────────────────────────────
router.get('/immobilisations/categories',         auth, ea,      getCategoriesImmo);
router.get('/immobilisations/stats',              auth, ea,      getStatsImmo);
router.get('/immobilisations',                    auth, ea,      getImmobilisations);
router.post('/immobilisations',                   auth, eaWrite, immobilisationRules, validate, createImmobilisation);
router.post('/immobilisations/depuis-depense/:depenseId', auth, eaWrite, creerDepuisDepense);
router.post('/immobilisations/dotations/generer', auth, eaWrite, genererDotationsAnnee);
router.delete('/immobilisations/dotations/:id',   auth, eaAdmin, supprimerDotation);
router.get('/immobilisations/:id',                auth, ea,      getImmobilisationById);
router.put('/immobilisations/:id',                auth, eaWrite, updateImmobilisation);
router.delete('/immobilisations/:id',             auth, eaAdmin, deleteImmobilisation);
router.post('/immobilisations/:id/cession',       auth, eaWrite, cederImmobilisation);
router.get('/immobilisations/:id/pdf',            auth, ea,      getTableauAmortissementPDF);

// ─── PRODUITS / STOCKS ─────────────────────────────────────────────────────
router.get('/produits/categories',        auth, ea,      getCategoriesProduits);
router.post('/produits/categories',       auth, eaWrite, createCategorieProduit);
router.get('/produits/stats',             auth, ea,      getStatsProduits);
router.get('/produits/stocks/mouvements', auth, ea,      getJournalMouvements);

// Inventaires (avant /:id pour éviter conflits)
router.get('/produits/inventaires',           auth, ea,      getInventaires);
router.post('/produits/inventaires',          auth, eaWrite, creerInventaire);
router.get('/produits/inventaires/:id',       auth, ea,      getInventaireById);
router.put('/produits/inventaires/:id/lignes',auth, eaWrite, majLignesInventaire);
router.post('/produits/inventaires/:id/valider', auth, eaWrite, validerInventaire);
router.delete('/produits/inventaires/:id',    auth, eaWrite, supprimerInventaire);

// Produits
router.get('/produits',               auth, ea,      getProduits);
router.post('/produits',              auth, eaWrite, produitRules, validate, createProduit);
router.get('/produits/:id',           auth, ea,      getProduitById);
router.put('/produits/:id',           auth, eaWrite, updateProduit);
router.delete('/produits/:id',        auth, eaAdmin, archiveProduit);
router.post('/produits/:id/mouvement', auth, eaWrite, creerMouvement);
router.get('/produits/:id/mouvements', auth, ea,      getMouvementsProduit);

// ─── FOURNISSEURS ─────────────────────────────────────────────────────────
router.get('/fournisseurs/stats',          auth, ea,      getStatsFournisseurs);
router.post('/fournisseurs/paiements',     auth, eaWrite, paiementFournisseurRules, validate, creerPaiementFournisseur);
router.get('/fournisseurs',                auth, ea,      getFournisseurs);
router.post('/fournisseurs',               auth, eaWrite, fournisseurRules, validate, createFournisseur);
router.get('/fournisseurs/:id',            auth, ea,      getFournisseurById);
router.put('/fournisseurs/:id',            auth, eaWrite, updateFournisseur);
router.delete('/fournisseurs/:id',         auth, eaAdmin, archiveFournisseur);
router.get('/fournisseurs/:id/paiements',  auth, ea,      getPaiementsFournisseur);

// ─── COMMANDES D'ACHAT ────────────────────────────────────────────────────
router.get('/commandes-achat',                  auth, ea,      getCommandes);
router.post('/commandes-achat',                 auth, eaWrite, commandeRules, validate, createCommande);
router.get('/commandes-achat/:id',              auth, ea,      getCommandeById);
router.delete('/commandes-achat/:id',           auth, eaAdmin, supprimerCommande);
router.post('/commandes-achat/:id/envoyer',     auth, eaWrite, envoyerCommande);
router.post('/commandes-achat/:id/receptionner',auth, eaWrite, receptionnerCommande);
router.post('/commandes-achat/:id/facturer',    auth, eaWrite, facturerCommande);
router.post('/commandes-achat/:id/annuler',     auth, eaWrite, annulerCommande);

module.exports = router;