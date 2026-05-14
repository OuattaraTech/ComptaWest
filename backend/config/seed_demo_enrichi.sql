SET client_encoding = 'UTF8';

-- ============================================================================
-- ComptaWest — Enrichissement du compte démo
-- ----------------------------------------------------------------------------
-- Ajoute des données réalistes dans TOUS les modules pour l'entreprise démo
-- principale (« Ouattara & Associés », id b0000000-0000-0000-0000-000000000001) :
-- clients, fournisseurs, produits & stocks, commandes d'achat, trésorerie,
-- paie (employés + bulletins), immobilisations, devis et factures, dépenses.
--
-- Le script est RE-EXÉCUTABLE : il supprime d'abord ses propres données
-- (repérées par des préfixes de code/numéro dédiés) avant de réinsérer.
-- Il ne touche jamais aux données créées par ailleurs.
-- ============================================================================

DO $$
DECLARE
  v_ent  UUID := 'b0000000-0000-0000-0000-000000000001';
  v_user UUID;

  -- comptes de trésorerie
  v_cpt_banque UUID; v_cpt_caisse UUID; v_cpt_wave UUID;
  v_cpt_boa UUID; v_cpt_om UUID;

  -- catégories produits / immo
  v_cat_march  UUID; v_cat_service UUID; v_cat_travaux UUID;
  v_cat_veh_util UUID; v_cat_mat_outil UUID; v_cat_mat_info UUID;
  v_cat_mobilier UUID; v_cat_amenagement UUID;

  -- catégories dépenses (une seule par code, la table en contient des doublons)
  v_cd_loyer UUID; v_cd_transport UUID; v_cd_services UUID;
  v_cd_perso UUID; v_cd_telecom UUID; v_cd_equip UUID;

  -- clients
  v_cl1 UUID; v_cl2 UUID; v_cl3 UUID; v_cl4 UUID; v_cl5 UUID; v_cl6 UUID;
  -- fournisseurs
  v_fr1 UUID; v_fr2 UUID; v_fr3 UUID; v_fr4 UUID; v_fr5 UUID;
  -- produits
  v_pr1 UUID; v_pr2 UUID; v_pr3 UUID; v_pr4 UUID; v_pr5 UUID; v_pr6 UUID;
  -- employés
  v_em1 UUID; v_em2 UUID; v_em3 UUID; v_em4 UUID;
  -- immobilisations
  v_im1 UUID; v_im2 UUID; v_im3 UUID; v_im4 UUID; v_im5 UUID;
  -- commandes
  v_cmd UUID;
  -- factures / devis
  v_f UUID;
  -- bulletins
  v_bul UUID;
BEGIN

SELECT id INTO v_user FROM utilisateurs WHERE email = 'demo@comptawest.ci';
IF v_user IS NULL THEN
  RAISE EXCEPTION 'Utilisateur démo introuvable. Lancez POST /auth/demo d''abord.';
END IF;
IF NOT EXISTS (SELECT 1 FROM entreprises WHERE id = v_ent) THEN
  RAISE EXCEPTION 'Entreprise démo % introuvable.', v_ent;
END IF;

-- ===========================================================================
-- 0. NETTOYAGE des données d'enrichissement précédentes (ordre FK-safe)
-- ===========================================================================
DELETE FROM lignes_bulletin WHERE bulletin_id IN (
  SELECT b.id FROM bulletins_paie b JOIN employes e ON e.id = b.employe_id
  WHERE b.entreprise_id = v_ent AND e.matricule LIKE 'EMP-1%');
DELETE FROM bulletins_paie WHERE entreprise_id = v_ent AND employe_id IN (
  SELECT id FROM employes WHERE entreprise_id = v_ent AND matricule LIKE 'EMP-1%');
DELETE FROM employes WHERE entreprise_id = v_ent AND matricule LIKE 'EMP-1%';

DELETE FROM dotations_amortissement WHERE entreprise_id = v_ent AND immobilisation_id IN (
  SELECT id FROM immobilisations WHERE entreprise_id = v_ent AND numero_inventaire LIKE 'IMMO-1%');
DELETE FROM immobilisations WHERE entreprise_id = v_ent AND numero_inventaire LIKE 'IMMO-1%';

DELETE FROM paiements_fournisseur WHERE entreprise_id = v_ent AND reference LIKE 'PF-DEMO%';
DELETE FROM lignes_commande_achat WHERE commande_id IN (
  SELECT id FROM commandes_achat WHERE entreprise_id = v_ent AND numero LIKE 'BC-DEMO%');
DELETE FROM commandes_achat WHERE entreprise_id = v_ent AND numero LIKE 'BC-DEMO%';

DELETE FROM mouvements_stock WHERE entreprise_id = v_ent AND produit_id IN (
  SELECT id FROM produits WHERE entreprise_id = v_ent AND code LIKE 'PRD-1%');
DELETE FROM produits WHERE entreprise_id = v_ent AND code LIKE 'PRD-1%';

DELETE FROM fournisseurs WHERE entreprise_id = v_ent AND code LIKE 'FRN-1%';

DELETE FROM mouvements_tresorerie WHERE entreprise_id = v_ent
  AND (reference LIKE 'MVT-DEMO%'
       OR compte_id IN (SELECT id FROM comptes_tresorerie WHERE entreprise_id = v_ent AND numero_compte LIKE 'ENR-%'));
DELETE FROM comptes_tresorerie WHERE entreprise_id = v_ent AND numero_compte LIKE 'ENR-%';

DELETE FROM paiements WHERE facture_id IN (
  SELECT id FROM factures WHERE entreprise_id = v_ent AND (numero LIKE 'F-DEMO%' OR numero LIKE 'D-DEMO%'));
DELETE FROM lignes_facture WHERE facture_id IN (
  SELECT id FROM factures WHERE entreprise_id = v_ent AND (numero LIKE 'F-DEMO%' OR numero LIKE 'D-DEMO%'));
DELETE FROM factures WHERE entreprise_id = v_ent AND (numero LIKE 'F-DEMO%' OR numero LIKE 'D-DEMO%');

DELETE FROM depenses WHERE entreprise_id = v_ent AND numero LIKE 'DEP-DEMO%';

DELETE FROM clients WHERE entreprise_id = v_ent AND code LIKE 'CLI-1%';

