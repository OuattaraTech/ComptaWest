/**
 * Contenu d'onboarding pour chaque page de ComptaWest.
 *
 * Structure :
 *   - intro     : slides du modal d'introduction (vue d'ensemble de la page)
 *   - spotlight : étapes du tour guidé (cible un sélecteur DOM via data-onboarding)
 *
 * Chaque entrée intro : { titre, description, icon, points[] }
 * Chaque entrée spotlight : { target, titre, description, position? }
 */
import {
  LayoutDashboard, Users, FileText, Wallet, Receipt,
  BarChart3, BookOpen, Shield, Settings,
  TrendingUp, AlertCircle, Calendar, Calculator, Plus,
  Download, Filter, Eye, CheckCircle2, PieChart, Building2,
  Smartphone, Banknote, Upload, Link2, ArrowLeftRight,
  UserCheck, Briefcase, CreditCard,
  Package, TrendingDown,
  Box, ClipboardCheck, AlertTriangle,
  Truck, ShoppingCart, Clock,
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
        description: 'Le tableau de bord est le point de départ de ComptaWest. Il rassemble en un coup d\'œil toutes les informations essentielles de votre entreprise.',
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
        description: 'ComptaWest vous prévient automatiquement des échéances importantes : factures impayées, taxes à régler, déclarations à venir.',
        points: [
          'Notifications visuelles en haut du tableau de bord',
          'Lien direct vers l\'élément concerné',
        ],
      },
    ],
    spotlight: [
      { target: 'header', titre: 'Vue d\'ensemble', description: 'Le nom de votre entreprise, son régime fiscal et l\'année comptable sélectionnée s\'affichent ici.' },
      { target: 'annee-selector', titre: 'Sélecteur d\'année', description: 'Changez d\'année comptable pour consulter ou comparer les données d\'un autre exercice.' },
      { target: 'kpis', titre: 'Indicateurs clés (KPI)', description: 'Les chiffres essentiels : recettes, dépenses, bénéfice, factures en retard et taxes dues.' },
      { target: 'graphiques', titre: 'Graphiques d\'évolution', description: 'Visualisez l\'évolution mensuelle, la répartition des charges et vos meilleurs clients.' },
    ],
  },

  // ─── CLIENTS ────────────────────────────────────────────────────────────
  clients: {
    titre: 'Gestion des clients',
    sousTitre: 'Centralisez votre carnet d\'adresses professionnel',
    intro: [
      {
        icon: Users,
        titre: 'Votre fichier clients',
        description: 'Cette page regroupe tous vos clients (entreprises et particuliers). Chaque fiche client conserve l\'historique de ses factures et paiements.',
        points: [
          'Création de clients de type entreprise ou particulier',
          'Coordonnées complètes (email, téléphone, adresse)',
          'Identifiants fiscaux (NIF, NCC) pour la facturation',
          'Suivi du chiffre d\'affaires par client',
        ],
      },
      {
        icon: Plus,
        titre: 'Ajouter un client',
        description: 'Avant de créer une facture, vous devez enregistrer le client. Cliquez sur « Nouveau client » et renseignez ses informations.',
        points: [
          'Type : entreprise ou particulier',
          'Informations obligatoires : nom et email',
          'Le NIF/NCC apparaîtra sur les factures',
        ],
      },
      {
        icon: Eye,
        titre: 'Consulter un client',
        description: 'Cliquez sur l\'icône « œil » d\'un client pour voir toutes ses factures, son total facturé et le solde restant dû.',
        points: [
          'Liste complète des factures émises',
          'Total facturé, payé, restant dû',
          'Modification ou suppression possibles',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Ajouter un client', description: 'Cliquez ici pour créer une nouvelle fiche client.' },
      { target: 'liste-clients', titre: 'Liste des clients', description: 'Tous vos clients apparaissent ici, avec leur chiffre d\'affaires associé.' },
    ],
  },

  // ─── FACTURES ───────────────────────────────────────────────────────────
  factures: {
    titre: 'Facturation',
    sousTitre: 'Émettez vos factures et avoirs en quelques clics',
    intro: [
      {
        icon: FileText,
        titre: 'Le cœur de votre activité commerciale',
        description: 'Créez et gérez vos factures et avoirs. ComptaWest calcule automatiquement la TVA et génère un PDF professionnel. Les devis et proformas ont leur propre page dédiée.',
        points: [
          'Deux types de documents : facture et avoir',
          'Numérotation automatique conforme',
          'Calcul TVA et totaux automatiques',
          'Export PDF en un clic',
        ],
      },
      {
        icon: CheckCircle2,
        titre: 'Suivi des paiements',
        description: 'Chaque facture suit un cycle de vie : brouillon → envoyée → payée. Les retards sont automatiquement détectés.',
        points: [
          'Enregistrement des paiements (total ou partiel)',
          'Détection automatique des factures en retard',
          'Filtres par statut (payée, en attente, en retard...)',
        ],
      },
      {
        icon: Download,
        titre: 'Documents professionnels',
        description: 'Téléchargez chaque facture au format PDF prêt à envoyer à votre client. Le PDF respecte les normes fiscales locales.',
        points: [
          'Logo et coordonnées de votre entreprise',
          'Mentions légales et fiscales',
          'NIF/NCC client et émetteur',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Nouvelle facture', description: 'Créez une facture ou un avoir. Les devis et proformas se gèrent depuis leur propre page.' },
      { target: 'filtres-statut', titre: 'Filtres par statut', description: 'Affichez seulement les factures payées, en attente, en retard, etc.' },
      { target: 'liste-factures', titre: 'Liste des factures', description: 'Toutes vos factures avec leur numéro, client, montant, statut et actions (paiement, PDF).' },
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
        description: 'Un devis est une offre commerciale envoyée au client avant tout engagement. ComptaWest lui donne un cycle de vie propre, séparé de la comptabilité : tant qu\'un devis n\'est pas converti, aucune écriture n\'est générée.',
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
    sousTitre: 'Maîtrisez vos charges, optimisez votre rentabilité',
    intro: [
      {
        icon: Wallet,
        titre: 'Enregistrez vos dépenses professionnelles',
        description: 'Toutes les charges de votre entreprise (achats, fournisseurs, services, frais...) sont consignées ici pour un suivi rigoureux.',
        points: [
          'Catégorisation SYSCOHADA (10 catégories prédéfinies)',
          'Statut : à payer, payée, en retard',
          'TVA récupérable automatiquement calculée',
          'Pièces justificatives associables',
        ],
      },
      {
        icon: Filter,
        titre: 'Filtrer et analyser',
        description: 'Les filtres par statut et par période vous aident à retrouver rapidement une dépense ou à analyser une catégorie de charges.',
        points: [
          'Filtres rapides par statut',
          'Tri par date, montant, catégorie',
          'Total des dépenses affiché en haut de la liste',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Nouvelle dépense', description: 'Enregistrez ici toutes les dépenses : factures fournisseurs, frais, achats…' },
      { target: 'filtres-statut', titre: 'Filtres', description: 'Affichez les dépenses selon leur statut de paiement.' },
      { target: 'liste-depenses', titre: 'Liste des dépenses', description: 'Tableau récapitulatif avec catégorie, fournisseur, montant et statut.' },
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
        description: 'Importez le relevé de votre banque ou de votre opérateur mobile money au format CSV. ComptaWest le parse automatiquement et propose un rapprochement.',
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
        titre: 'Bons de commande',
        description: 'Formalisez vos engagements avant que la facture n\'arrive. Workflow : Brouillon → Envoyée → Réceptionnée → Facturée. La réception déclenche l\'entrée en stock automatique des produits liés.',
        points: [
          'Devis fournisseurs traçables',
          'Lignes avec produits du catalogue ou description libre',
          'Réception → mouvement de stock entrée automatique',
          'Conversion en facture fournisseur (dépense) en un clic',
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
        description: 'À chaque clôture annuelle, un bouton génère les dotations de toutes les immobilisations en service. ComptaWest calcule le prorata temporis et passe l\'écriture comptable globale (681 Dotations / 28x Amortissements cumulés).',
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
      { target: 'liste',           titre: 'Le registre',      description: 'Tous vos actifs avec valeur brute, cumul amorti et VNC actuelle.' },
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
        description: 'ComptaWest applique automatiquement les barèmes CNPS, ITS, CN, FDFP et taxe d\'apprentissage selon le Code Général des Impôts et le Code de prévoyance sociale ivoiriens. Plus besoin de calculer à la main.',
        points: [
          'Fiche employé complète : état civil, contrat, paie, sécurité sociale',
          'Génération automatique des bulletins en un clic',
          'Bulletin PDF conforme article 31.10 du Code du travail',
          'Lien direct avec la trésorerie pour le versement des salaires',
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
      { target: 'btn-nouveau-employe',titre: 'Nouvel employé',   description: 'Créez une fiche employé en 4 étapes guidées.' },
      { target: 'liste-employes',     titre: 'Vos employés',     description: 'Liste complète avec poste, salaire et statut.' },
    ],
  },

  // ─── TAXES ──────────────────────────────────────────────────────────────
  taxes: {
    titre: 'Taxes & déclarations fiscales',
    sousTitre: 'Restez à jour avec la DGI et la CNSS',
    intro: [
      {
        icon: Receipt,
        titre: 'Gestion fiscale simplifiée',
        description: 'Centralisez toutes vos déclarations fiscales et sociales : TVA, IS, IRPP, CNSS… ComptaWest vous aide à respecter les échéances.',
        points: [
          'Déclarations DGI (TVA, IS, IRPP, ITS)',
          'Cotisations sociales CNSS',
          'Calculateur de TVA intégré',
          'Suivi des paiements et échéances',
        ],
      },
      {
        icon: Calculator,
        titre: 'Calculateur de TVA',
        description: 'Un outil rapide pour calculer la TVA collectée, déductible et le solde à payer pour une période donnée.',
        points: [
          'Saisie HT ou TTC',
          'Taux pré-paramétré (18% Côte d\'Ivoire)',
          'Détail TVA collectée / déductible / nette',
        ],
      },
      {
        icon: Calendar,
        titre: 'Échéances et alertes',
        description: 'Chaque déclaration a une date limite. ComptaWest signale automatiquement celles qui approchent ou sont en retard.',
        points: [
          'Statut : à payer, payée, en retard, exonérée',
          'Alerte visuelle en cas de retard',
          'Historique complet par exercice',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-calc-tva', titre: 'Calculateur TVA', description: 'Outil rapide pour calculer la TVA collectée, déductible et le solde à payer.' },
      { target: 'btn-nouveau', titre: 'Nouvelle déclaration', description: 'Créez une nouvelle déclaration fiscale ou sociale.' },
      { target: 'liste-taxes', titre: 'Déclarations', description: 'Liste de toutes vos déclarations avec leur échéance, montant et statut.' },
    ],
  },

  // ─── RAPPORTS ───────────────────────────────────────────────────────────
  rapports: {
    titre: 'Rapports & bilans',
    sousTitre: 'Analysez vos résultats, exportez vos états financiers',
    intro: [
      {
        icon: BarChart3,
        titre: 'États financiers détaillés',
        description: 'Cette section produit les rapports comptables clés de votre entreprise : compte de résultat, bilan, marge brute, ratios.',
        points: [
          'Compte de résultat (recettes - charges)',
          'Bilan simplifié',
          'Ratios de gestion',
          'Évolution annuelle ou mensuelle',
        ],
      },
      {
        icon: Download,
        titre: 'Export PDF',
        description: 'Téléchargez vos rapports au format PDF pour les transmettre à votre comptable, banque ou administration.',
        points: [
          'Mise en page professionnelle',
          'Période et entreprise affichées',
          'Données conformes SYSCOHADA',
        ],
      },
    ],
    spotlight: [
      { target: 'periode-selector', titre: 'Période d\'analyse', description: 'Définissez la période pour laquelle vous voulez consulter vos rapports.' },
      { target: 'btn-export', titre: 'Exporter en PDF', description: 'Téléchargez le compte de résultat complet au format PDF, prêt à transmettre à votre comptable ou à votre banque.' },
      { target: 'metriques', titre: 'Indicateurs financiers', description: 'Recettes, charges, bénéfice et marge sont affichés en synthèse.' },
    ],
  },

  // ─── COMPTABILITÉ ──────────────────────────────────────────────────────
  comptabilite: {
    titre: 'Comptabilité',
    sousTitre: 'Journal des écritures et plan comptable SYSCOHADA',
    intro: [
      {
        icon: BookOpen,
        titre: 'La vue comptable',
        description: 'Toutes les opérations (factures, dépenses, paiements) génèrent automatiquement des écritures comptables conformes au plan SYSCOHADA.',
        points: [
          'Journal général des écritures',
          'Comptes SYSCOHADA prédéfinis',
          'Écritures débitrices et créditrices équilibrées',
          'Filtrage par compte ou période',
        ],
      },
      {
        icon: PieChart,
        titre: 'Lecture comptable',
        description: 'Chaque ligne du journal montre le numéro de compte, le libellé, le débit et le crédit. Le solde général est toujours équilibré.',
        points: [
          'Vue chronologique des écritures',
          'Recherche par compte ou libellé',
          'Vérification automatique de l\'équilibre',
        ],
      },
    ],
    spotlight: [
      { target: 'journal', titre: 'Journal comptable', description: 'Toutes les écritures de votre exercice apparaissent ici, dans l\'ordre chronologique.' },
    ],
  },

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────
  'audit-log': {
    titre: 'Journal d\'audit',
    sousTitre: 'Traçabilité complète des actions sur votre compte',
    intro: [
      {
        icon: Shield,
        titre: 'Sécurité et conformité',
        description: 'Le journal d\'audit enregistre toutes les actions sensibles : connexions, créations, modifications, suppressions. Indispensable pour la traçabilité.',
        points: [
          'Qui a fait quoi, quand et depuis où',
          'Actions sur factures, dépenses, taxes, clients',
          'Horodatage précis',
          'Filtres par utilisateur, action, période',
        ],
      },
      {
        icon: Eye,
        titre: 'À quoi cela sert ?',
        description: 'En cas de doute, d\'incident ou de contrôle fiscal, vous pouvez retrouver l\'historique exact de chaque opération.',
        points: [
          'Conformité fiscale et légale',
          'Détection d\'utilisations anormales',
          'Réversibilité des actions',
        ],
      },
    ],
    spotlight: [
      { target: 'filtres', titre: 'Filtres', description: 'Affinez la recherche par utilisateur, type d\'action ou période.' },
      { target: 'journal', titre: 'Liste des événements', description: 'Chaque ligne représente une action effectuée sur votre compte.' },
    ],
  },

  // ─── PARAMÈTRES ─────────────────────────────────────────────────────────
  parametres: {
    titre: 'Paramètres',
    sousTitre: 'Configurez votre entreprise et vos préférences',
    intro: [
      {
        icon: Settings,
        titre: 'Personnalisez ComptaWest',
        description: 'Définissez les informations de votre entreprise (qui apparaîtront sur les factures), votre régime fiscal et vos préférences d\'affichage.',
        points: [
          'Informations entreprise (nom, NIF, adresse)',
          'Régime fiscal (réel normal, simplifié, micro)',
          'Devise et taux de TVA',
          'Mode clair / sombre',
        ],
      },
      {
        icon: Building2,
        titre: 'Multi-entreprises',
        description: 'Vous pouvez gérer plusieurs entreprises depuis le même compte. Basculez entre elles via la sidebar.',
        points: [
          'Ajout d\'une nouvelle entreprise',
          'Modification des paramètres par entreprise',
          'Chaque entreprise a ses propres données',
        ],
      },
    ],
    spotlight: [
      { target: 'form-entreprise', titre: 'Informations entreprise', description: 'Ces données apparaissent sur vos factures et rapports.' },
    ],
  },
};

export const getOnboarding = (pageKey) => ONBOARDING[pageKey] || null;
