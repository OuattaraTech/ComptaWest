/**
 * Contenu d'onboarding pour chaque page de ApeX.
 *
 * Structure :
 *   - intro     : slides du modal d'introduction (vue d'ensemble de la page)
 *   - spotlight : étapes du tour guidé (cible un sélecteur DOM via data-onboarding)
 *
 * Chaque entrée intro : { titre, description, icon, points[] }
 * Chaque entrée spotlight : { target, titre, description, position? }
 *
 * Versionnage : bumper ONBOARDING_VERSION à chaque refonte significative
 * (ajout de slides sur des fonctionnalités nouvelles) pour que les
 * utilisateurs existants re-voient le tour automatiquement.
 *
 *   v1 — version initiale (avril 2026)
 *   v2 — ajouts mai 2026 : Mobile Money multi-fournisseurs, OCR scanner,
 *        certification DGI/FNE, refonte des rôles (10 rôles), onglets
 *        Paramètres → Intégrations et Fiscal.
 */
export const ONBOARDING_VERSION = 2;
import {
  LayoutDashboard, Users, FileText, Wallet, Receipt,
  BarChart3, BookOpen, Shield, ShieldCheck, Settings,
  TrendingUp, AlertCircle, Calendar, Calculator, Plus,
  Download, Filter, Eye, CheckCircle2, PieChart, Building2,
  Smartphone, Banknote, Upload, Link2, ArrowLeftRight,
  UserCheck, Briefcase, CreditCard,
  Package, TrendingDown,
  Box, ClipboardCheck, AlertTriangle,
  Truck, ShoppingCart, Clock,
  Camera, MessageCircle, Sparkles, QrCode,
} from 'lucide-react';