-- ===========================================================================
-- Récupération des références existantes
-- ===========================================================================
SELECT id INTO v_cpt_banque FROM comptes_tresorerie WHERE entreprise_id = v_ent AND type = 'banque' ORDER BY created_at LIMIT 1;
SELECT id INTO v_cpt_caisse FROM comptes_tresorerie WHERE entreprise_id = v_ent AND type = 'caisse' ORDER BY created_at LIMIT 1;
SELECT id INTO v_cpt_wave   FROM comptes_tresorerie WHERE entreprise_id = v_ent AND type = 'mobile_money' ORDER BY created_at LIMIT 1;

SELECT id INTO v_cat_march      FROM categories_produits WHERE entreprise_id = v_ent AND code = 'MARCHANDISE' LIMIT 1;
SELECT id INTO v_cat_service    FROM categories_produits WHERE entreprise_id = v_ent AND code = 'SERVICE' LIMIT 1;
SELECT id INTO v_cat_travaux    FROM categories_produits WHERE entreprise_id = v_ent AND code = 'TRAVAUX' LIMIT 1;
SELECT id INTO v_cat_veh_util   FROM categories_immobilisation WHERE entreprise_id = v_ent AND code = 'VEHICULE_UTIL' LIMIT 1;
SELECT id INTO v_cat_mat_outil  FROM categories_immobilisation WHERE entreprise_id = v_ent AND code = 'MAT_OUTILLAGE' LIMIT 1;
SELECT id INTO v_cat_mat_info   FROM categories_immobilisation WHERE entreprise_id = v_ent AND code = 'MAT_INFO' LIMIT 1;
SELECT id INTO v_cat_mobilier   FROM categories_immobilisation WHERE entreprise_id = v_ent AND code = 'MOBILIER' LIMIT 1;
SELECT id INTO v_cat_amenagement FROM categories_immobilisation WHERE entreprise_id = v_ent AND code = 'AMENAGEMENT' LIMIT 1;

SELECT id INTO v_cd_loyer     FROM categories_depenses WHERE entreprise_id = v_ent AND code = '62L' ORDER BY id LIMIT 1;
SELECT id INTO v_cd_transport FROM categories_depenses WHERE entreprise_id = v_ent AND code = '61'  ORDER BY id LIMIT 1;
SELECT id INTO v_cd_services  FROM categories_depenses WHERE entreprise_id = v_ent AND code = '62'  ORDER BY id LIMIT 1;
SELECT id INTO v_cd_perso     FROM categories_depenses WHERE entreprise_id = v_ent AND code = '66'  ORDER BY id LIMIT 1;
SELECT id INTO v_cd_telecom   FROM categories_depenses WHERE entreprise_id = v_ent AND code = '62T' ORDER BY id LIMIT 1;
SELECT id INTO v_cd_equip     FROM categories_depenses WHERE entreprise_id = v_ent AND code = '24'  ORDER BY id LIMIT 1;

-- ===========================================================================
-- 1. TRÉSORERIE — 2 comptes supplémentaires + mouvements
-- ===========================================================================
INSERT INTO comptes_tresorerie (entreprise_id, nom, type, operateur, numero_compte, titulaire, solde_initial, compte_pc_numero, par_defaut)
VALUES (v_ent, 'Compte BOA', 'banque', 'BOA', 'ENR-CI-007-BOA-014523', 'Ouattara & Associés', 4500000, '5212', FALSE)
RETURNING id INTO v_cpt_boa;
INSERT INTO comptes_tresorerie (entreprise_id, nom, type, operateur, numero_compte, titulaire, solde_initial, compte_pc_numero, par_defaut)
VALUES (v_ent, 'Orange Money Pro', 'mobile_money', 'ORANGE_MONEY', 'ENR-OM-0707445566', 'Ouattara & Associés', 320000, '551', FALSE)
RETURNING id INTO v_cpt_om;

INSERT INTO mouvements_tresorerie (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par) VALUES
  (v_ent, v_cpt_banque, '2026-01-08', 'entree', 5900000,  'Encaissement client SARL Konan',           'MVT-DEMO-001', 'manuel', v_user),
  (v_ent, v_cpt_banque, '2026-01-15', 'sortie', 1250000,  'Règlement fournisseur matériaux',          'MVT-DEMO-002', 'manuel', v_user),
  (v_ent, v_cpt_banque, '2026-02-03', 'sortie', 2500000,  'Virement salaires janvier 2026',           'MVT-DEMO-003', 'manuel', v_user),
  (v_ent, v_cpt_boa,    '2026-02-10', 'entree', 3200000,  'Acompte chantier Négoce Traoré',           'MVT-DEMO-004', 'manuel', v_user),
  (v_ent, v_cpt_boa,    '2026-02-18', 'sortie', 875000,   'Achat carburant et lubrifiants',           'MVT-DEMO-005', 'manuel', v_user),
  (v_ent, v_cpt_caisse, '2026-02-20', 'entree', 150000,   'Recette espèces vente comptoir',           'MVT-DEMO-006', 'manuel', v_user),
  (v_ent, v_cpt_caisse, '2026-02-22', 'sortie', 45000,    'Frais de mission Abidjan-Yamoussoukro',    'MVT-DEMO-007', 'manuel', v_user),
  (v_ent, v_cpt_wave,   '2026-03-05', 'entree', 280000,   'Paiement client via Wave',                 'MVT-DEMO-008', 'manuel', v_user),
  (v_ent, v_cpt_wave,   '2026-03-07', 'sortie', 120000,   'Règlement transporteur (Wave)',            'MVT-DEMO-009', 'manuel', v_user),
  (v_ent, v_cpt_om,     '2026-03-12', 'entree', 95000,    'Encaissement Orange Money',                'MVT-DEMO-010', 'manuel', v_user),
  (v_ent, v_cpt_banque, '2026-03-20', 'sortie', 1000000,  'Loyer trimestriel locaux Cocody',          'MVT-DEMO-011', 'manuel', v_user),
  (v_ent, v_cpt_banque, '2026-04-02', 'entree', 7080000,  'Encaissement facture Import-Export Diabaté','MVT-DEMO-012','manuel', v_user),
  (v_ent, v_cpt_boa,    '2026-04-15', 'sortie', 3540000,  'Achat véhicule utilitaire (apport)',       'MVT-DEMO-013', 'manuel', v_user),
  (v_ent, v_cpt_caisse, '2026-04-28', 'sortie', 78000,    'Fournitures de bureau',                    'MVT-DEMO-014', 'manuel', v_user);

