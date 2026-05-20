SET client_encoding = 'UTF8';

-- ============================================================
-- ApeX - Seed donnees demo
-- Entreprise : Ouattara & Associes SARL (BTP / Genie Civil)
-- Pays : Cote d'Ivoire - FCFA
-- ============================================================

DO $$
DECLARE
  v_user_id       UUID;
  v_ent1_id       UUID;
  v_ent2_id       UUID;
  v_cat_loyer     UUID; v_cat_salaires UUID; v_cat_transport UUID;
  v_cat_fourni    UUID; v_cat_telecom   UUID; v_cat_materiel  UUID;
  v_cat_carb      UUID; v_cat_presta    UUID; v_cat_assurance UUID;
  v_cat_divers    UUID;
  -- clients ent1
  v_cl_sotra      UUID; v_cl_ageroute   UUID; v_cl_cim        UUID;
  v_cl_palm       UUID; v_cl_ecobank    UUID; v_cl_mairie     UUID;
  -- clients ent2
  v_cl_canal      UUID; v_cl_mtn        UUID; v_cl_soc        UUID;
  v_cl_particulier UUID;
  -- factures
  v_fac1 UUID; v_fac2 UUID; v_fac3 UUID; v_fac4 UUID; v_fac5 UUID;
  v_fac6 UUID; v_fac7 UUID; v_fac8 UUID; v_fac9 UUID; v_fac10 UUID;
  -- ent2 cats
  v_c2_loyer UUID; v_c2_sal UUID; v_c2_tel UUID; v_c2_mat UUID; v_c2_div UUID;

BEGIN

-- -- 1. Recuperer utilisateur demo ---------------------------
SELECT id INTO v_user_id FROM utilisateurs WHERE email = 'demo@comptawest.ci';
IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Utilisateur demo introuvable. Lancez POST /auth/demo en premier.';
END IF;

-- -- 2. Nettoyer anciennes donnees ----------------------------
FOR v_ent1_id IN
  SELECT e.id FROM entreprises e
  JOIN membres_entreprise m ON m.entreprise_id = e.id
  WHERE m.utilisateur_id = v_user_id
LOOP
  DELETE FROM paiements       WHERE facture_id IN (SELECT id FROM factures WHERE entreprise_id = v_ent1_id);
  DELETE FROM lignes_facture  WHERE facture_id IN (SELECT id FROM factures WHERE entreprise_id = v_ent1_id);
  DELETE FROM factures        WHERE entreprise_id = v_ent1_id;
  DELETE FROM clients         WHERE entreprise_id = v_ent1_id;
  DELETE FROM depenses        WHERE entreprise_id = v_ent1_id;
  DELETE FROM declarations_taxes WHERE entreprise_id = v_ent1_id;
  DELETE FROM categories_depenses WHERE entreprise_id = v_ent1_id;
  DELETE FROM membres_entreprise  WHERE entreprise_id = v_ent1_id;
  DELETE FROM entreprises         WHERE id = v_ent1_id;
END LOOP;

-- ===========================================================
-- ENTREPRISE 1 : Ouattara & Associes SARL (BTP)
-- ===========================================================
INSERT INTO entreprises (nom, sigle, forme_juridique, secteur, email, telephone, adresse, ville, pays, ninea, rccm, regime_fiscal, taux_tva, devise)
VALUES ('Ouattara & Associes SARL', 'OA SARL', 'SARL', 'Batiment et Travaux Publics',
        'contact@ouattara-associes.ci', '+225 27 22 41 35 00',
        'Rue des Jardins, Cocody, Abidjan', 'Abidjan', 'Cote d''Ivoire',
        'CI-2019-B-3721', 'RCC/ABJ/2019/B/03721', 'RNI', 18.00, 'FCFA')
RETURNING id INTO v_ent1_id;

INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
VALUES (v_user_id, v_ent1_id, 'proprietaire');

-- Categories de depenses (SYSCOHADA)
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Loyer et charges', '62', '#4E8BF5')  RETURNING id INTO v_cat_loyer;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Salaires et charges sociales', '66', '#A855F7') RETURNING id INTO v_cat_salaires;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Transport et deplacement', '61', '#F97316') RETURNING id INTO v_cat_transport;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Fournitures et consommables', '60', '#00D4AA') RETURNING id INTO v_cat_fourni;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Telecommunications', '626', '#EC4899') RETURNING id INTO v_cat_telecom;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Materiel et equipements', '24', '#84CC16') RETURNING id INTO v_cat_materiel;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Carburant et lubrifiants', '60', '#F5A623') RETURNING id INTO v_cat_carb;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Sous-traitance', '604', '#FF5C6B') RETURNING id INTO v_cat_presta;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Assurances', '625', '#6B7A99') RETURNING id INTO v_cat_assurance;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent1_id, 'Charges diverses', '65', '#9BAACC') RETURNING id INTO v_cat_divers;

