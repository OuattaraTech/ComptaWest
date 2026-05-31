-- Migration 040 — Abonnés à la newsletter ApeX.
--
-- Table de collecte des adresses email saisies dans le bandeau newsletter
-- du pied de page de la landing (public, sans authentification).
--
-- Choix de conception :
--   - `email` UNIQUE → un même email ne crée jamais de doublon ; une
--     ré-inscription après désabonnement réactive simplement la ligne.
--   - `statut` ('actif' | 'desabonne') plutôt qu'une suppression dure :
--     on garde la trace pour respecter un éventuel opt-out (RGPD/loi CI)
--     et éviter de réinscrire quelqu'un qui s'est désabonné.
--   - `unsubscribe_token` → lien de désinscription en un clic (header
--     List-Unsubscribe et page publique future), sans exposer l'id.
--   - `source` → d'où vient l'inscription (footer, popup, import…), utile
--     pour mesurer les canaux d'acquisition plus tard.

BEGIN;

CREATE TABLE IF NOT EXISTS newsletter_abonnes (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email              VARCHAR(255) NOT NULL UNIQUE,
  langue             VARCHAR(5)   NOT NULL DEFAULT 'fr',
  source             VARCHAR(50)  NOT NULL DEFAULT 'footer',
  statut             VARCHAR(20)  NOT NULL DEFAULT 'actif'
                       CHECK (statut IN ('actif', 'desabonne')),
  ip                 VARCHAR(64),
  unsubscribe_token  UUID         NOT NULL DEFAULT gen_random_uuid(),
  cree_le            TIMESTAMP    NOT NULL DEFAULT NOW(),
  maj_le             TIMESTAMP    NOT NULL DEFAULT NOW(),
  desabonne_le       TIMESTAMP
);

-- Recherche par statut (export de la liste active) et par token (désinscription).
CREATE INDEX IF NOT EXISTS idx_newsletter_statut ON newsletter_abonnes (statut);
CREATE INDEX IF NOT EXISTS idx_newsletter_token  ON newsletter_abonnes (unsubscribe_token);

COMMIT;