-- Garde-fou : aucun compte de trésorerie de la démo ne doit afficher un solde
-- négatif (vestige d'anciennes données de test). On rehausse le solde initial
-- des comptes déficitaires pour les ramener à un minimum de 100 000 FCFA.
-- Idempotent : un compte déjà au-dessus du seuil n'est pas retouché.
UPDATE comptes_tresorerie c
SET solde_initial = c.solde_initial + (100000 - sa.solde)
FROM (
  SELECT ct.id,
         ct.solde_initial + COALESCE((
           SELECT SUM(CASE WHEN m.sens = 'entree' THEN m.montant ELSE -m.montant END)
           FROM mouvements_tresorerie m WHERE m.compte_id = ct.id), 0) AS solde
  FROM comptes_tresorerie ct WHERE ct.entreprise_id = v_ent
) sa
WHERE c.id = sa.id AND sa.solde < 100000;

-- ===========================================================================
-- 2. CLIENTS — 6 nouveaux
-- ===========================================================================
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea, rccm) VALUES
  (v_ent, 'CLI-101', 'BTP Côte d''Ivoire SA',       'entreprise', 'contact@btp-ci.ci',     '+225 27 21 35 60 00', 'Zone 4, Marcory', 'Abidjan', 'Côte d''Ivoire', 'CI-2015-B-1102', 'RCC/ABJ/2015/B/01102')
  RETURNING id INTO v_cl1;
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea) VALUES
  (v_ent, 'CLI-102', 'Coopérative Agricole de Daloa','entreprise', 'coop@agri-daloa.ci',   '+225 27 32 78 11 00', 'Quartier Commerce', 'Daloa', 'Côte d''Ivoire', 'CI-2018-A-3344')
  RETURNING id INTO v_cl2;
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays) VALUES
  (v_ent, 'CLI-103', 'Hôtel Les Cascades',          'entreprise', 'resa@lescascades.ci',  '+225 27 31 64 20 00', 'Boulevard de la Paix', 'Man', 'Côte d''Ivoire')
  RETURNING id INTO v_cl3;
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, ville, pays) VALUES
  (v_ent, 'CLI-104', 'Bamba Sékou',                 'particulier','sekou.bamba@gmail.com','+225 07 11 22 33 44', 'Bouaké', 'Côte d''Ivoire')
  RETURNING id INTO v_cl4;
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea) VALUES
  (v_ent, 'CLI-105', 'Pharmacie de la Riviera',     'entreprise', 'gerant@pharma-riviera.ci','+225 27 22 49 88 00','Riviera Palmeraie', 'Abidjan', 'Côte d''Ivoire', 'CI-2020-P-7781')
  RETURNING id INTO v_cl5;
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays) VALUES
  (v_ent, 'CLI-106', 'Mairie de Yamoussoukro',      'entreprise', 'marches@mairie-yam.ci','+225 27 30 64 00 00', 'Quartier Administratif', 'Yamoussoukro', 'Côte d''Ivoire')
  RETURNING id INTO v_cl6;

-- ===========================================================================
-- 3. FOURNISSEURS — 5 nouveaux (compte auxiliaire 4011xxx)
-- ===========================================================================
INSERT INTO fournisseurs (entreprise_id, code, code_auxiliaire, nom, type, email, telephone, contact_principal, adresse, ville, ninea, delai_paiement_jours, mode_paiement_defaut, compte_charge_defaut) VALUES
  (v_ent, 'FRN-101', '4011101', 'Quincaillerie du Plateau',      'entreprise',    'ventes@quinca-plateau.ci','+225 27 20 31 44 00','M. Koné',     'Avenue Chardy, Plateau',  'Abidjan', 'CI-2012-Q-2201', 30, 'virement', '601')
  RETURNING id INTO v_fr1;
INSERT INTO fournisseurs (entreprise_id, code, code_auxiliaire, nom, type, email, telephone, contact_principal, ville, ninea, delai_paiement_jours, mode_paiement_defaut, compte_charge_defaut) VALUES
  (v_ent, 'FRN-102', '4011102', 'CIMAF Distribution',            'entreprise',    'commercial@cimaf.ci',     '+225 27 21 75 41 00','Service ventes','Abidjan', 'CI-2004-M-7832', 45, 'virement', '601')
  RETURNING id INTO v_fr2;
INSERT INTO fournisseurs (entreprise_id, code, code_auxiliaire, nom, type, email, telephone, contact_principal, ville, delai_paiement_jours, mode_paiement_defaut, compte_charge_defaut) VALUES
  (v_ent, 'FRN-103', '4011103', 'Total Energies Côte d''Ivoire', 'entreprise',    'pro@totalenergies.ci',    '+225 27 21 75 00 00','Compte pro',  'Abidjan', 15, 'carte', '605')
  RETURNING id INTO v_fr3;
INSERT INTO fournisseurs (entreprise_id, code, code_auxiliaire, nom, type, telephone, contact_principal, ville, delai_paiement_jours, mode_paiement_defaut, compte_charge_defaut) VALUES
  (v_ent, 'FRN-104', '4011104', 'Transport Konaté & Frères',     'entreprise',    '+225 05 66 77 88 99', 'M. Konaté',   'Bouaké', 30, 'mobile_money', '612')
  RETURNING id INTO v_fr4;
INSERT INTO fournisseurs (entreprise_id, code, code_auxiliaire, nom, type, email, telephone, ville, delai_paiement_jours, mode_paiement_defaut, compte_charge_defaut) VALUES
  (v_ent, 'FRN-105', '4011105', 'Bureautique Express',           'entreprise',    'contact@bureautique-express.ci','+225 27 22 55 66 77','Abidjan', 30, 'virement', '605')
  RETURNING id INTO v_fr5;