-- Clients entreprise 1
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea, rccm)
VALUES (v_ent1_id, 'CLI-001', 'SOTRA - Societe des Transports Abidjanais', 'entreprise',
        'dg@sotra.ci', '+225 27 20 25 30 00', 'Boulevard Valery Giscard d''Estaing, Treichville', 'Abidjan', 'Cote d''Ivoire',
        'CI-1960-A-0001', 'RCC/ABJ/1960/A/00001')
RETURNING id INTO v_cl_sotra;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea)
VALUES (v_ent1_id, 'CLI-002', 'AGEROUTE - Agence de Gestion des Routes', 'entreprise',
        'info@ageroute.ci', '+225 27 22 50 28 00', 'Rue Pierre et Marie Curie, Plateau', 'Abidjan', 'Cote d''Ivoire',
        'CI-2001-P-4521')
RETURNING id INTO v_cl_ageroute;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea)
VALUES (v_ent1_id, 'CLI-003', 'CIMAF - Ciments de l''Afrique', 'entreprise',
        'commercial@cimaf.ci', '+225 27 21 75 41 00', 'Zone Industrielle de Vridi', 'Abidjan', 'Cote d''Ivoire',
        'CI-2004-M-7832')
RETURNING id INTO v_cl_cim;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays, ninea)
VALUES (v_ent1_id, 'CLI-004', 'PALMCI - Palmiers de Cote d''Ivoire', 'entreprise',
        'achats@palmci.ci', '+225 27 21 22 36 00', 'Rue Gourgas, Cocody', 'Abidjan', 'Cote d''Ivoire',
        'CI-1997-A-2247')
RETURNING id INTO v_cl_palm;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays)
VALUES (v_ent1_id, 'CLI-005', 'Ecobank Cote d''Ivoire', 'entreprise',
        'procurement@ecobank.com', '+225 27 20 99 80 00', 'Immeuble Alliance, Avenue Terrasson de Fougeres, Plateau', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_ecobank;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays)
VALUES (v_ent1_id, 'CLI-006', 'Mairie d''Abobo', 'entreprise',
        'mairie@abobo.ci', '+225 27 23 50 40 00', 'Quartier Administratif, Abobo', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_mairie;

-- -- FACTURES 2024 --------------------------------------------

-- Facture 1 : Construction mur de cloture SOTRA (payee)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_sotra, v_user_id, 'F-2024-001', 'facture', 'payee',
  '2024-01-15', '2024-02-15', 5084745.76, 18, 915254.24, 6000000.00,
  6000000.00, 'Construction mur de cloture depot principal SOTRA Treichville',
  'Paiement a 30 jours')
RETURNING id INTO v_fac1;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac1, 'Fouilles et terrassement', 120, 'm3', 8500.00, 0, 1020000.00, 0),
  (v_fac1, 'Beton arme fondation', 45, 'm3', 95000.00, 0, 4275000.00, 1),
  (v_fac1, 'Maconnerie parpaing 20cm', 380, 'm2', 12500.00, 5, 4513750.00, 2),
  (v_fac1, 'Enduit ciment double face', 760, 'm2', 3500.00, 0, 2660000.00, 3);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac1, 3000000.00, '2024-02-10', 'virement', 'VIR-SOTRA-2024-001'),
  (v_fac1, 3000000.00, '2024-02-28', 'virement', 'VIR-SOTRA-2024-002');

-- Facture 2 : Rehabilitation route AGEROUTE (payee)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_ageroute, v_user_id, 'F-2024-002', 'facture', 'payee',
  '2024-02-20', '2024-03-20', 16949152.54, 18, 3050847.46, 20000000.00,
  20000000.00, 'Rehabilitation voirie interne Zone Industrielle de Vridi - Phase 1',
  'Paiement a 30 jours - Virement bancaire uniquement')
RETURNING id INTO v_fac2;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac2, 'Depose revetement existant', 2500, 'm2', 2200.00, 0, 5500000.00, 0),
  (v_fac2, 'Couche de base grave laterite', 2500, 'm2', 4500.00, 0, 11250000.00, 1),
  (v_fac2, 'Revetement beton bitumineux 8cm', 2500, 'm2', 12500.00, 5, 29687500.00, 2),
  (v_fac2, 'Marquage routier et signalisation', 1, 'forfait', 2500000.00, 0, 2500000.00, 3);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac2, 20000000.00, '2024-03-18', 'virement', 'VIR-AGEROUTE-0220');

