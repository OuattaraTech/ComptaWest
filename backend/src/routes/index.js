const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const auth = require('../middleware/auth');
const entrepriseAccess = require('../middleware/entreprise');
const validate = require('../middleware/validate');

const { register, login, me, loginDemo, registerRules, loginRules } = require('../controllers/authController');
const {
  getMesEntreprises, createEntreprise, updateEntreprise,
  getMembres, inviterMembre, updateRoleMembre, retirerMembre, entrepriseRules,
} = require('../controllers/entreprisesController');
const { getClients, getClientById, createClient, updateClient, deleteClient, clientRules } = require('../controllers/clientsController');
const { getFactures, getFactureById, createFacture, updateStatut, addPaiement, deleteFacture, factureRules, paiementRules } = require('../controllers/facturesController');
const { getStats, getTransactionsRecentes, getAnneesDisponibles } = require('../controllers/dashboardController');
const { getBilan, getFacturePDF } = require('../controllers/rapportsController');
const { getDepenses, getStatsDepenses, createDepense, updateDepense, deleteDepense, getCategories, createCategorie } = require('../controllers/depensesController');
const { getTaxes, getTableauBordTaxes, createTaxe, payerTaxe, calculerTVA } = require('../controllers/taxesController');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

const ea      = entrepriseAccess();
const eaWrite = entrepriseAccess(['proprietaire', 'admin', 'comptable']);
const eaAdmin = entrepriseAccess(['proprietaire', 'admin']);

// ─── AUTH ──────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, registerRules, validate, register);
router.post('/auth/login',    authLimiter, loginRules,    validate, login);
router.post('/auth/demo',     loginDemo);
router.get('/auth/me', auth, me);

// ─── ENTREPRISES ───────────────────────────────────────────────────────────
router.get('/entreprises', auth, getMesEntreprises);
router.post('/entreprises', auth, entrepriseRules, validate, createEntreprise);
router.put('/entreprises/:id', auth, updateEntreprise);
router.get('/entreprises/:id/membres', auth, getMembres);
router.post('/entreprises/:id/membres', auth, inviterMembre);
router.put('/entreprises/:id/membres/:userId/role', auth, updateRoleMembre);
router.delete('/entreprises/:id/membres/:userId', auth, retirerMembre);

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
router.put('/factures/:id/statut', auth, eaWrite, updateStatut);
router.post('/factures/:id/paiement', auth, eaWrite, paiementRules, validate, addPaiement);
router.delete('/factures/:id', auth, eaAdmin, deleteFacture);

// ─── DÉPENSES ──────────────────────────────────────────────────────────────
router.get('/depenses/stats', auth, ea, getStatsDepenses);
router.get('/depenses/categories', auth, ea, getCategories);
router.post('/depenses/categories', auth, eaWrite, createCategorie);
router.get('/depenses', auth, ea, getDepenses);
router.post('/depenses', auth, eaWrite, createDepense);
router.put('/depenses/:id', auth, eaWrite, updateDepense);
router.delete('/depenses/:id', auth, eaAdmin, deleteDepense);

// ─── TAXES ─────────────────────────────────────────────────────────────────
router.get('/taxes/tableau-de-bord', auth, ea, getTableauBordTaxes);
router.get('/taxes/calculer-tva', auth, ea, calculerTVA);
router.get('/taxes', auth, ea, getTaxes);
router.post('/taxes', auth, eaWrite, createTaxe);
router.post('/taxes/:id/paiement', auth, eaWrite, payerTaxe);

// ─── RAPPORTS ──────────────────────────────────────────────────────────────
router.get('/rapports/bilan', auth, ea, getBilan);
router.get('/rapports/facture/:id/pdf', auth, ea, getFacturePDF);

module.exports = router;