export const ONBOARDING = {
  // ─── DASHBOARD ──────────────────────────────────────────────────────────
  dashboard: {
    titre: 'Tableau de bord',
    sousTitre: 'Vue d\'ensemble de votre activité',
    intro: [
      {
        icon: LayoutDashboard,
        titre: 'Bienvenue sur votre tableau de bord',
        description: 'Le tableau de bord est le point de départ de ApeX. Il rassemble en un coup d\'œil toutes les informations essentielles de votre entreprise.',
        points: [
          'Indicateurs clés : chiffre d\'affaires, charges, bénéfice',
          'Alertes sur les factures en retard et taxes dues',
          'Évolution mensuelle des recettes et dépenses',
          'Top clients et répartition des charges',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'Suivi en temps réel',
        description: 'Les chiffres se mettent à jour automatiquement à chaque facture, dépense ou paiement enregistré. Utilisez le sélecteur d\'année pour comparer vos performances.',
        points: [
          'Filtrage par année comptable',
          'Graphiques interactifs (survol pour le détail)',
          'Données synchronisées avec tous les modules',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Alertes intelligentes',
        description: 'ApeX vous prévient automatiquement des échéances importantes : factures impayées, taxes à régler, déclarations à venir.',
        points: [
          'Notifications visuelles en haut du tableau de bord',
          'Lien direct vers l\'élément concerné',
        ],
      },
      {
        icon: AlertTriangle,
        titre: 'Ce que les KPIs comptent (et ce qu\'ils ne comptent PAS)',
        description: 'Pour rester comptablement juste, les chiffres du tableau de bord sont calculés sur les factures uniquement. Les devis, proformas et factures annulées sont exclus.',
        points: [
          '**Chiffre d\'affaires** : factures émises (hors devis, proformas et annulations)',
          '**Encaissé** : montant réellement reçu sur les factures payées',
          '**Dépenses** : seulement les charges payées (les en attente ne pèsent pas sur le bénéfice)',
          '**Top clients** : classés sur leur CA facturé (pas leurs devis)',
        ],
      },
      {
        icon: Sparkles,
        titre: 'Les outils qui font la différence',
        description: 'ApeX va au-delà de la comptabilité classique : trois leviers concrets pour réduire votre charge administrative quotidienne et accélérer vos encaissements.',
        points: [
          '**Lien de paiement Mobile Money** (Factures) — Wave, Orange Money, MTN MoMo : le client paie en deux clics depuis WhatsApp ou un QR code, l\'encaissement est automatique.',
          '**Scanner OCR** (Dépenses & Commandes d\'achat) — photographiez une facture, ApeX extrait fournisseur, date, montants et TVA pour pré-remplir la saisie.',
          '**Certification fiscale DGI / FNE** (Factures) — chaque facture émise reçoit un numéro fiscal officiel et un QR code de vérification opposable.',
          'Tout est configurable depuis Paramètres → Intégrations (Mobile Money) et Paramètres → Fiscal (DGI).',
        ],
      },
    ],
    spotlight: [
      { target: 'header', titre: 'Salutation dynamique', description: 'L\'en-tête s\'adapte au moment de la journée (matin, après-midi, soir) et affiche le nom de l\'entreprise active, son régime et l\'année comptable.' },
      { target: 'annee-selector', titre: 'Sélecteur d\'année', description: 'Changez d\'année comptable pour consulter ou comparer les données d\'un autre exercice.' },
      { target: 'raccourcis', titre: 'Raccourcis productifs', description: 'Accédez en un clic aux outils différenciants : scanner une facture (OCR), générer un lien Mobile Money, certifier auprès de la DGI, configurer vos intégrations.' },
      { target: 'kpis', titre: 'Indicateurs clés (KPI)', description: 'CA, dépenses, taxes dues, bénéfice net, marge et clients actifs. Devis et proformas exclus pour rester comptablement justes.' },
      { target: 'graphiques', titre: 'Graphiques d\'évolution', description: 'Évolution mensuelle recettes/dépenses/bénéfice, structure des charges par catégorie SYSCOHADA, top 5 clients de l\'exercice et transactions récentes.' },
    ],
  },

  // ─── CLIENTS ────────────────────────────────────────────────────────────
  clients: {
    titre: 'Gestion des clients',
    sousTitre: 'Tiers 411 SYSCOHADA · CA et encours par client · historique',
    intro: [
      {
        icon: Users,
        titre: 'Votre fichier clients',
        description: 'Cette page centralise tous vos clients (entreprises et particuliers). Chaque fiche est un tiers comptable 411 et conserve l\'historique complet de ses factures, devis et paiements.',
        points: [
          'Type entreprise ou particulier',
          'Code interne (CLI-NNN) attribué automatiquement',
          'Coordonnées complètes pour la facturation',
          'Identifiants fiscaux NINEA/NCC et RCCM (apparaissent sur le PDF facture)',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'CA et encours suivis automatiquement',
        description: 'Chaque ligne client affiche directement le nombre de factures, le chiffre d\'affaires total et l\'encours (somme des montants restant à encaisser). Les devis et proformas n\'entrent pas dans ces chiffres — c\'est la vue comptable, pas la vue commerciale.',
        points: [
          'CA total = somme des factures (hors devis et proformas)',
          'Encours = montant non encore encaissé sur les factures en attente ou en retard',
          'Mise à jour temps réel à chaque facture ou encaissement',
        ],
      },
      {
        icon: Plus,
        titre: 'Ajouter un client',
        description: 'Indispensable avant d\'émettre une facture ou un devis. Renseignez au minimum le nom — les autres champs peuvent être complétés plus tard.',
        points: [
          'Champ obligatoire : nom',
          'Recommandés : email (pour l\'envoi PDF), NINEA, adresse',
          'Le client apparaît immédiatement dans le sélecteur des modules Factures et Devis',
        ],
      },
      {
        icon: Eye,
        titre: 'Consulter une fiche client',
        description: 'Cliquez sur un client pour voir ses 10 dernières factures, son total facturé, son encours et l\'historique complet.',
        points: [
          'Liste des factures (les devis sont sur la page Devis dédiée)',
          'Total facturé, payé, restant dû',
          'Modification ou archivage de la fiche',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Ajouter un client', description: 'Indispensable avant de créer une facture ou un devis. Nom obligatoire ; le reste peut être complété plus tard.' },
      { target: 'liste-clients', titre: 'Liste des clients', description: 'Chaque ligne affiche le code, le nom, le nombre de factures, le CA total et l\'encours restant à encaisser.' },
    ],
  },

  // ─── FACTURES ───────────────────────────────────────────────────────────
  factures: {
    titre: 'Facturation',
    sousTitre: 'Factures et avoirs · paiements · écritures et stock automatiques',
    intro: [
      {
        icon: FileText,
        titre: 'Le cœur de votre activité commerciale',
        description: 'Émettez vos factures (F-AAAA-NNN) et avoirs (AV-AAAA-NNN). ApeX calcule la TVA, génère le PDF, met à jour la comptabilité et les stocks. Les devis et proformas ont leur page dédiée.',
        points: [
          'Numérotation automatique séquentielle par année',
          'Calcul TVA et totaux automatiques (0 %, 9 %, 18 %)',
          'Conditions de paiement pré-paramétrées (30/45/60 j, comptant, livraison)',
          'Export PDF professionnel en un clic',
        ],
      },
      {
        icon: Box,
        titre: 'Lignes liées au catalogue produits',
        description: 'Tapez les premières lettres du libellé d\'un produit du catalogue dans la description : son prix, son unité et sa TVA s\'auto-remplissent. La ligne reste liée au produit pour la sortie de stock.',
        points: [
          'Auto-complétion depuis le catalogue Produits & Stocks',
          'Le prix de vente HT et la TVA proviennent de la fiche produit',
          'Possibilité de mélanger lignes catalogue et descriptions libres',
          'Remise en pourcentage par ligne',
        ],
      },
      {
        icon: CheckCircle2,
        titre: 'Brouillon vs Validation',
        description: 'Tant qu\'une facture est en brouillon, elle est modifiable, supprimable, et aucune trace comptable n\'est laissée. La validation est l\'acte engageant.',
        points: [
          '**Brouillon** : aucune écriture, aucune sortie de stock',
          '**Valider** : génère l\'écriture comptable (411 Client / 706 ou 701 / 4431 TVA collectée) — irréversible',
          'Pour les lignes liées à un produit du catalogue : sortie de stock automatique au CMP',
          'Le statut passe ensuite par : envoyée → en_attente → payée (ou retard si échue)',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Encaissement intégré à la trésorerie',
        description: 'Le bouton « Enregistrer un paiement » sur une facture déclenche en cascade : entrée sur le compte de trésorerie choisi + écriture d\'encaissement (5x Trésorerie / 411 Client) + recalcul automatique du statut (payée ou en attente si partiel).',
        points: [
          'Choix du compte crédité (banque, Wave, Orange Money, caisse…)',
          'Mode de paiement : virement, chèque, carte, espèces, mobile money',
          'Paiements partiels acceptés (suit le solde dû)',
          'Référence externe (n° virement, n° chèque) tracée',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Lien de paiement Mobile Money (Wave · Orange Money · MTN MoMo)',
        description: 'Pour les factures en attente, un bouton « Smartphone » génère un lien de paiement sécurisé. Le client paie depuis son téléphone en quelques secondes, et le webhook du fournisseur encaisse automatiquement la facture côté ApeX.',
        points: [
          '3 fournisseurs supportés : Wave, Orange Money, MTN MoMo',
          'Quand plusieurs intégrations sont actives, un sélecteur de fournisseur apparaît',
          'MTN MoMo : push USSD direct sur le numéro du client (demande de paiement)',
          'Modale de partage avec **QR code**, **WhatsApp pré-rempli** et lien copiable',
          'Encaissement automatique : mouvement de trésorerie + écriture comptable + statut « payée »',
          'Mode démo intégré pour tester sans compte marchand (configurable dans Paramètres → Intégrations)',
        ],
      },
      {
        icon: ShieldCheck,
        titre: 'Certification fiscale DGI (FNE)',
        description: 'Pour anticiper l\'obligation de Facture Normalisée Électronique, chaque facture non brouillon peut être certifiée auprès de la Direction Générale des Impôts. Un numéro fiscal officiel, un hash de contrôle et un QR code de vérification sont apposés sur la facture.',
        points: [
          'Bouton bouclier (gris) → certifie la facture · bouclier vert = déjà certifiée',
          'Modale d\'aperçu : numéro FNE, QR code, hash SHA-256',
          'QR code scannable par le client pour vérifier l\'authenticité sur le portail DGI',
          'Idempotent : un appel répété ne crée pas de doublon',
          'Mode démo (préfixe MOCK-) tant que vos identifiants DGI ne sont pas configurés',
          'Configuration (NCC, centre fiscal, clé DGI) dans Paramètres → Fiscal',
        ],
      },
      {
        icon: AlertTriangle,
        titre: 'Avoirs : règles SYSCOHADA',
        description: 'Un avoir annule partiellement ou totalement une facture. La référence à la facture d\'origine est obligatoire — ApeX le rend impossible sans. L\'avoir validé contre-passe l\'écriture initiale et remet le stock à jour.',
        points: [
          'Sélection obligatoire de la facture d\'origine',
          'Contre-passation comptable automatique',
          'Pour les produits du catalogue : retour en stock',
          'Réduit aussi la TVA collectée du trimestre',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Nouvelle facture', description: 'Créez une facture ou un avoir. Les devis et proformas se gèrent depuis leur propre page.' },
      { target: 'filtres-statut', titre: 'Filtres par statut', description: 'Affichez seulement les factures payées, en attente, en retard, brouillon, envoyée ou annulée.' },
      { target: 'liste-factures', titre: 'Liste des factures', description: 'Toutes vos factures avec leur numéro, client, montant TTC, montant payé et statut. Actions sur chaque ligne : encaisser, générer un lien Mobile Money, certifier DGI, télécharger le PDF.' },
    ],
  },

  // ─── DEVIS ──────────────────────────────────────────────────────────────
  devis: {
    titre: 'Devis & Proformas',
    sousTitre: 'Pilotez votre cycle commercial avant la facturation',
    intro: [
      {
        icon: FileText,
        titre: 'Le point de départ de la vente',
        description: 'Un devis est une offre commerciale envoyée au client avant tout engagement. ApeX lui donne un cycle de vie propre, séparé de la comptabilité : tant qu\'un devis n\'est pas converti, aucune écriture n\'est générée.',
        points: [
          'Devis et proformas réunis sur une page dédiée',
          'Numérotation automatique (D-AAAA-NNN)',
          'Calcul TVA et totaux automatiques',
          'Export PDF professionnel en un clic',
        ],
      },
      {
        icon: CheckCircle2,
        titre: 'Un cycle de vie commercial',
        description: 'Chaque devis suit une issue claire : en attente → accepté, refusé ou expiré. Les devis dont la date de validité est dépassée passent automatiquement en « expiré ».',
        points: [
          'Marquez un devis accepté ou refusé d\'un clic',
          'Expiration automatique à la date de validité',
          'Statistiques : pipeline, taux de transformation',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Conversion en facture',
        description: 'Dès qu\'un devis est accepté, convertissez-le en facture : les lignes et montants sont repris automatiquement, et les deux pièces restent liées pour la traçabilité.',
        points: [
          'Reprise intégrale des lignes du devis',
          'Option : valider la facture immédiatement (écriture + stock)',
          'Le devis converti reste consultable, lié à sa facture',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Nouveau devis', description: 'Créez un devis ou une proforma. Vous choisirez le type dans la fenêtre suivante.' },
      { target: 'devis-stats', titre: 'Indicateurs commerciaux', description: 'Suivez vos devis en attente, le montant du pipeline et votre taux de transformation.' },
      { target: 'filtres-statut', titre: 'Filtres par statut', description: 'Affichez seulement les devis en attente, acceptés, refusés, expirés ou convertis.' },
      { target: 'liste-devis', titre: 'Liste des devis', description: 'Chaque ligne propose les actions : accepter, refuser, convertir en facture, PDF, supprimer.' },
    ],
  },

  // ─── DÉPENSES ───────────────────────────────────────────────────────────
  depenses: {
    titre: 'Suivi des dépenses',
    sousTitre: 'Toutes vos charges, leur paiement et leurs écritures automatiques',
    intro: [
      {
        icon: Wallet,
        titre: 'Le pivot des charges et achats',
        description: 'Chaque ligne saisie ici crée la dépense ET, à la validation, l\'écriture comptable correspondante (charge HT au compte 60x/62x, TVA déductible au 4452, contrepartie 401 fournisseur ou 5x trésorerie selon le mode).',
        points: [
          'Catégorisation SYSCOHADA pré-paramétrée (charges 60x à 67x)',
          'Calcul automatique HT / TVA / TTC',
          'Écriture comptable générée à la validation',
          'TVA déductible alimente automatiquement le calcul de TVA à reverser',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Statut payée vs en attente',
        description: 'Le statut détermine le scénario comptable et le mouvement de trésorerie.',
        points: [
          '**Payée** : la dépense est réglée immédiatement → mouvement sortie sur le compte de trésorerie choisi + écriture en BNK / CAI / MM',
          '**En attente** : la dépense est due au fournisseur → comptabilisée au crédit 4011xxx, payable plus tard depuis la page Fournisseurs',
          '**Annulée** : aucune écriture comptable n\'est produite',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Choix du moyen et du compte de paiement',
        description: 'Pour une dépense payée, vous choisissez le mode (virement, chèque, carte, espèces, mobile money) ET le compte de trésorerie débité.',
        points: [
          'Sélection du compte (banque, Wave, Orange Money, caisse…)',
          'Contrôle automatique du solde — pas de découvert non autorisé',
          'Mouvement de trésorerie créé et lié à la dépense',
          'Référence (n° chèque, n° transaction Wave) traçable',
        ],
      },
      {
        icon: Package,
        titre: 'Conversion en immobilisation',
        description: 'Une dépense significative (matériel, véhicule, mobilier, logiciel) ne doit pas rester une charge : elle doit être inscrite à l\'actif et amortie sur sa durée d\'usage. Un bouton « Convertir en immobilisation » apparaît sur les dépenses éligibles.',
        points: [
          'Conversion 1-clic vers le module Immobilisations',
          'Choix de la catégorie (matériel info, véhicule, mobilier…)',
          'Durée d\'amortissement et plan automatique selon SYSCOHADA',
          'La dépense reste tracée comme convertie',
        ],
      },
      {
        icon: Camera,
        titre: 'Scanner OCR : zéro saisie',
        description: 'Photographiez votre reçu ou facture fournisseur, ApeX extrait automatiquement les champs comptables : fournisseur, date, numéro, HT, TVA, TTC. Le formulaire de dépense s\'ouvre déjà pré-rempli — vous validez et c\'est en compta.',
        points: [
          'Bouton **« Scanner »** à côté de « Nouvelle dépense »',
          'Capture caméra directe sur mobile (ouvre l\'appareil photo)',
          'Sur ordinateur : sélection de fichier (JPG, PNG, WEBP)',
          'Compression intelligente de l\'image avant analyse',
          'Indication de la confiance OCR (0-100 %)',
          'Mode démo intégré (données fictives) ; passez en production avec une clé Mistral dans MISTRAL_API_KEY',
        ],
      },
      {
        icon: Filter,
        titre: 'Filtrer, analyser, justifier',
        description: 'Les filtres par statut, période et catégorie permettent de retrouver une dépense ou de préparer une analyse.',
        points: [
          'Filtres rapides par statut de paiement',
          'Tri par date, montant, catégorie',
          'Recherche par description ou fournisseur',
          'Pièces justificatives associables (à venir)',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Scanner ou créer manuellement', description: 'À côté de « Nouvelle dépense », le bouton « Scanner » photographie une facture pour pré-remplir le formulaire. À droite, saisie manuelle classique avec statut, mode de paiement et compte de trésorerie.' },
      { target: 'filtres-statut', titre: 'Filtres', description: 'Affichez les dépenses selon leur statut de paiement (payée, en attente, annulée).' },
      { target: 'liste-depenses', titre: 'Liste des dépenses', description: 'Tableau récapitulatif avec catégorie, fournisseur, montant et statut. Cliquez sur une ligne pour la modifier ou la convertir en immobilisation.' },
    ],
  },

  // ─── TRÉSORERIE ─────────────────────────────────────────────────────────
  tresorerie: {
    titre: 'Trésorerie',
    sousTitre: 'Banques, mobile money et caisses : un seul tableau de bord',
    intro: [
      {
        icon: Wallet,
        titre: 'Tous vos comptes, en un coup d\'œil',
        description: 'La trésorerie centralise tous vos points d\'argent : comptes bancaires, comptes mobile money (Wave, Orange Money, MTN, Moov, Djamo…) et caisses physiques.',
        points: [
          'Solde temps réel par compte et solde total',
          'Comptes par défaut pour les nouveaux paiements',
          'Multi-banques et multi-opérateurs mobile money',
          'Caisses physiques séparées (siège, agence…)',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Mobile Money intégré',
        description: 'Quand vous encaissez par Wave ou réglez une dépense par Orange Money, le mouvement est rattaché au bon compte. Vous suivez en temps réel votre solde Mobile Money, comme une banque.',
        points: [
          'Catalogue des opérateurs UEMOA pré-paramétrés',
          'Choix du compte lors du paiement d\'une facture',
          'Saisie manuelle de mouvements ponctuels',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Transferts inter-comptes',
        description: 'Approvisionner la caisse depuis la banque, transférer entre deux portefeuilles mobile money : un seul bouton, deux mouvements générés automatiquement (sortie + entrée).',
        points: [
          'Trace complète des transferts',
          'Pas de double saisie',
          'Liaison automatique entre les deux comptes',
        ],
      },
      {
        icon: Upload,
        titre: 'Import de relevés bancaires',
        description: 'Importez le relevé de votre banque ou de votre opérateur mobile money au format CSV. ApeX le parse automatiquement et propose un rapprochement.',
        points: [
          'Détection automatique des colonnes (date, libellé, débit/crédit…)',
          'Formats CSV courants supportés (point-virgule, virgule, tabulation)',
          'Historique de tous les relevés importés',
        ],
      },
      {
        icon: Link2,
        titre: 'Rapprochement bancaire',
        description: 'Le rapprochement vérifie que chaque ligne de votre relevé correspond à un mouvement enregistré dans l\'app. Un bouton « Matching automatique » apparie les évidences. Le reste se fait en deux clics.',
        points: [
          'Vue 2 colonnes : relevé / mouvements de l\'app',
          'Matching auto par montant et date proche (±3 jours)',
          'Création d\'un mouvement à partir d\'une ligne inconnue',
          'Détection des écarts entre solde théorique et solde relevé',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis', titre: 'Soldes consolidés', description: 'Solde total et répartition par type de compte (banque, mobile money, caisse).' },
      { target: 'btn-nouveau', titre: 'Créer un compte', description: 'Ajoutez un compte bancaire, un portefeuille mobile money ou une caisse.' },
      { target: 'btn-transfert', titre: 'Transfert', description: 'Déplacez de l\'argent entre deux de vos comptes en une opération.' },
      { target: 'liste-comptes', titre: 'Vos comptes', description: 'Cliquez sur un compte pour voir son détail, ses mouvements et importer un relevé.' },
    ],
  },

  // ─── TRÉSORERIE — DÉTAIL D'UN COMPTE ───────────────────────────────────
  'tresorerie-detail': {
    titre: 'Détail du compte',
    sousTitre: 'Mouvements, relevés et rapprochement',
    intro: [
      {
        icon: Eye,
        titre: 'L\'historique complet du compte',
        description: 'Cette vue affiche tous les mouvements (entrées et sorties) d\'un compte : paiements de factures encaissés, dépenses payées, transferts, saisies manuelles, lignes importées de relevés.',
        points: [
          'Solde temps réel et solde rapproché distinct',
          'Filtres par sens (entrée/sortie) et statut',
          'Statut de rapprochement bancaire visible',
        ],
      },
      {
        icon: Plus,
        titre: 'Saisir un mouvement manuellement',
        description: 'Pour les opérations qui ne viennent pas de l\'app (frais bancaires, agios, intérêts, retrait DAB, dépôt cash…), saisissez-les manuellement.',
        points: [
          'Encaissement (+) ou décaissement (−)',
          'Date, montant, libellé, référence',
          'Suppression possible tant que non rapproché',
        ],
      },
      {
        icon: Upload,
        titre: 'Importer et rapprocher un relevé',
        description: 'Pour les comptes bancaires et mobile money, importez un relevé CSV puis cliquez sur « Rapprocher » pour faire matcher les lignes avec vos mouvements.',
        points: [
          'Bouton « Importer » : fichier CSV de votre banque',
          'Bouton « Relevés » : historique et lancement du rapprochement',
          'Matching automatique + manuel pour les cas ambigus',
        ],
      },
    ],
    spotlight: [
      { target: 'liste-mouvements', titre: 'Tableau des mouvements', description: 'Tous les flux d\'argent du compte avec leur source, sens et statut de rapprochement.' },
    ],
  },

  // ─── FOURNISSEURS ───────────────────────────────────────────────────────
  fournisseurs: {
    titre: 'Fournisseurs & Cycle achat',
    sousTitre: 'Symétrique des clients · suivi des dettes 401x · bons de commande',
    intro: [
      {
        icon: Truck,
        titre: 'Le tiers fournisseur formalisé',
        description: 'Au lieu de retaper le nom du fournisseur sur chaque dépense, créez une fiche par tiers. Chaque fournisseur reçoit un code interne et un compte auxiliaire SYSCOHADA <strong>4011xxx</strong> qui apparaîtra dans le grand livre.',
        points: [
          'Coordonnées complètes (RCCM, NINEA, RIB, mobile money)',
          'Délai de paiement par défaut (30 j, 60 j…)',
          'Historique des dépenses + paiements par tiers',
          'Solde dû (encours) calculé en temps réel',
        ],
      },
      {
        icon: ShoppingCart,
        titre: 'Bons de commande (avec scanner OCR)',
        description: 'Formalisez vos engagements avant que la facture n\'arrive. Workflow : Brouillon → Envoyée → Réceptionnée → Facturée. La réception déclenche l\'entrée en stock automatique des produits liés. Pour gagner du temps à la saisie, un bouton **« Scanner »** à côté de « Nouvelle commande » permet de photographier une facture fournisseur : ApeX pré-remplit le formulaire (fournisseur reconnu par nom, date, référence, lignes, TVA).',
        points: [
          'Devis fournisseurs traçables',
          'Lignes avec produits du catalogue ou description libre',
          'Réception → mouvement de stock entrée automatique',
          'Conversion en facture fournisseur (dépense) en un clic',
          '**Scanner OCR** : ouvre la modale, photographie un document, pré-remplit la commande',
        ],
      },
      {
        icon: Clock,
        titre: 'Échéancier des dettes',
        description: 'Vue d\'ensemble de tout ce qui doit être payé : en retard, urgent (cette semaine), proche (mois), futur. Hiérarchisé par urgence pour éviter les pénalités.',
        points: [
          'Tri par urgence d\'échéance',
          'Total dû par groupe',
          'Identification rapide des retards',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Paiement intégré à la trésorerie',
        description: 'Le bouton « Payer » sur une fiche fournisseur crée le mouvement de trésorerie (sortie banque/mobile money) + met à jour la dépense + diminue l\'encours du fournisseur. Tout est lié.',
        points: [
          'Choix du compte de trésorerie débité',
          'Paiement partiel ou total',
          'Mise à jour automatique du statut de la dépense',
          'Traçabilité complète : mouvement, paiement, écriture comptable',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',          titre: 'Tableau de bord', description: 'Nombre de fournisseurs actifs, encours global, factures en retard.' },
      { target: 'tabs',          titre: '3 espaces',       description: 'Fournisseurs (CRUD), Bons de commande (workflow), Échéancier (à payer).' },
      { target: 'btn-nouveau',   titre: 'Nouvelle fiche',  description: 'Créez un fournisseur avec code auxiliaire 4011xxx auto-généré.' },
      { target: 'liste',         titre: 'Vos fournisseurs',description: 'Cliquez sur une fiche pour voir l\'historique des dépenses et payer.' },
    ],
  },

  // ─── PRODUITS & STOCKS ──────────────────────────────────────────────────
  produits: {
    titre: 'Produits & Stocks',
    sousTitre: 'Catalogue · mouvements · inventaires SYSCOHADA',
    intro: [
      {
        icon: Box,
        titre: 'Le catalogue de votre activité',
        description: 'Au lieu de saisir des descriptions libres sur chaque facture, créez vos produits et services une fois. Vous pouvez ensuite les sélectionner directement dans une facture (le prix, l\'unité et la TVA s\'auto-remplissent).',
        points: [
          'Produits (avec stock) et services (sans stock)',
          '8 catégories pré-paramétrées avec comptes SYSCOHADA (601 / 311 / 701 / 706…)',
          'Code, libellé, prix vente/achat, TVA, unité, référence externe',
          'Seuil d\'alerte pour le réapprovisionnement',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'Valorisation CMP (norme SYSCOHADA)',
        description: 'Chaque entrée en stock recalcule automatiquement le Coût Moyen Pondéré. Les sorties (ventes) sortent au CMP courant. La valeur totale du stock est en permanence à jour pour le bilan (compte 31x).',
        points: [
          'CMP recalculé à chaque entrée : (stock × CMP + entrée × prix) / (stock + entrée)',
          'Sorties valorisées au CMP du moment',
          'FIFO disponible en option',
          'Mouvements traçables : vente / achat / manuel / inventaire',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Mouvements automatiques',
        description: 'Quand vous validez une facture avec des produits du catalogue, la sortie de stock est générée automatiquement. Pour les avoirs, c\'est l\'inverse (retour en stock).',
        points: [
          'Sortie automatique à la validation d\'une facture',
          'Entrée automatique pour les avoirs',
          'Saisie manuelle pour les achats, pertes, casse',
          'Journal global des mouvements consultable',
        ],
      },
      {
        icon: ClipboardCheck,
        titre: 'Inventaires physiques',
        description: 'En fin d\'exercice (obligation SYSCOHADA), créez un inventaire pour rapprocher le stock comptable et le stock réel. Les écarts génèrent automatiquement des mouvements d\'ajustement valorisés au CMP.',
        points: [
          'Snapshot automatique du stock théorique à la création',
          'Saisie ligne par ligne du stock physique',
          'Calcul automatique des écarts et de leur valorisation',
          'Validation = génération des mouvements correctifs',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',          titre: 'Tableau de bord',  description: 'Nombre de produits, valeur globale du stock, alertes seuil et ruptures.' },
      { target: 'tabs',          titre: '3 espaces',        description: 'Catalogue (CRUD), Mouvements (journal), Inventaires (clôture).' },
      { target: 'btn-nouveau',   titre: 'Créer un produit', description: 'Définissez code, libellé, prix, stock initial, méthode de valorisation.' },
      { target: 'liste',         titre: 'Catalogue',        description: 'Cliquez sur un produit pour voir son historique de mouvements et saisir des entrées/sorties manuelles.' },
    ],
  },

  // ─── IMMOBILISATIONS ────────────────────────────────────────────────────
  immobilisations: {
    titre: 'Immobilisations & Amortissements',
    sousTitre: 'Registre des actifs · dotations automatiques · cessions SYSCOHADA',
    intro: [
      {
        icon: Package,
        titre: 'Le patrimoine de votre entreprise',
        description: 'Tous les biens durables — matériel informatique, mobilier, véhicules, bâtiments, logiciels — doivent être inscrits en immobilisation et amortis sur leur durée d\'usage. C\'est ce qui apparaîtra à l\'actif du bilan SYSCOHADA.',
        points: [
          '13 catégories pré-paramétrées avec comptes SYSCOHADA (21x-24x)',
          'Durées d\'amortissement standards : info 3 ans, véhicules 4-5 ans, mobilier 10 ans, bâtiments 20 ans',
          'Méthodes linéaire (par défaut) ou dégressif (coefficient 1,5 / 2 / 2,5 selon durée)',
        ],
      },
      {
        icon: TrendingDown,
        titre: 'Amortissements automatiques',
        description: 'À chaque clôture annuelle, un bouton génère les dotations de toutes les immobilisations en service. ApeX calcule le prorata temporis et passe l\'écriture comptable globale (681 Dotations / 28x Amortissements cumulés).',
        points: [
          'Plan d\'amortissement année par année visible avant la clôture',
          'Prorata temporis pour la 1re année (jours après mise en service)',
          'Bascule auto dégressif → linéaire en fin de plan',
          'Écriture comptable globale par catégorie au journal OD',
        ],
      },
      {
        icon: Calculator,
        titre: 'De la dépense à l\'immobilisation',
        description: 'Les dépenses ≥ 500 000 FCFA (matériel, véhicule, mobilier…) peuvent être converties en immobilisations en un clic. La page Dépenses affiche un bouton « Convertir en immo » sur ces lignes.',
        points: [
          'Conversion 1-clic depuis la liste des dépenses',
          'La dépense est marquée comme convertie (traçabilité)',
          'La valeur d\'acquisition est reprise du montant HT',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Sorties d\'actif',
        description: 'À la vente, mise au rebut ou perte d\'un bien, le bouton « Sortir du registre » génère automatiquement l\'écriture de cession SYSCOHADA : reprise des amortissements, sortie de l\'actif, plus-value/moins-value au 812/822.',
        points: [
          '3 motifs : Cession (vente), Mise au rebut, Vol/Perte',
          'Calcul automatique de la plus ou moins-value',
          'Écriture comptable complète au journal OD',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',            titre: 'Tableau de bord',  description: 'Valeur brute, amortissements cumulés et VNC totale au bilan.' },
      { target: 'tabs',            titre: 'Onglets',          description: 'Basculez entre le registre des biens et la génération des dotations annuelles.' },
      { target: 'btn-nouveau',     titre: 'Ajouter un bien',  description: 'Créez une immobilisation avec sa catégorie SYSCOHADA et sa durée d\'amortissement.' },
      { target: 'btn-dotations',   titre: 'Générer les dotations', description: 'Bouton de clôture annuelle : génère en une fois toutes les dotations d\'amortissement de l\'exercice + l\'écriture comptable globale au journal OD.' },
      { target: 'liste',           titre: 'Le registre',      description: 'Tous vos actifs avec valeur brute, cumul amorti et VNC actuelle. Cliquez sur un bien pour voir son plan d\'amortissement, le sortir du registre ou télécharger le tableau PDF.' },
    ],
  },

  // ─── PAIE & RH ──────────────────────────────────────────────────────────
  paie: {
    titre: 'Paie & Ressources humaines',
    sousTitre: 'Gérez vos employés et leurs bulletins SYSCOHADA — Côte d\'Ivoire',
    intro: [
      {
        icon: UserCheck,
        titre: 'La paie automatisée pour les PME',
        description: 'ApeX applique automatiquement les barèmes CNPS, ITS, CN, FDFP et taxe d\'apprentissage selon le Code Général des Impôts et le Code de prévoyance sociale ivoiriens. Plus besoin de calculer à la main.',
        points: [
          'Fiche employé complète : état civil, contrat, paie, sécurité sociale',
          'Génération automatique des bulletins en un clic',
          'Bulletin PDF conforme article 31.10 du Code du travail',
          'Lien direct avec la trésorerie pour le versement des salaires',
          'Accès aux salaires restreint : Propriétaire, Admin, Comptable et le rôle dédié **RH**',
        ],
      },
      {
        icon: Briefcase,
        titre: 'Les 4 onglets',
        description: 'La page Paie est organisée en 4 espaces de travail :',
        points: [
          '**Employés** : annuaire du personnel, fiches détaillées (4 sections)',
          '**Bulletins** : édition mensuelle, validation et paiement',
          '**Rubriques** : catalogue paramétrable (primes, retenues, cotisations)',
          '**Statistiques** : masse salariale, coût employeur, évolution',
        ],
      },
      {
        icon: Calculator,
        titre: 'Comment ça marche ?',
        description: 'Une fois vos employés enregistrés, choisissez un mois et cliquez sur « Générer la paie du mois ». Tous les bulletins brouillons sont créés en quelques secondes.',
        points: [
          'Calcul automatique : CNPS retraite, CMU, ITS, CN, FDFP, taxe apprentissage',
          'Quotient familial appliqué (mariés et enfants à charge réduisent l\'ITS)',
          'Plafonds CNPS respectés (PF/AT 70 000 · Retraite 2 700 000)',
          'Vous pouvez ajouter primes/heures sup/avances avant validation',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Du bulletin au paiement',
        description: 'Un bulletin suit un cycle : Brouillon → Validé → Payé. Une fois payé, un mouvement de trésorerie sortie est généré automatiquement sur le compte choisi (banque, Wave, Orange Money…).',
        points: [
          'Workflow brouillon → validé → payé',
          'Choix du compte de paiement (virement, mobile money…)',
          'Intégration avec la trésorerie : sortie automatique',
          'Téléchargement PDF du bulletin à tout moment',
        ],
      },
    ],
    spotlight: [
      { target: 'tabs',               titre: 'Onglets',          description: 'Naviguez entre Employés, Bulletins, Rubriques et Statistiques.' },
      { target: 'btn-nouveau-employe',titre: 'Nouvel employé',   description: 'Créez une fiche employé en 4 étapes guidées : état civil, contrat, paie, sécurité sociale.' },
      { target: 'liste-employes',     titre: 'Vos employés',     description: 'Liste complète avec poste, salaire de base et statut (actif/archivé).' },
      { target: 'btn-generer',        titre: 'Générer la paie du mois', description: 'Crée d\'un coup les bulletins brouillons de tous les employés actifs pour un mois donné, avec calcul auto CNPS, ITS, CN, FDFP et taxe d\'apprentissage.' },
      { target: 'liste-bulletins',    titre: 'Les bulletins',    description: 'Liste mensuelle avec brut, net à payer, coût employeur et statut (brouillon → validé → payé). Cliquez pour voir le détail des lignes ou télécharger le PDF.' },
    ],
  },

  // ─── TAXES ──────────────────────────────────────────────────────────────
  taxes: {
    titre: 'Taxes & déclarations fiscales',
    sousTitre: 'Calcul auto · échéances · paiement intégré à la compta et à la trésorerie',
    intro: [
      {
        icon: Receipt,
        titre: 'Tous les impôts et cotisations au même endroit',
        description: 'Centralisez vos déclarations fiscales et sociales avec leurs échéances. ApeX gère 8 types pré-paramétrés selon les barèmes ivoiriens.',
        points: [
          '**TVA** (DGI) — trimestrielle, taux 18 %',
          '**IS / BIC** (DGI) — impôt sur le bénéfice annuel',
          '**ITS** — impôt sur traitements et salaires (lié à la paie)',
          '**CNSS / CMU** — cotisations sociales',
          '**IRVM, Patente, Autres** — pour les cas particuliers',
        ],
      },
      {
        icon: Calculator,
        titre: 'Calcul automatique de la TVA',
        description: 'Le bouton « Calcul TVA » agrège en une seconde toute votre TVA collectée et déductible sur une période, à partir des factures et dépenses déjà saisies. Plus de feuille Excel parallèle.',
        points: [
          'TVA collectée = sur factures envoyées/en attente/retard/payées (avoirs déduits)',
          'TVA déductible = sur dépenses payées avec TVA',
          'TVA nette à reverser ou crédit reportable affiché',
          'Permet de pré-remplir la déclaration trimestrielle DGI',
        ],
      },
      {
        icon: Calendar,
        titre: 'Échéances et alertes',
        description: 'Chaque déclaration a une date limite. Les retards remontent sur le tableau de bord et la page Taxes.',
        points: [
          'Statuts : à payer, payée, en retard, exonérée, annulée',
          'Alerte visuelle dès qu\'une échéance approche ou est dépassée',
          'Historique complet année par année',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Paiement intégré',
        description: 'Le bouton « Payer » sur une déclaration enchaîne automatiquement : sortie sur le compte de trésorerie choisi + écriture comptable (4441 TVA / 441 IS / 4311 CNSS… au débit, trésorerie au crédit) + mise à jour du statut.',
        points: [
          'Choix du compte trésorerie (banque, mobile money…)',
          'Mode et référence de paiement tracés',
          'Écriture passée au journal BNK / CAI / MM correspondant',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-calc-tva', titre: 'Calcul automatique de la TVA', description: 'Calcule en un clic la TVA collectée, déductible et le solde net à reverser pour une période donnée, à partir de vos factures et dépenses.' },
      { target: 'btn-nouveau', titre: 'Nouvelle déclaration', description: 'Créez une déclaration : type, période, montant base/dû, échéance. À utiliser après le calcul TVA pour formaliser la déclaration trimestrielle.' },
      { target: 'liste-taxes', titre: 'Liste des déclarations', description: 'Toutes vos déclarations avec échéance, montant dû/payé et statut. Bouton « Payer » sur chaque ligne due.' },
    ],
  },

  // ─── RAPPORTS ───────────────────────────────────────────────────────────
  rapports: {
    titre: 'Rapports & bilans',
    sousTitre: 'Synthèse annuelle · compte de résultat · export PDF prêt à signer',
    intro: [
      {
        icon: BarChart3,
        titre: 'La photo financière de l\'exercice',
        description: 'Cette section consolide en une page l\'essentiel d\'une clôture annuelle : recettes encaissées, dépenses payées, taxes acquittées, résultat net et marge — tout calculé en temps réel à partir des factures et dépenses de l\'année sélectionnée.',
        points: [
          'Recettes mois par mois (TTC et encaissées)',
          'Dépenses ventilées par catégorie SYSCOHADA',
          'Taxes payées (TVA, IS/BIC, CNSS, Patente…)',
          'Résultat net = recettes − dépenses − taxes',
          'Marge en % du chiffre d\'affaires',
        ],
      },
      {
        icon: Calendar,
        titre: 'Comparaison annuelle',
        description: 'Le sélecteur d\'année permet de basculer d\'un exercice à l\'autre pour comparer vos performances. Seules les années où vous avez de l\'activité apparaissent.',
        points: [
          'Une année = un onglet',
          'Les chiffres se mettent à jour à chaque facture/dépense ajoutée',
          'Devis et proformas sont exclus du chiffre d\'affaires (vue commerciale ≠ vue comptable)',
        ],
      },
      {
        icon: Download,
        titre: 'Export PDF du compte de résultat',
        description: 'Téléchargez en un clic un PDF mis en page proprement, prêt à transmettre à votre expert-comptable, à votre banque pour un dossier de financement, ou à archiver pour la liasse fiscale.',
        points: [
          'En-tête avec votre raison sociale et identifiants fiscaux',
          'Tableau mois par mois des recettes et encaissements',
          'Répartition des charges par catégorie',
          'Détail des taxes par type',
          'Résultat net et marge mis en évidence',
          'Conforme à la présentation SYSCOHADA',
        ],
      },
    ],
    spotlight: [
      { target: 'periode-selector', titre: 'Année d\'analyse', description: 'Basculez d\'un exercice à l\'autre pour comparer vos performances.' },
      { target: 'metriques', titre: 'Indicateurs de synthèse', description: 'Recettes, charges, taxes payées, bénéfice net et marge calculés en temps réel sur l\'exercice sélectionné.' },
      { target: 'btn-export', titre: 'Exporter en PDF', description: 'Compte de résultat complet en PDF, prêt pour votre expert-comptable, votre banque ou votre archivage fiscal.' },
    ],
  },

  // ─── COMPTABILITÉ ──────────────────────────────────────────────────────
  comptabilite: {
    titre: 'Comptabilité',
    sousTitre: 'Plan SYSCOHADA · journaux · écritures · grand livre · balance · export DGI',
    intro: [
      {
        icon: BookOpen,
        titre: 'Le miroir comptable de l\'app',
        description: 'Chaque action métier (validation de facture, paiement, dépense, paie, dotation d\'amortissement…) génère automatiquement l\'écriture comptable SYSCOHADA équivalente. Vous n\'avez rien à passer à la main pour le quotidien — cette page sert à consulter, vérifier et exporter.',
        points: [
          'Aucune saisie manuelle requise pour le cycle normal',
          'Plan de comptes SYSCOHADA complet (804 comptes pré-paramétrés)',
          'Écritures débit = crédit garanties à chaque enregistrement',
          'Journal réservé aux rôles Propriétaire / Admin / Comptable',
        ],
      },
      {
        icon: Briefcase,
        titre: 'Les journaux comptables',
        description: 'Chaque écriture est ventilée dans un journal selon la nature de l\'opération, conformément à SYSCOHADA. Les journaux par défaut sont créés automatiquement à la création de l\'entreprise.',
        points: [
          '**VTE** — Ventes (factures émises)',
          '**ACH** — Achats (dépenses, factures fournisseurs)',
          '**BNK** — Banque (mouvements bancaires, encaissements virement/chèque/carte)',
          '**CAI** — Caisse (mouvements espèces)',
          '**MM** — Mobile Money (Wave, Orange, MTN…)',
          '**OD** — Opérations diverses (dotations, OD manuelles, cessions)',
        ],
      },
      {
        icon: PieChart,
        titre: 'Grand livre & balance',
        description: 'Au-delà du journal chronologique, deux vues d\'analyse essentielles :',
        points: [
          '**Grand livre** : tous les mouvements d\'un compte précis (ex. 4111 Clients) avec solde progressif',
          '**Balance** : photo à une date donnée — total débit/crédit et solde de chaque compte',
          'Ces deux états sont la base de toute clôture d\'exercice',
        ],
      },
      {
        icon: Plus,
        titre: 'Écriture manuelle (OD)',
        description: 'Pour les opérations diverses non couvertes par les modules (régularisation, provision, à-nouveaux…), saisissez une écriture manuelle. ApeX contrôle l\'équilibre débit = crédit avant validation.',
        points: [
          'Choix du journal (par défaut OD)',
          'Au moins 2 lignes, somme débit = somme crédit',
          'Lettrage possible pour le suivi des comptes de tiers',
          'Réservé au Propriétaire, Admin et Comptable',
        ],
      },
      {
        icon: Download,
        titre: 'Export du Grand-Livre pour la DGI',
        description: 'L\'article 17 de l\'Acte uniforme OHADA impose que la comptabilité informatisée garantisse l\'intangibilité des écritures et puisse être extraite sous format numérique en cas de contrôle. ApeX produit un Grand-Livre des écritures validées au format pipe-delimited UTF-8 — ouvrable dans Excel, LibreOffice ou tout outil DGI.',
        points: [
          'Export pipe-delimited (18 colonnes) ouvert par Excel',
          'Seules les écritures validées sont exportées (intangibilité art. 17 OHADA)',
          'Tous les champs OHADA : journal, n° pièce, compte, libellé, débit, crédit, date de validation',
          'Téléchargement réservé au Propriétaire et à l\'Admin',
        ],
      },
    ],
    spotlight: [
      { target: 'journal', titre: 'Journal comptable', description: 'Toutes les écritures de l\'exercice, dans l\'ordre chronologique, avec leur journal, libellé, débit et crédit. Filtrable par période, journal et compte.' },
    ],
  },

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────
  'audit-log': {
    titre: 'Journal d\'audit',
    sousTitre: 'Traçabilité immuable des actions sensibles',
    intro: [
      {
        icon: Shield,
        titre: 'Le « qui a fait quoi » de votre entreprise',
        description: 'Chaque action engageante (connexion, création, modification, suppression, paiement, invitation, changement de rôle…) est enregistrée ici avec son auteur, son horodatage et le détail. Visible uniquement par les rôles Propriétaire et Admin.',
        points: [
          'Connexions : LOGIN_OK et LOGIN_FAIL (mauvais mot de passe, compte inconnu)',
          'CRUD : créations, modifications, suppressions sur toutes les entités',
          'Paiements et changements de statut tracés',
          'Invitations, retraits et changements de rôle des membres',
        ],
      },
      {
        icon: Eye,
        titre: 'À quoi ça sert au quotidien ?',
        description: 'Trois usages concrets pour une PME :',
        points: [
          '**Contrôle fiscal** : retrouver l\'historique exact d\'une facture, d\'une dépense ou d\'une écriture',
          '**Incident interne** : tracer qui a modifié un montant, supprimé un client, validé une paie',
          '**Sécurité** : détecter des connexions échouées répétées ou un changement de rôle inattendu',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Données immuables',
        description: 'Le journal d\'audit n\'est PAS modifiable depuis l\'app. Aucune action ne peut effacer ou retoucher une entrée. C\'est ce qui en fait une preuve fiable.',
        points: [
          'Insertion seule, pas de modification ni suppression',
          'Conservation illimitée (aucune purge automatique)',
          'Accessible uniquement aux Propriétaire et Admin',
        ],
      },
    ],
    spotlight: [
      { target: 'filtres', titre: 'Filtres', description: 'Recherchez par utilisateur, type d\'action, entité (factures, dépenses, clients, membres…) ou période.' },
      { target: 'journal', titre: 'Liste des événements', description: 'Chaque ligne : horodatage, utilisateur, action, entité concernée et détail JSON. Cliquez pour déplier.' },
    ],
  },

  // ─── PARAMÈTRES ─────────────────────────────────────────────────────────
  parametres: {
    titre: 'Paramètres',
    sousTitre: 'Identité entreprise · membres et rôles · préférences',
    intro: [
      {
        icon: Settings,
        titre: 'L\'identité de votre entreprise',
        description: 'Les informations renseignées ici alimentent automatiquement vos factures, devis, bulletins de paie et rapports : entête, mentions légales, NIF/NCC, RCCM, régime fiscal.',
        points: [
          'Raison sociale, forme juridique, secteur',
          'Adresse, téléphone, email',
          'Identifiants fiscaux : NINEA/NIF, RCCM',
          'Régime (Réel Normal, Réel Simplifié, RSI) et taux de TVA par défaut',
        ],
      },
      {
        icon: Users,
        titre: 'Inviter et gérer les membres',
        description: 'Une entreprise peut avoir plusieurs membres. L\'invitation se fait par email — un lien à usage unique (expiration 7 j) permet à l\'invité de définir lui-même son mot de passe.',
        points: [
          'Saisie email + rôle → génération d\'un lien d\'invitation',
          'L\'invité reçoit le lien et active son compte (token usage unique)',
          'Modification du rôle d\'un membre à tout moment',
          'Retrait d\'un membre — l\'historique de ses actions est conservé dans le journal d\'audit',
        ],
      },
      {
        icon: Shield,
        titre: '10 rôles métier pour un accès finement contrôlé',
        description: 'Chaque rôle donne un périmètre précis basé sur une matrice de permissions module × action. Un membre peut avoir des rôles différents dans des entreprises différentes.',
        points: [
          '**Propriétaire** — tout, y compris la suppression de l\'entreprise',
          '**Admin** — tout sauf la révocation du propriétaire',
          '**Expert-comptable** — accès complet en lecture/écriture sur tout le cycle comptable',
          '**Comptable** — saisie/édition de tout le cycle comptable + paie',
          '**RH** — accès exclusif à la paie (employés, bulletins, rubriques), pas de comptabilité',
          '**Commercial** — clients, devis, factures (avec lien Mobile Money) — pas d\'accès aux coûts d\'achat',
          '**Magasinier** — produits, stocks, inventaires, réception des commandes',
          '**Auditeur** — lecture seule sur toute l\'entreprise + accès au journal d\'audit',
          '**Utilisateur** — saisie standard (clients, factures, dépenses…)',
          '**Lecture seule** — consultation uniquement',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Onglet « Intégrations » — Mobile Money',
        description: 'Réservé aux administrateurs. Configurez vos comptes marchands Wave, Orange Money et MTN MoMo pour activer les liens de paiement et l\'encaissement automatique sur les factures.',
        points: [
          'Trois cartes (Wave, Orange Money, MTN MoMo) avec leur logo officiel',
          'Mode **Démo / Sandbox / Production** par fournisseur',
          'Clé API et secret de webhook masqués (aperçu **•••• xxxx**)',
          'Choix du compte de trésorerie crédité lors de l\'encaissement',
          'URL de webhook fournie à copier dans le tableau de bord du fournisseur',
          'Sans configuration : le mode démo fonctionne (génère des liens factices pour tester le flux)',
        ],
      },
      {
        icon: ShieldCheck,
        titre: 'Onglet « Fiscal » — Certification DGI / FNE',
        description: 'Réservé aux administrateurs. Renseignez votre identité fiscale pour activer la certification des factures auprès de la Direction Générale des Impôts (Facture Normalisée Électronique).',
        points: [
          '**NCC** (Numéro de Compte Contribuable) et centre fiscal de rattachement',
          'Sélecteur de mode : Démo · Bac à sable · Production',
          'Clé API DGI masquée, avec aperçu si déjà configurée',
          'Interrupteur « Activer la certification automatique des factures émises »',
          'La bascule vers Sandbox/Prod refuse l\'activation sans clé API',
          'Tant que la DGI n\'a pas publié son SDK officiel, seul le mode Démo certifie réellement (préfixe MOCK-)',
        ],
      },
      {
        icon: Building2,
        titre: 'Multi-entreprises',
        description: 'Un même compte utilisateur peut gérer plusieurs entreprises (gérant de holding, comptable externe…). Le switcher en haut de la sidebar bascule de l\'une à l\'autre — les données sont totalement étanches.',
        points: [
          'Bouton « Nouvelle entreprise » dans le switcher de la sidebar',
          'Chaque entreprise a son propre plan comptable, ses propres écritures',
          'Pas de mélange possible entre données — sécurité par construction',
        ],
      },
      {
        icon: Eye,
        titre: 'Préférences d\'affichage',
        description: 'Mode clair ou sombre selon votre confort, langue de l\'interface (français / anglais).',
        points: [
          'Bouton soleil/lune dans la sidebar (mémorisé par appareil)',
          'Sélecteur de langue (français · anglais) — toute l\'app bascule instantanément',
          'Toute la palette de couleurs s\'adapte au mode choisi',
        ],
      },
    ],
    spotlight: [
      { target: 'form-entreprise', titre: 'Informations entreprise', description: 'Ces données apparaissent sur vos factures, devis, bulletins et rapports. Pensez à compléter le NINEA et le RCCM avant la première édition de pièce.' },
    ],
  },
};

export const getOnboarding = (pageKey) => ONBOARDING[pageKey] || null;