-- Facture 3 : Dalles beton CIMAF (payee)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_cim, v_user_id, 'F-2024-003', 'facture', 'payee',
  '2024-04-05', '2024-05-05', 6355932.20, 18, 1144067.80, 7500000.00,
  7500000.00, 'Construction dalle industrielle usine CIMAF Vridi',
  'Paiement a 30 jours')
RETURNING id INTO v_fac3;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac3, 'Remblai et compactage', 800, 'm3', 4500.00, 0, 3600000.00, 0),
  (v_fac3, 'Dalle beton arme ep.15cm', 1200, 'm2', 18500.00, 0, 22200000.00, 1),
  (v_fac3, 'Joint de dilatation', 85, 'ml', 15000.00, 0, 1275000.00, 2);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac3, 7500000.00, '2024-05-02', 'cheque', 'CHQ-CIMAF-0405');

-- Facture 4 : Extension bureaux PALMCI (partiellement payee)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_palm, v_user_id, 'F-2024-004', 'facture', 'en_attente',
  '2024-06-10', '2024-07-10', 21186440.68, 18, 3813559.32, 25000000.00,
  12500000.00, 'Extension et renovation bureaux administratifs PALMCI Cocody - Tranche 1',
  'Paiement en 2 tranches : 50% a la commande, 50% a la livraison')
RETURNING id INTO v_fac4;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac4, 'Gros oeuvre extension 120m2', 120, 'm2', 85000.00, 0, 10200000.00, 0),
  (v_fac4, 'Menuiserie aluminium', 24, 'unite', 180000.00, 0, 4320000.00, 1),
  (v_fac4, 'Carrelage sol et mur', 240, 'm2', 18500.00, 0, 4440000.00, 2),
  (v_fac4, 'Plomberie sanitaire', 1, 'forfait', 3500000.00, 0, 3500000.00, 3),
  (v_fac4, 'Electricite courant fort/faible', 1, 'forfait', 4200000.00, 0, 4200000.00, 4),
  (v_fac4, 'Peinture et finitions', 360, 'm2', 4500.00, 5, 1539000.00, 5);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac4, 12500000.00, '2024-06-12', 'virement', 'VIR-PALMCI-AVANCE');

-- Facture 5 : Amenagement Ecobank 2025 (payee)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_ecobank, v_user_id, 'F-2025-001', 'facture', 'payee',
  '2025-01-08', '2025-02-08', 8474576.27, 18, 1525423.73, 10000000.00,
  10000000.00, 'Amenagement espace reception et bureaux Ecobank Plateau',
  'Paiement a 30 jours')
RETURNING id INTO v_fac5;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac5, 'Cloisons vitrees aluminium', 45, 'ml', 95000.00, 0, 4275000.00, 0),
  (v_fac5, 'Faux plafond suspendu', 280, 'm2', 12500.00, 0, 3500000.00, 1),
  (v_fac5, 'Revetement sol vinyle', 280, 'm2', 8500.00, 0, 2380000.00, 2),
  (v_fac5, 'Eclairage LED encastre', 85, 'unite', 35000.00, 0, 2975000.00, 3);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac5, 10000000.00, '2025-02-05', 'virement', 'VIR-ECOBANK-0108');

-- Facture 6 : Voirie Mairie Abobo 2025 (envoyee, en attente)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_mairie, v_user_id, 'F-2025-002', 'facture', 'envoyee',
  '2025-03-15', '2025-04-15', 12711864.41, 18, 2288135.59, 15000000.00,
  0, 'Rehabilitation voirie quartier Abobo Baoule - Lot 2',
  'Paiement a 30 jours - Bon de commande N. BC-MABOBO-2025-012')
RETURNING id INTO v_fac6;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac6, 'Terrassement et mise en forme', 3500, 'm2', 1800.00, 0, 6300000.00, 0),
  (v_fac6, 'Couche de roulement beton', 3500, 'm2', 9500.00, 0, 33250000.00, 1),
  (v_fac6, 'Caniveaux prefabriques', 420, 'ml', 12500.00, 0, 5250000.00, 2);

-- Facture 7 : Devis non accepte SOTRA (brouillon)
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_sotra, v_user_id, 'D-2025-001', 'devis', 'brouillon',
  '2025-04-01', '2025-05-01', 25423728.81, 18, 4576271.19, 30000000.00,
  0, 'Devis construction depot de maintenance bus ligne nord - En cours de validation',
  'Devis valable 60 jours')
RETURNING id INTO v_fac7;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac7, 'Terrassement general', 1500, 'm3', 6500.00, 0, 9750000.00, 0),
  (v_fac7, 'Structure metallique hangar', 1, 'forfait', 18000000.00, 0, 18000000.00, 1),
  (v_fac7, 'Dalle beton arme', 800, 'm2', 22000.00, 0, 17600000.00, 2),
  (v_fac7, 'Facade et couverture', 1, 'forfait', 8500000.00, 0, 8500000.00, 3);