-- ===========================================================================
-- 4. PRODUITS & STOCKS — 6 produits + mouvements de stock
-- ===========================================================================
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite,
  stock_initial, stock_actuel, seuil_alerte, cmp, valeur_stock, compte_vente, compte_achat, compte_stock, cree_par) VALUES
  (v_ent, 'PRD-101', 'Ciment CPA 42.5 - sac 50kg', 'Ciment Portland artificiel haute résistance', 'produit', v_cat_march,
   5500, 4200, 18, 'sac', 500, 320, 100, 4200, 1344000, '701', '601', '311', v_user)
  RETURNING id INTO v_pr1;
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite,
  stock_initial, stock_actuel, seuil_alerte, cmp, valeur_stock, compte_vente, compte_achat, compte_stock, cree_par) VALUES
  (v_ent, 'PRD-102', 'Fer à béton HA 12mm - barre 12m', 'Acier haute adhérence diamètre 12mm', 'produit', v_cat_march,
   8500, 6800, 18, 'barre', 300, 145, 50, 6800, 986000, '701', '601', '311', v_user)
  RETURNING id INTO v_pr2;
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite,
  stock_initial, stock_actuel, seuil_alerte, cmp, valeur_stock, compte_vente, compte_achat, compte_stock, cree_par) VALUES
  (v_ent, 'PRD-103', 'Peinture bâtiment - pot 25L', 'Peinture acrylique mate intérieur/extérieur', 'produit', v_cat_march,
   42000, 31000, 18, 'pot', 80, 28, 15, 31000, 868000, '701', '601', '311', v_user)
  RETURNING id INTO v_pr3;
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite,
  stock_initial, stock_actuel, seuil_alerte, cmp, valeur_stock, compte_vente, compte_achat, compte_stock, cree_par) VALUES
  (v_ent, 'PRD-104', 'Carrelage grès 60x60 - m²', 'Carrelage grès cérame rectifié', 'produit', v_cat_march,
   9800, 7200, 18, 'm²', 1200, 60, 80, 7200, 432000, '701', '601', '311', v_user)
  RETURNING id INTO v_pr4;
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite, cree_par) VALUES
  (v_ent, 'PRD-105', 'Étude technique et métré', 'Prestation d''étude et chiffrage de chantier', 'service', v_cat_service,
   250000, 0, 18, 'forfait', v_user)
  RETURNING id INTO v_pr5;
INSERT INTO produits (entreprise_id, code, libelle, description, type, categorie_id, prix_vente_ht, prix_achat_ht, taux_tva, unite, cree_par) VALUES
  (v_ent, 'PRD-106', 'Main d''œuvre maçonnerie - jour', 'Journée d''équipe de maçonnerie', 'service', v_cat_travaux,
   45000, 0, 18, 'jour', v_user)
  RETURNING id INTO v_pr6;

