-- Migration 031 — Suppression du flow de candidature publique des cabinets.
--
-- CONTEXTE :
-- Le programme Partenaires Cabinets ne passe plus par une page publique de
-- candidature (/partenaires-cabinets). Désormais, le super-admin invite
-- directement les cabinets via /admin → bouton « Inviter un cabinet », qui
-- crée le compte de bout en bout et envoie l'email d'invitation signé.
--
-- Cette migration supprime la table devenue inutile.
-- Sécurité : aucune donnée n'est référencée ailleurs (FK uniquement vers
-- entreprises.id et utilisateurs.id, pas l'inverse).

DROP TABLE IF EXISTS cabinet_candidatures;