-- Factures 2026
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_ageroute, v_user_id, 'F-2026-001', 'facture', 'payee',
  '2026-01-10', '2026-02-10', 29661016.95, 18, 5338983.05, 35000000.00,
  35000000.00, 'Rehabilitation RN3 Troncon Anyama - Abobo - Phase 1',
  'Paiement a 30 jours')
RETURNING id INTO v_fac8;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac8, 'Nettoyage et debroussaillage', 12000, 'm2', 500.00, 0, 6000000.00, 0),
  (v_fac8, 'Scarification et reprofilage', 8500, 'm2', 3500.00, 0, 29750000.00, 1),
  (v_fac8, 'Couche d''accrochage bitumineuse', 8500, 'm2', 2200.00, 0, 18700000.00, 2),
  (v_fac8, 'Beton bitumineux semi-grenus', 8500, 'm2', 14500.00, 0, 123250000.00, 3);

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference) VALUES
  (v_fac8, 35000000.00, '2026-02-08', 'virement', 'VIR-AGEROUTE-2026-001');

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_ecobank, v_user_id, 'F-2026-002', 'facture', 'en_attente',
  '2026-02-15', '2026-03-15', 16949152.54, 18, 3050847.46, 20000000.00,
  0, 'Renovation agence Ecobank Yopougon - Gros oeuvre et second oeuvre',
  'Paiement a 30 jours')
RETURNING id INTO v_fac9;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac9, 'Demolition et depose existant', 1, 'forfait', 3500000.00, 0, 3500000.00, 0),
  (v_fac9, 'Maconnerie et gros oeuvre', 350, 'm2', 45000.00, 0, 15750000.00, 1),
  (v_fac9, 'Revetements sols et murs', 350, 'm2', 22000.00, 0, 7700000.00, 2),
  (v_fac9, 'Peinture et finitions', 700, 'm2', 4500.00, 0, 3150000.00, 3);

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
  montant_paye, notes, conditions_paiement)
VALUES (v_ent1_id, v_cl_cim, v_user_id, 'F-2026-003', 'facture', 'retard',
  '2026-01-20', '2026-02-20', 8474576.27, 18, 1525423.73, 10000000.00,
  0, 'Extension hangar stockage clinker - CIMAF Vridi',
  'Paiement a 30 jours - En retard depuis le 20 fevrier 2026')
RETURNING id INTO v_fac10;

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre) VALUES
  (v_fac10, 'Structure metallique portique', 1, 'forfait', 14500000.00, 0, 14500000.00, 0),
  (v_fac10, 'Couverture bac acier galvanise', 1200, 'm2', 8500.00, 0, 10200000.00, 1),
  (v_fac10, 'Fondations en beton', 180, 'm3', 95000.00, 0, 17100000.00, 2);

-- -- DEPENSES 2024 --------------------------------------------
INSERT INTO depenses (entreprise_id, categorie_id, cree_par, numero, description, fournisseur,
  montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement, reference) VALUES
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2024-001', 'Loyer bureaux Cocody janvier 2024', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2024-01-05', 'payee', 'virement', 'LOY-2024-001'),
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2024-002', 'Loyer bureaux Cocody fevrier 2024', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2024-02-05', 'payee', 'virement', 'LOY-2024-002'),
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2024-003', 'Loyer bureaux Cocody mars 2024', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2024-03-05', 'payee', 'virement', 'LOY-2024-003'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2024-004', 'Salaires charges fixes janvier 2024', 'Personnel OA SARL',
   2118644.07, 0, 0, 2118644.07, '2024-01-28', 'payee', 'virement', 'SAL-2024-001'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2024-005', 'Salaires charges fixes fevrier 2024', 'Personnel OA SARL',
   2118644.07, 0, 0, 2118644.07, '2024-02-28', 'payee', 'virement', 'SAL-2024-002'),
  (v_ent1_id, v_cat_carb, v_user_id, 'DEP-2024-006', 'Carburant vehicules de chantier janvier', 'Total Energies CI',
   338983.05, 18, 61016.95, 400000.00, '2024-01-20', 'payee', 'cash', 'CAR-2024-001'),
  (v_ent1_id, v_cat_carb, v_user_id, 'DEP-2024-007', 'Carburant vehicules de chantier fevrier', 'Total Energies CI',
   338983.05, 18, 61016.95, 400000.00, '2024-02-18', 'payee', 'cash', 'CAR-2024-002'),
  (v_ent1_id, v_cat_materiel, v_user_id, 'DEP-2024-008', 'Achat outillage chantier SOTRA', 'Quincaillerie du BTP Abidjan',
   1271186.44, 18, 228813.56, 1500000.00, '2024-01-10', 'payee', 'cheque', 'MAT-2024-001'),
  (v_ent1_id, v_cat_presta, v_user_id, 'DEP-2024-009', 'Sous-traitance coffrage chantier AGEROUTE', 'BATIMCI SARL',
   2542372.88, 18, 457627.12, 3000000.00, '2024-03-01', 'payee', 'virement', 'PRES-2024-001'),
  (v_ent1_id, v_cat_telecom, v_user_id, 'DEP-2024-010', 'Abonnement internet et telephonie mars', 'Orange Business CI',
   127118.64, 18, 22881.36, 150000.00, '2024-03-01', 'payee', 'mobile_money', 'TEL-2024-001');