-- Mouvements de stock (entrées d'approvisionnement + sorties sur ventes)
INSERT INTO mouvements_stock (entreprise_id, produit_id, date_mouvement, sens, quantite, prix_unitaire, valeur_totale, stock_apres, cmp_apres, source_type, libelle, reference, cree_par) VALUES
  (v_ent, v_pr1, '2026-01-10', 'entree', 500, 4200, 2100000, 500, 4200, 'achat', 'Approvisionnement initial ciment',        'ENT-PRD-101-01', v_user),
  (v_ent, v_pr1, '2026-02-14', 'sortie', 180, 4200, 756000,  320, 4200, 'vente', 'Sortie chantier BTP Côte d''Ivoire',      'SOR-PRD-101-01', v_user),
  (v_ent, v_pr2, '2026-01-10', 'entree', 300, 6800, 2040000, 300, 6800, 'achat', 'Approvisionnement initial fer à béton',   'ENT-PRD-102-01', v_user),
  (v_ent, v_pr2, '2026-02-28', 'sortie', 155, 6800, 1054000, 145, 6800, 'vente', 'Sortie chantier Négoce Traoré',           'SOR-PRD-102-01', v_user),
  (v_ent, v_pr3, '2026-01-12', 'entree', 80,  31000,2480000, 80,  31000,'achat', 'Approvisionnement peinture',              'ENT-PRD-103-01', v_user),
  (v_ent, v_pr3, '2026-03-05', 'sortie', 52,  31000,1612000, 28,  31000,'vente', 'Sortie chantier Hôtel Les Cascades',      'SOR-PRD-103-01', v_user),
  (v_ent, v_pr4, '2026-01-12', 'entree', 1200,7200, 8640000, 1200,7200, 'achat', 'Approvisionnement carrelage',             'ENT-PRD-104-01', v_user),
  (v_ent, v_pr4, '2026-03-18', 'sortie', 1140,7200, 8208000, 60,  7200, 'vente', 'Sortie gros chantier Riviera',            'SOR-PRD-104-01', v_user),
  (v_ent, v_pr4, '2026-04-10', 'ajustement', 0, 7200, 0,     60,  7200, 'inventaire', 'Inventaire physique - conforme',     'INV-PRD-104-01', v_user);

-- ===========================================================================
-- 5. COMMANDES D'ACHAT — 3 commandes à différents stades
-- ===========================================================================
-- Commande 1 : réceptionnée
INSERT INTO commandes_achat (entreprise_id, numero, fournisseur_id, date_commande, date_livraison_prevue, date_reception,
  reference_fournisseur, sous_total, taux_tva, montant_tva, total_ttc, statut, notes, date_envoi, cree_par)
VALUES (v_ent, 'BC-DEMO-001', v_fr2, '2026-01-05', '2026-01-12', '2026-01-10',
  'CIMAF-2026-0142', 4140000, 18, 745200, 4885200, 'receptionnee', 'Approvisionnement ciment et matériaux', '2026-01-05 09:00', v_user)
RETURNING id INTO v_cmd;
INSERT INTO lignes_commande_achat (commande_id, produit_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_cmd, v_pr1, 'Ciment CPA 42.5 - sac 50kg', 500, 'sac',   4200, 0, 2100000, 0),
  (v_cmd, v_pr2, 'Fer à béton HA 12mm',         300, 'barre', 6800, 0, 2040000, 1);

-- Commande 2 : envoyée (en attente de réception)
INSERT INTO commandes_achat (entreprise_id, numero, fournisseur_id, date_commande, date_livraison_prevue,
  reference_fournisseur, sous_total, taux_tva, montant_tva, total_ttc, statut, notes, date_envoi, cree_par)
VALUES (v_ent, 'BC-DEMO-002', v_fr1, '2026-04-20', '2026-05-02',
  'QP-26-0388', 1830000, 18, 329400, 2159400, 'envoyee', 'Carrelage et peinture pour chantier Riviera', '2026-04-20 14:30', v_user)
RETURNING id INTO v_cmd;
INSERT INTO lignes_commande_achat (commande_id, produit_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_cmd, v_pr4, 'Carrelage grès 60x60', 150, 'm²',  7200, 0, 1080000, 0),
  (v_cmd, v_pr3, 'Peinture bâtiment 25L', 25, 'pot', 31000, 3, 751750, 1);

-- Commande 3 : brouillon
INSERT INTO commandes_achat (entreprise_id, numero, fournisseur_id, date_commande, date_livraison_prevue,
  sous_total, taux_tva, montant_tva, total_ttc, statut, notes, cree_par)
VALUES (v_ent, 'BC-DEMO-003', v_fr5, '2026-05-08', '2026-05-20',
  680000, 18, 122400, 802400, 'brouillon', 'Renouvellement fournitures et petit matériel de bureau', v_user)
RETURNING id INTO v_cmd;
INSERT INTO lignes_commande_achat (commande_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_cmd, 'Ramettes papier A4 (carton de 5)', 20, 'carton', 18000, 0, 360000, 0),
  (v_cmd, 'Cartouches encre et toners',        8, 'unité',  40000, 0, 320000, 1);

-- Paiement fournisseur sur la commande réceptionnée
INSERT INTO paiements_fournisseur (entreprise_id, fournisseur_id, montant, date_paiement, mode_paiement, reference, compte_tresorerie_id, cree_par)
VALUES (v_ent, v_fr2, 4885200, '2026-01-25', 'virement', 'PF-DEMO-001', v_cpt_banque, v_user);

-- ===========================================================================
-- 6. PAIE — 4 employés + bulletins
-- ===========================================================================
INSERT INTO employes (entreprise_id, matricule, civilite, nom, prenoms, date_naissance, sexe, situation_matrimoniale,
  nb_enfants_charge, telephone, email, poste, departement, date_embauche, type_contrat, categorie_professionnelle,
  salaire_base, mode_paiement, numero_cnps, cree_par) VALUES
  (v_ent, 'EMP-101', 'M.', 'Koné', 'Ibrahim', '1985-04-12', 'M', 'marie', 3,
   '+225 07 45 12 36 98', 'i.kone@ouattara-associes.ci', 'Chef de chantier', 'Production', '2021-03-01', 'CDI', 'agent_maitrise',
   420000, 'virement', '198504120001', v_user)
  RETURNING id INTO v_em1;
INSERT INTO employes (entreprise_id, matricule, civilite, nom, prenoms, date_naissance, sexe, situation_matrimoniale,
  nb_enfants_charge, telephone, poste, departement, date_embauche, type_contrat, categorie_professionnelle,
  salaire_base, mode_paiement, numero_cnps, cree_par) VALUES
  (v_ent, 'EMP-102', 'M.', 'Yao', 'Serge', '1990-09-23', 'M', 'celibataire', 0,
   '+225 05 78 41 23 65', 'Conducteur d''engins', 'Production', '2022-06-15', 'CDI', 'ouvrier',
   240000, 'mobile_money', '199009230012', v_user)
  RETURNING id INTO v_em2;
INSERT INTO employes (entreprise_id, matricule, civilite, nom, prenoms, date_naissance, sexe, situation_matrimoniale,
  nb_enfants_charge, telephone, email, poste, departement, date_embauche, type_contrat, categorie_professionnelle,
  salaire_base, mode_paiement, numero_cnps, cree_par) VALUES
  (v_ent, 'EMP-103', 'Mme', 'Touré', 'Fatoumata', '1988-12-05', 'F', 'marie', 2,
   '+225 01 23 45 67 89', 'f.toure@ouattara-associes.ci', 'Responsable administrative', 'Administration', '2020-01-10', 'CDI', 'cadre',
   550000, 'virement', '198812050008', v_user)
  RETURNING id INTO v_em3;
INSERT INTO employes (entreprise_id, matricule, civilite, nom, prenoms, date_naissance, sexe, situation_matrimoniale,
  nb_enfants_charge, telephone, poste, departement, date_embauche, type_contrat, categorie_professionnelle,
  salaire_base, mode_paiement, cree_par) VALUES
  (v_ent, 'EMP-104', 'M.', 'Ouédraogo', 'Karim', '1995-07-30', 'M', 'celibataire', 0,
   '+225 07 88 99 00 11', 'Manœuvre', 'Production', '2024-09-02', 'CDD', 'ouvrier',
   120000, 'cash', v_user);

-- Bulletins : EMP-101, EMP-102, EMP-103 sur févr. et mars 2026 (valeurs CI réalistes simplifiées)
-- EMP-101 (base 420 000)
INSERT INTO bulletins_paie (entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
  matricule, nom_complet, poste, salaire_base, nb_parts, brut_total, total_cotisations_salariales, salaire_imposable,
  total_impots, total_retenues, total_gains, net_a_payer, total_cotisations_patronales, cout_total_employeur,
  statut, date_paiement, compte_tresorerie_id, cree_par)
VALUES (v_ent, v_em1, 2026, 2, '2026-02-01', '2026-02-28', 30,
  'EMP-101', 'Koné Ibrahim', 'Chef de chantier', 420000, 2.5, 445000, 28035, 416965,
  18500, 0, 25000, 398465, 73260, 518260, 'paye', '2026-03-03', v_cpt_banque, v_user)
RETURNING id INTO v_bul;
INSERT INTO lignes_bulletin (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre) VALUES
  (v_bul, 'SAL_BASE', 'Salaire de base',           'gain',       420000, NULL, 420000, FALSE, 10),
  (v_bul, 'PRIME_TR', 'Prime de transport',        'gain',       NULL,   NULL,  25000, FALSE, 20),
  (v_bul, 'CNPS_RET', 'CNPS retraite (part sal.)', 'cotisation', 445000, 6.30,  28035, FALSE, 30),
  (v_bul, 'ITS',      'Impôt sur traitements (ITS)','impot',     416965, NULL,  18500, FALSE, 40),
  (v_bul, 'CNPS_PAT', 'CNPS + prestations (patron.)','cotisation',445000,16.46, 73260, TRUE,  50);

INSERT INTO bulletins_paie (entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
  matricule, nom_complet, poste, salaire_base, nb_parts, brut_total, total_cotisations_salariales, salaire_imposable,
  total_impots, total_retenues, total_gains, net_a_payer, total_cotisations_patronales, cout_total_employeur,
  statut, date_paiement, compte_tresorerie_id, cree_par)
VALUES (v_ent, v_em1, 2026, 3, '2026-03-01', '2026-03-31', 30,
  'EMP-101', 'Koné Ibrahim', 'Chef de chantier', 420000, 2.5, 445000, 28035, 416965,
  18500, 0, 25000, 398465, 73260, 518260, 'paye', '2026-04-03', v_cpt_banque, v_user)
RETURNING id INTO v_bul;
INSERT INTO lignes_bulletin (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre) VALUES
  (v_bul, 'SAL_BASE', 'Salaire de base',           'gain',       420000, NULL, 420000, FALSE, 10),
  (v_bul, 'PRIME_TR', 'Prime de transport',        'gain',       NULL,   NULL,  25000, FALSE, 20),
  (v_bul, 'CNPS_RET', 'CNPS retraite (part sal.)', 'cotisation', 445000, 6.30,  28035, FALSE, 30),
  (v_bul, 'ITS',      'Impôt sur traitements (ITS)','impot',     416965, NULL,  18500, FALSE, 40),
  (v_bul, 'CNPS_PAT', 'CNPS + prestations (patron.)','cotisation',445000,16.46, 73260, TRUE,  50);

-- EMP-102 (base 240 000)
INSERT INTO bulletins_paie (entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
  matricule, nom_complet, poste, salaire_base, nb_parts, brut_total, total_cotisations_salariales, salaire_imposable,
  total_impots, total_retenues, total_gains, net_a_payer, total_cotisations_patronales, cout_total_employeur,
  statut, date_paiement, compte_tresorerie_id, cree_par)
VALUES (v_ent, v_em2, 2026, 2, '2026-02-01', '2026-02-28', 30,
  'EMP-102', 'Yao Serge', 'Conducteur d''engins', 240000, 1.0, 255000, 16065, 238935,
  6200, 0, 15000, 232735, 41990, 296990, 'paye', '2026-03-03', v_cpt_wave, v_user)
RETURNING id INTO v_bul;
INSERT INTO lignes_bulletin (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre) VALUES
  (v_bul, 'SAL_BASE', 'Salaire de base',           'gain',       240000, NULL, 240000, FALSE, 10),
  (v_bul, 'PRIME_TR', 'Prime de transport',        'gain',       NULL,   NULL,  15000, FALSE, 20),
  (v_bul, 'CNPS_RET', 'CNPS retraite (part sal.)', 'cotisation', 255000, 6.30,  16065, FALSE, 30),
  (v_bul, 'ITS',      'Impôt sur traitements (ITS)','impot',     238935, NULL,   6200, FALSE, 40),
  (v_bul, 'CNPS_PAT', 'CNPS + prestations (patron.)','cotisation',255000,16.46, 41990, TRUE,  50);

INSERT INTO bulletins_paie (entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
  matricule, nom_complet, poste, salaire_base, nb_parts, brut_total, total_cotisations_salariales, salaire_imposable,
  total_impots, total_retenues, total_gains, net_a_payer, total_cotisations_patronales, cout_total_employeur,
  statut, cree_par)
VALUES (v_ent, v_em2, 2026, 3, '2026-03-01', '2026-03-31', 30,
  'EMP-102', 'Yao Serge', 'Conducteur d''engins', 240000, 1.0, 255000, 16065, 238935,
  6200, 0, 15000, 232735, 41990, 296990, 'valide', v_user)
RETURNING id INTO v_bul;
INSERT INTO lignes_bulletin (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre) VALUES
  (v_bul, 'SAL_BASE', 'Salaire de base',           'gain',       240000, NULL, 240000, FALSE, 10),
  (v_bul, 'PRIME_TR', 'Prime de transport',        'gain',       NULL,   NULL,  15000, FALSE, 20),
  (v_bul, 'CNPS_RET', 'CNPS retraite (part sal.)', 'cotisation', 255000, 6.30,  16065, FALSE, 30),
  (v_bul, 'ITS',      'Impôt sur traitements (ITS)','impot',     238935, NULL,   6200, FALSE, 40),
  (v_bul, 'CNPS_PAT', 'CNPS + prestations (patron.)','cotisation',255000,16.46, 41990, TRUE,  50);

-- EMP-103 (base 550 000)
INSERT INTO bulletins_paie (entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
  matricule, nom_complet, poste, salaire_base, nb_parts, brut_total, total_cotisations_salariales, salaire_imposable,
  total_impots, total_retenues, total_gains, net_a_payer, total_cotisations_patronales, cout_total_employeur,
  statut, date_paiement, compte_tresorerie_id, cree_par)
VALUES (v_ent, v_em3, 2026, 3, '2026-03-01', '2026-03-31', 30,
  'EMP-103', 'Touré Fatoumata', 'Responsable administrative', 550000, 2.0, 580000, 36540, 543460,
  42800, 0, 30000, 500660, 95468, 675468, 'paye', '2026-04-03', v_cpt_banque, v_user)
RETURNING id INTO v_bul;
INSERT INTO lignes_bulletin (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre) VALUES
  (v_bul, 'SAL_BASE', 'Salaire de base',            'gain',       550000, NULL, 550000, FALSE, 10),
  (v_bul, 'PRIME_RESP','Prime de responsabilité',   'gain',       NULL,   NULL,  30000, FALSE, 20),
  (v_bul, 'CNPS_RET', 'CNPS retraite (part sal.)',  'cotisation', 580000, 6.30,  36540, FALSE, 30),
  (v_bul, 'ITS',      'Impôt sur traitements (ITS)','impot',      543460, NULL,  42800, FALSE, 40),
  (v_bul, 'CNPS_PAT', 'CNPS + prestations (patron.)','cotisation',580000, 16.46, 95468, TRUE,  50);

-- ===========================================================================
-- 7. IMMOBILISATIONS — 5 biens + dotations d'amortissement 2025
-- ===========================================================================
INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, categorie_id, compte_actif,
  compte_amortissement, compte_dotation, date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
  amortissable, duree_annees, methode, fournisseur, emplacement, affecte_a, statut, cree_par) VALUES
  (v_ent, 'IMMO-101', 'Camion benne Mercedes 2638', 'Camion benne 6x4 pour transport matériaux', v_cat_veh_util, '245',
   '2845', '6813', '2023-06-15', '2023-06-15', 28000000, 4000000, TRUE, 4, 'lineaire', 'CFAO Motors', 'Parc engins', 'Service production', 'en_service', v_user)
  RETURNING id INTO v_im1;
INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, categorie_id, compte_actif,
  compte_amortissement, compte_dotation, date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
  amortissable, duree_annees, methode, fournisseur, emplacement, statut, cree_par) VALUES
  (v_ent, 'IMMO-102', 'Bétonnière thermique 500L', 'Bétonnière diesel grande capacité', v_cat_mat_outil, '241',
   '2841', '6813', '2024-02-20', '2024-03-01', 3200000, 0, TRUE, 10, 'lineaire', 'Quincaillerie du Plateau', 'Chantier mobile', 'en_service', v_user)
  RETURNING id INTO v_im2;
INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, categorie_id, compte_actif,
  compte_amortissement, compte_dotation, date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
  amortissable, duree_annees, methode, fournisseur, emplacement, affecte_a, statut, cree_par) VALUES
  (v_ent, 'IMMO-103', 'Lot 5 ordinateurs portables', 'Postes de travail bureau d''études', v_cat_mat_info, '2443',
   '28443', '6813', '2024-09-10', '2024-09-10', 2750000, 0, TRUE, 3, 'lineaire', 'Bureautique Express', 'Siège Cocody', 'Bureau d''études', 'en_service', v_user)
  RETURNING id INTO v_im3;
INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, categorie_id, compte_actif,
  compte_amortissement, compte_dotation, date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
  amortissable, duree_annees, methode, fournisseur, emplacement, statut, cree_par) VALUES
  (v_ent, 'IMMO-104', 'Mobilier de bureau (siège)', 'Bureaux, fauteuils et armoires', v_cat_mobilier, '2444',
   '28444', '6813', '2022-11-05', '2022-11-05', 4100000, 0, TRUE, 10, 'lineaire', 'Bureautique Express', 'Siège Cocody', 'en_service', v_user)
  RETURNING id INTO v_im4;
INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, categorie_id, compte_actif,
  compte_amortissement, compte_dotation, date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
  amortissable, duree_annees, methode, fournisseur, emplacement, statut, cree_par) VALUES
  (v_ent, 'IMMO-105', 'Aménagement entrepôt Yopougon', 'Travaux d''aménagement du dépôt de stockage', v_cat_amenagement, '215',
   '2815', '6813', '2023-03-01', '2023-04-01', 6500000, 0, TRUE, 10, 'lineaire', 'Travaux internes', 'Entrepôt Yopougon', 'en_service', v_user)
  RETURNING id INTO v_im5;

-- Dotations d'amortissement exercice 2025 (linéaire, année pleine)
INSERT INTO dotations_amortissement (entreprise_id, immobilisation_id, annee, date_dotation, nb_jours_amortis,
  base_amortissable, taux_amortissement, vnc_debut, dotation, cumul_amortissements, vnc_fin, cree_par) VALUES
  (v_ent, v_im1, 2025, '2025-12-31', 365, 24000000, 25.00, 22000000, 6000000, 12000000, 16000000, v_user),
  (v_ent, v_im2, 2025, '2025-12-31', 365, 3200000,  10.00, 3173333,  320000,  586667,   2613333,  v_user),
  (v_ent, v_im3, 2025, '2025-12-31', 365, 2750000,  33.33, 2520833,  916667,  1145833,  1604167,  v_user),
  (v_ent, v_im4, 2025, '2025-12-31', 365, 4100000,  10.00, 3212917,  410000,  1297083,  2802917,  v_user),
  (v_ent, v_im5, 2025, '2025-12-31', 365, 6500000,  10.00, 6012500,  650000,  1137500,  5362500,  v_user);

-- ===========================================================================
-- 8. DEVIS — 5 devis à différents stades du cycle commercial
-- ===========================================================================
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut, devis_statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl1, v_user, 'D-DEMO-001', 'devis', 'brouillon', 'en_attente',
  '2026-04-25', '2026-06-25', 8500000, 18, 1530000, 10030000, 0,
  'Construction mur de clôture et portail - site Marcory', 'Devis valable 60 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Terrassement et fondations', 1, 'forfait', 2200000, 0, 2200000, 0),
  (v_f, 'Maçonnerie agglos + chaînage', 180, 'm²', 28000, 0, 5040000, 1),
  (v_f, 'Portail métallique coulissant', 1, 'unité', 1260000, 0, 1260000, 2);

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut, devis_statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl3, v_user, 'D-DEMO-002', 'devis', 'brouillon', 'accepte',
  '2026-04-10', '2026-05-31', 4250000, 18, 765000, 5015000, 0,
  'Réfection peinture intérieure - Hôtel Les Cascades (40 chambres)', 'Devis valable 45 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Préparation des supports', 40, 'chambre', 25000, 0, 1000000, 0),
  (v_f, 'Peinture 2 couches', 40, 'chambre', 75000, 0, 3000000, 1),
  (v_f, 'Reprise plafonds', 40, 'chambre', 7500, 0, 300000, 2);

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut, devis_statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl4, v_user, 'D-DEMO-003', 'devis', 'brouillon', 'refuse',
  '2026-02-15', '2026-03-15', 1850000, 18, 333000, 2183000, 0,
  'Construction d''un local commercial - Bouaké (refusé : budget client)', 'Devis valable 30 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Gros œuvre local 25 m²', 25, 'm²', 65000, 0, 1625000, 0),
  (v_f, 'Enduits et finitions', 1, 'forfait', 225000, 0, 225000, 1);

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut, devis_statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl2, v_user, 'D-DEMO-004', 'devis', 'brouillon', 'expire',
  '2025-11-01', '2025-12-15', 3100000, 18, 558000, 3658000, 0,
  'Hangar de stockage agricole - Daloa (devis expiré sans réponse)', 'Devis valable 45 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Structure métallique hangar 200 m²', 1, 'forfait', 2400000, 0, 2400000, 0),
  (v_f, 'Couverture bac acier', 200, 'm²', 3500, 0, 700000, 1);

-- Devis converti : le devis pointe vers la facture, et la facture vers le devis
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut, devis_statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl5, v_user, 'D-DEMO-005', 'devis', 'brouillon', 'converti',
  '2026-03-01', '2026-04-15', 2900000, 18, 522000, 3422000, 0,
  'Aménagement réserve pharmacie - converti en facture F-DEMO-006', 'Devis valable 45 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Cloisons et rayonnages', 1, 'forfait', 1700000, 0, 1700000, 0),
  (v_f, 'Carrelage et peinture', 1, 'forfait', 1200000, 0, 1200000, 1);

-- ===========================================================================
-- 9. FACTURES — clients enrichis, réparties sur 2025 et 2026
-- ===========================================================================
-- F-DEMO-001 : payée intégralement (2026)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl1, v_user, 'F-DEMO-001', 'facture', 'payee',
  '2026-01-12', '2026-02-12', 5000000, 18, 900000, 5900000, 5900000,
  'Travaux de gros œuvre - chantier Marcory phase 1', 'Paiement à 30 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Fondations et semelles', 1, 'forfait', 1800000, 0, 1800000, 0),
  (v_f, 'Élévation murs porteurs', 220, 'm²', 14545.45, 0, 3200000, 1);
INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_f, 5900000, '2026-02-08', 'virement', 'VIR-CLI101-2026-01');

-- F-DEMO-002 : partiellement payée (2026)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl6, v_user, 'F-DEMO-002', 'facture', 'en_attente',
  '2026-03-05', '2026-04-05', 12000000, 18, 2160000, 14160000, 6000000,
  'Réfection voirie communale - Yamoussoukro lot 1', 'Paiement à 30 jours - acompte 50%')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Terrassement et reprofilage', 4000, 'm²', 1500, 0, 6000000, 0),
  (v_f, 'Couche de roulement', 4000, 'm²', 1500, 0, 6000000, 1);
INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_f, 6000000, '2026-03-10', 'virement', 'VIR-MAIRIE-YAM-ACOMPTE');

-- F-DEMO-003 : en retard (2026)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl2, v_user, 'F-DEMO-003', 'facture', 'retard',
  '2026-01-20', '2026-02-20', 3400000, 18, 612000, 4012000, 0,
  'Construction magasin de stockage - Coopérative de Daloa', 'Paiement à 30 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Dalle béton et élévation', 1, 'forfait', 2600000, 0, 2600000, 0),
  (v_f, 'Charpente et couverture', 1, 'forfait', 800000, 0, 800000, 1);

-- F-DEMO-004 : payée (2026)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl3, v_user, 'F-DEMO-004', 'facture', 'payee',
  '2026-02-28', '2026-03-30', 6000000, 18, 1080000, 7080000, 7080000,
  'Rénovation façade et terrasse - Hôtel Les Cascades', 'Paiement à 30 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Ravalement façade', 350, 'm²', 12000, 0, 4200000, 0),
  (v_f, 'Reprise dallage terrasse', 120, 'm²', 15000, 0, 1800000, 1);
INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_f, 7080000, '2026-04-02', 'virement', 'VIR-CASCADES-2026-02');

-- F-DEMO-005 : payée (2025, pour l'historique)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent, v_cl1, v_user, 'F-DEMO-005', 'facture', 'payee',
  '2025-09-15', '2025-10-15', 9500000, 18, 1710000, 11210000, 11210000,
  'Construction bâtiment administratif R+1 - BTP Côte d''Ivoire', 'Paiement à 30 jours')
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Gros œuvre R+1', 1, 'forfait', 6500000, 0, 6500000, 0),
  (v_f, 'Second œuvre et finitions', 1, 'forfait', 3000000, 0, 3000000, 1);
INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_f, 11210000, '2025-10-10', 'cheque', 'CHQ-BTPCI-2025-09');

-- F-DEMO-006 : issue de la conversion du devis D-DEMO-005 (payée)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement,
  devis_origine_id)
VALUES (v_ent, v_cl5, v_user, 'F-DEMO-006', 'facture', 'payee',
  '2026-03-20', '2026-04-20', 2900000, 18, 522000, 3422000, 3422000,
  'Aménagement réserve pharmacie - issu du devis D-DEMO-005', 'Paiement à 30 jours',
  (SELECT id FROM factures WHERE entreprise_id = v_ent AND numero = 'D-DEMO-005'))
RETURNING id INTO v_f;
INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_f, 'Cloisons et rayonnages', 1, 'forfait', 1700000, 0, 1700000, 0),
  (v_f, 'Carrelage et peinture', 1, 'forfait', 1200000, 0, 1200000, 1);
INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_f, 3422000, '2026-04-18', 'virement', 'VIR-PHARMA-RIVIERA');
-- relie le devis converti à sa facture
UPDATE factures SET converti_facture_id = v_f
  WHERE entreprise_id = v_ent AND numero = 'D-DEMO-005';

-- ===========================================================================
-- 10. DÉPENSES — charges variées 2026
-- ===========================================================================
INSERT INTO depenses (entreprise_id, categorie_id, cree_par, numero, description, fournisseur, fournisseur_id,
  montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement, reference) VALUES
  (v_ent, v_cd_loyer,     v_user, 'DEP-DEMO-001', 'Loyer locaux Cocody - 1er trimestre 2026', 'SCI Lagune', NULL,
   2542372.88, 18, 457627.12, 3000000, '2026-01-05', 'payee', 'virement', 'LOY-2026-T1'),
  (v_ent, v_cd_equip,     v_user, 'DEP-DEMO-002', 'Achat petit outillage de chantier', 'Quincaillerie du Plateau', v_fr1,
   720338.98, 18, 129661.02, 850000, '2026-01-18', 'payee', 'cheque', 'OUT-2026-001'),
  (v_ent, v_cd_transport, v_user, 'DEP-DEMO-003', 'Carburant véhicules et engins - janvier', 'Total Energies CI', v_fr3,
   508474.58, 18, 91525.42, 600000, '2026-01-22', 'payee', 'carte', 'CARB-2026-01'),
  (v_ent, v_cd_transport, v_user, 'DEP-DEMO-004', 'Carburant véhicules et engins - février', 'Total Energies CI', v_fr3,
   550847.46, 18, 99152.54, 650000, '2026-02-20', 'payee', 'carte', 'CARB-2026-02'),
  (v_ent, v_cd_telecom,   v_user, 'DEP-DEMO-005', 'Abonnement internet et téléphonie - février', 'Orange Business CI', NULL,
   127118.64, 18, 22881.36, 150000, '2026-02-02', 'payee', 'mobile_money', 'TEL-2026-02'),
  (v_ent, v_cd_services,  v_user, 'DEP-DEMO-006', 'Honoraires expert-comptable - exercice 2025', 'Cabinet Audit Conseil', NULL,
   847457.63, 18, 152542.37, 1000000, '2026-02-15', 'payee', 'virement', 'HON-2025'),
  (v_ent, v_cd_transport, v_user, 'DEP-DEMO-007', 'Location camion benne - chantier Yamoussoukro', 'Transport Konaté & Frères', v_fr4,
   677966.10, 18, 122033.90, 800000, '2026-03-08', 'payee', 'mobile_money', 'LOC-2026-03'),
  (v_ent, v_cd_equip,     v_user, 'DEP-DEMO-008', 'Fournitures et consommables de bureau', 'Bureautique Express', v_fr5,
   211864.41, 18, 38135.59, 250000, '2026-03-28', 'en_attente', 'virement', 'FOU-2026-03'),
  (v_ent, v_cd_services,  v_user, 'DEP-DEMO-009', 'Prime d''assurance chantier - année 2026', 'NSIA Assurances', NULL,
   1200000, 0, 0, 1200000, '2026-01-10', 'payee', 'virement', 'ASS-2026'),
  (v_ent, v_cd_perso,     v_user, 'DEP-DEMO-010', 'Frais de mission et déplacements - avril', 'Personnel OA SARL', NULL,
   338983.05, 18, 61016.95, 400000, '2026-04-15', 'en_attente', 'cash', 'MIS-2026-04');

RAISE NOTICE 'Enrichissement du compte démo terminé pour l''entreprise %', v_ent;

END $$;