-- Depenses 2025
INSERT INTO depenses (entreprise_id, categorie_id, cree_par, numero, description, fournisseur,
  montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement, reference) VALUES
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2025-001', 'Loyer bureaux janvier 2025', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2025-01-05', 'payee', 'virement', 'LOY-2025-001'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2025-002', 'Salaires fixes janvier 2025', 'Personnel OA SARL',
   2330508.47, 0, 0, 2330508.47, '2025-01-28', 'payee', 'virement', 'SAL-2025-001'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2025-003', 'Salaires fixes fevrier 2025', 'Personnel OA SARL',
   2330508.47, 0, 0, 2330508.47, '2025-02-28', 'payee', 'virement', 'SAL-2025-002'),
  (v_ent1_id, v_cat_materiel, v_user_id, 'DEP-2025-004', 'Echafaudages et materiel chantier Ecobank', 'Materiel BTP CI',
   1694915.25, 18, 305084.75, 2000000.00, '2025-01-15', 'payee', 'cheque', 'MAT-2025-001'),
  (v_ent1_id, v_cat_assurance, v_user_id, 'DEP-2025-005', 'Assurance chantier responsabilite civile 2025', 'NSIA Assurances',
   847457.63, 0, 0, 847457.63, '2025-01-02', 'payee', 'virement', 'ASS-2025-001'),
  (v_ent1_id, v_cat_transport, v_user_id, 'DEP-2025-006', 'Location camion benne chantier Mairie', 'Transport Kone SARL',
   507627.12, 18, 91372.88, 599000.00, '2025-03-10', 'payee', 'cash', 'TRP-2025-001');

-- Depenses 2026
INSERT INTO depenses (entreprise_id, categorie_id, cree_par, numero, description, fournisseur,
  montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement, reference) VALUES
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2026-001', 'Loyer bureaux janvier 2026', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2026-01-05', 'payee', 'virement', 'LOY-2026-001'),
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2026-002', 'Loyer bureaux fevrier 2026', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2026-02-05', 'payee', 'virement', 'LOY-2026-002'),
  (v_ent1_id, v_cat_loyer, v_user_id, 'DEP-2026-003', 'Loyer bureaux mars 2026', 'Immobiliere de la Lagune',
   847457.63, 18, 152542.37, 1000000.00, '2026-03-05', 'payee', 'virement', 'LOY-2026-003'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2026-004', 'Salaires fixes janvier 2026', 'Personnel OA SARL',
   2500000.00, 0, 0, 2500000.00, '2026-01-28', 'payee', 'virement', 'SAL-2026-001'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2026-005', 'Salaires fixes fevrier 2026', 'Personnel OA SARL',
   2500000.00, 0, 0, 2500000.00, '2026-02-28', 'payee', 'virement', 'SAL-2026-002'),
  (v_ent1_id, v_cat_salaires, v_user_id, 'DEP-2026-006', 'Salaires fixes mars 2026', 'Personnel OA SARL',
   2500000.00, 0, 0, 2500000.00, '2026-03-28', 'payee', 'virement', 'SAL-2026-003'),
  (v_ent1_id, v_cat_carb, v_user_id, 'DEP-2026-007', 'Carburant chantier AGEROUTE RN3 janvier', 'Total Energies CI',
   508474.58, 18, 91525.42, 600000.00, '2026-01-18', 'payee', 'cash', 'CAR-2026-001'),
  (v_ent1_id, v_cat_carb, v_user_id, 'DEP-2026-008', 'Carburant chantier AGEROUTE RN3 fevrier', 'Total Energies CI',
   508474.58, 18, 91525.42, 600000.00, '2026-02-15', 'payee', 'cash', 'CAR-2026-002'),
  (v_ent1_id, v_cat_presta, v_user_id, 'DEP-2026-009', 'Sous-traitance ferraillage chantier RN3', 'Acier et Ferraillage CI',
   4237288.14, 18, 762711.86, 5000000.00, '2026-01-25', 'payee', 'virement', 'PRES-2026-001'),
  (v_ent1_id, v_cat_materiel, v_user_id, 'DEP-2026-010', 'Location grue mobile chantier Ecobank Yopougon', 'Engin Location CI',
   2542372.88, 18, 457627.12, 3000000.00, '2026-02-20', 'payee', 'virement', 'MAT-2026-001'),
  (v_ent1_id, v_cat_fourni, v_user_id, 'DEP-2026-011', 'Ciment CPA 42.5 chantier CIMAF', 'CIMAF Distribution',
   1694915.25, 18, 305084.75, 2000000.00, '2026-01-22', 'payee', 'cheque', 'FOU-2026-001'),
  (v_ent1_id, v_cat_telecom, v_user_id, 'DEP-2026-012', 'Abonnement internet et telephonie janvier', 'Orange Business CI',
   127118.64, 18, 22881.36, 150000.00, '2026-01-02', 'payee', 'mobile_money', 'TEL-2026-001'),
  (v_ent1_id, v_cat_telecom, v_user_id, 'DEP-2026-013', 'Abonnement internet et telephonie fevrier', 'Orange Business CI',
   127118.64, 18, 22881.36, 150000.00, '2026-02-02', 'payee', 'mobile_money', 'TEL-2026-002'),
  (v_ent1_id, v_cat_divers, v_user_id, 'DEP-2026-014', 'Frais bancaires et commissions Q1 2026', 'Societe Generale CI',
   84745.76, 0, 0, 84745.76, '2026-03-01', 'payee', 'virement', 'DIV-2026-001');

-- -- TAXES ----------------------------------------------------
INSERT INTO declarations_taxes (entreprise_id, cree_par, type_taxe, organisme,
  periode_debut, periode_fin, date_echeance, montant_base, taux, montant_du, montant_paye, statut, notes) VALUES
  (v_ent1_id, v_user_id, 'TVA', 'DGI',
   '2024-01-01', '2024-03-31', '2024-04-15', 33898305.08, 18, 6101694.92, 6101694.92, 'payee',
   'TVA collectee T1 2024 - Declare et paye'),
  (v_ent1_id, v_user_id, 'TVA', 'DGI',
   '2024-04-01', '2024-06-30', '2024-07-15', 29661016.95, 18, 5338983.05, 5338983.05, 'payee',
   'TVA collectee T2 2024 - Declare et paye'),
  (v_ent1_id, v_user_id, 'CNSS', 'CNSS',
   '2024-01-01', '2024-06-30', '2024-07-10', 12711864.41, 14, 1779661.02, 1779661.02, 'payee',
   'Cotisations CNSS 1er semestre 2024 - Part patronale'),
  (v_ent1_id, v_user_id, 'BIC', 'DGI',
   '2024-01-01', '2024-12-31', '2025-03-31', 25423728.81, 20, 5084745.76, 5084745.76, 'payee',
   'BIC exercice 2024 - Benefice imposable'),
  (v_ent1_id, v_user_id, 'TVA', 'DGI',
   '2025-01-01', '2025-03-31', '2025-04-15', 18644067.80, 18, 3355932.20, 3355932.20, 'payee',
   'TVA collectee T1 2025 - Declare et paye'),
  (v_ent1_id, v_user_id, 'CNSS', 'CNSS',
   '2025-01-01', '2025-06-30', '2025-07-10', 13983050.85, 14, 1957627.12, 0, 'a_payer',
   'Cotisations CNSS 1er semestre 2025 - A regler avant le 10 juillet 2025'),
  (v_ent1_id, v_user_id, 'TVA', 'DGI',
   '2026-01-01', '2026-03-31', '2026-04-15', 55084745.76, 18, 9915254.24, 0, 'a_payer',
   'TVA collectee T1 2026 - A declarer et payer avant le 15 avril 2026'),
  (v_ent1_id, v_user_id, 'Patente', 'DGI',
   '2026-01-01', '2026-12-31', '2026-03-31', 35000000.00, 0.5, 175000.00, 175000.00, 'payee',
   'Patente annuelle 2026 - Payee le 15 janvier 2026'),
  (v_ent1_id, v_user_id, 'CMU', 'CNSS',
   '2026-01-01', '2026-03-31', '2026-04-30', 7500000.00, 3.5, 262500.00, 0, 'a_payer',
   'Cotisation CMU T1 2026 - 8 employes');

-- ===========================================================
-- ENTREPRISE 2 : Kone Digital Agency (Numerique / Marketing)
-- ===========================================================
INSERT INTO entreprises (nom, sigle, forme_juridique, secteur, email, telephone, adresse, ville, pays, ninea, rccm, regime_fiscal, taux_tva, devise)
VALUES ('Kone Digital Agency', 'KDA', 'SARL', 'Marketing Digital et Communication',
        'hello@kone-digital.ci', '+225 07 08 12 34 56',
        'Immeuble Nour Al Hayat, Avenue Chardy, Plateau', 'Abidjan', 'Cote d''Ivoire',
        'CI-2021-N-5643', 'RCC/ABJ/2021/N/05643', 'RSI', 18.00, 'FCFA')
RETURNING id INTO v_ent2_id;

INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
VALUES (v_user_id, v_ent2_id, 'proprietaire');

-- Categories ent2
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent2_id, 'Loyer et charges locatives', '62', '#4E8BF5') RETURNING id INTO v_c2_loyer;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent2_id, 'Salaires et charges', '66', '#A855F7') RETURNING id INTO v_c2_sal;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent2_id, 'Logiciels et abonnements', '618', '#00D4AA') RETURNING id INTO v_c2_tel;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent2_id, 'Materiel informatique', '24', '#84CC16') RETURNING id INTO v_c2_mat;
INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES
  (v_ent2_id, 'Charges diverses', '65', '#9BAACC') RETURNING id INTO v_c2_div;

-- Clients ent2
INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays)
VALUES (v_ent2_id, 'CLI-001', 'Canal+ Afrique CI', 'entreprise',
        'marketing@canalplus.ci', '+225 27 24 46 46 00', 'Tour CCIA, Avenue Noguess, Plateau', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_canal;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays)
VALUES (v_ent2_id, 'CLI-002', 'MTN Cote d''Ivoire', 'entreprise',
        'b2b@mtn.ci', '+225 07 77 00 00 00', 'Immeuble MTN, Rue Lecoeur, Plateau', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_mtn;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, adresse, ville, pays)
VALUES (v_ent2_id, 'CLI-003', 'Societe Generale Cote d''Ivoire', 'entreprise',
        'marketing@sgci.com', '+225 27 20 12 34 56', 'Boulevard Botreau Roussel, Plateau', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_soc;

INSERT INTO clients (entreprise_id, code, nom, type, email, telephone, ville, pays)
VALUES (v_ent2_id, 'CLI-004', 'Diallo Mamadou', 'particulier',
        'diallo.mamadou@gmail.com', '+225 07 45 67 89 01', 'Abidjan', 'Cote d''Ivoire')
RETURNING id INTO v_cl_particulier;

-- Factures ent2 2026
INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent2_id, v_cl_canal, v_user_id, 'F-2026-001', 'facture', 'payee',
  '2026-01-05', '2026-02-05', 2542372.88, 18, 457627.12, 3000000.00, 3000000.00,
  'Campagne digitale reseaux sociaux Canal+ Janvier 2026 - Facebook/Instagram/TikTok',
  'Paiement a 30 jours');

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre)
SELECT f.id, l.libelle, l.qte, l.unite, l.pu, l.rem, l.tot, l.ord
FROM factures f, (VALUES
  ('Strategie et conception creative', 1, 'forfait', 800000.00, 0, 800000.00, 0),
  ('Production visuels et videos courtes', 12, 'unite', 95000.00, 0, 1140000.00, 1),
  ('Gestion campagnes paid social (budget media 500K)', 1, 'forfait', 450000.00, 0, 450000.00, 2),
  ('Community management 30 jours', 1, 'forfait', 350000.00, 0, 350000.00, 3)
) AS l(libelle, qte, unite, pu, rem, tot, ord)
WHERE f.numero = 'F-2026-001' AND f.entreprise_id = v_ent2_id;

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference)
SELECT f.id, 3000000.00, '2026-02-03', 'virement', 'VIR-CANAL-2026-001'
FROM factures f WHERE f.numero = 'F-2026-001' AND f.entreprise_id = v_ent2_id;

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent2_id, v_cl_mtn, v_user_id, 'F-2026-002', 'facture', 'en_attente',
  '2026-02-10', '2026-03-10', 4237288.14, 18, 762711.86, 5000000.00, 0,
  'Refonte site web et application mobile MTN CI - Phase 1 UX/UI + Developpement',
  'Paiement a 30 jours');

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre)
SELECT f.id, l.libelle, l.qte, l.unite, l.pu, l.rem, l.tot, l.ord
FROM factures f, (VALUES
  ('Audit UX et benchmark concurrentiel', 1, 'forfait', 600000.00, 0, 600000.00, 0),
  ('Design UI site web - 15 pages', 15, 'page', 120000.00, 0, 1800000.00, 1),
  ('Integration front-end responsive', 15, 'page', 95000.00, 0, 1425000.00, 2),
  ('Application mobile iOS et Android - Design', 1, 'forfait', 1200000.00, 0, 1200000.00, 3),
  ('Tests utilisateurs et livraison', 1, 'forfait', 500000.00, 0, 500000.00, 4)
) AS l(libelle, qte, unite, pu, rem, tot, ord)
WHERE f.numero = 'F-2026-002' AND f.entreprise_id = v_ent2_id;

INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
  date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, notes, conditions_paiement)
VALUES (v_ent2_id, v_cl_soc, v_user_id, 'F-2026-003', 'facture', 'payee',
  '2026-03-01', '2026-03-31', 1694915.25, 18, 305084.75, 2000000.00, 2000000.00,
  'Formation equipe marketing digital SGCI - 3 jours',
  'Paiement a 30 jours');

INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre)
SELECT f.id, l.libelle, l.qte, l.unite, l.pu, l.rem, l.tot, l.ord
FROM factures f, (VALUES
  ('Formation Marketing Digital Fondamentaux - 2 jours', 2, 'jour', 500000.00, 0, 1000000.00, 0),
  ('Formation SEO/SEA pratique - 1 jour', 1, 'jour', 450000.00, 0, 450000.00, 1),
  ('Support et materiaux pedagogiques', 15, 'participant', 23000.00, 0, 345000.00, 2)
) AS l(libelle, qte, unite, pu, rem, tot, ord)
WHERE f.numero = 'F-2026-003' AND f.entreprise_id = v_ent2_id;

INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference)
SELECT f.id, 2000000.00, '2026-03-15', 'virement', 'VIR-SGCI-2026-003'
FROM factures f WHERE f.numero = 'F-2026-003' AND f.entreprise_id = v_ent2_id;

-- Depenses ent2 2026
INSERT INTO depenses (entreprise_id, categorie_id, cree_par, numero, description, fournisseur,
  montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, statut, mode_paiement) VALUES
  (v_ent2_id, v_c2_loyer, v_user_id, 'DEP-2026-001', 'Loyer bureau Plateau janvier 2026', 'CFAO Immobilier',
   720338.98, 18, 129661.02, 850000.00, '2026-01-05', 'payee', 'virement'),
  (v_ent2_id, v_c2_loyer, v_user_id, 'DEP-2026-002', 'Loyer bureau Plateau fevrier 2026', 'CFAO Immobilier',
   720338.98, 18, 129661.02, 850000.00, '2026-02-05', 'payee', 'virement'),
  (v_ent2_id, v_c2_sal, v_user_id, 'DEP-2026-003', 'Salaires equipe janvier 2026', 'Personnel KDA',
   1500000.00, 0, 0, 1500000.00, '2026-01-28', 'payee', 'virement'),
  (v_ent2_id, v_c2_sal, v_user_id, 'DEP-2026-004', 'Salaires equipe fevrier 2026', 'Personnel KDA',
   1500000.00, 0, 0, 1500000.00, '2026-02-28', 'payee', 'virement'),
  (v_ent2_id, v_c2_tel, v_user_id, 'DEP-2026-005', 'Adobe Creative Cloud annuel', 'Adobe Systems',
   423728.81, 18, 76271.19, 500000.00, '2026-01-10', 'payee', 'carte'),
  (v_ent2_id, v_c2_tel, v_user_id, 'DEP-2026-006', 'Abonnement outils marketing HubSpot', 'HubSpot Inc',
   338983.05, 18, 61016.95, 400000.00, '2026-01-10', 'payee', 'carte'),
  (v_ent2_id, v_c2_mat, v_user_id, 'DEP-2026-007', 'MacBook Pro M4 graphiste', 'iStore Abidjan',
   1694915.25, 18, 305084.75, 2000000.00, '2026-02-01', 'payee', 'cheque');

-- Taxes ent2
INSERT INTO declarations_taxes (entreprise_id, cree_par, type_taxe, organisme,
  periode_debut, periode_fin, date_echeance, montant_base, taux, montant_du, montant_paye, statut, notes) VALUES
  (v_ent2_id, v_user_id, 'TVA', 'DGI',
   '2026-01-01', '2026-03-31', '2026-04-15', 8474576.27, 18, 1525423.73, 0, 'a_payer',
   'TVA nette T1 2026 : collectee 1 525 424 FCFA - deductible 135 593 FCFA'),
  (v_ent2_id, v_user_id, 'CNSS', 'CNSS',
   '2026-01-01', '2026-03-31', '2026-04-10', 3000000.00, 14, 420000.00, 420000.00, 'payee',
   'Cotisations CNSS T1 2026 - 4 employes - Paye le 05 avril 2026');

RAISE NOTICE 'Seed demo termine avec succes !';
RAISE NOTICE 'Entreprise 1 : Ouattara & Associes SARL (BTP) - ID: %', v_ent1_id;
RAISE NOTICE 'Entreprise 2 : Kone Digital Agency - ID: %', v_ent2_id;

END $$;