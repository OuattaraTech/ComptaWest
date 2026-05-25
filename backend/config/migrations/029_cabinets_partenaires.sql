-- ============================================================================
-- MIGRATION 029 : programme Partenaires Cabinets Comptables
-- ============================================================================
-- Crée l'infrastructure pour le partenariat avec les cabinets d'experts-
-- comptables (ONECCA Côte d'Ivoire) :
--
--   1. Distinction PME / Cabinet sur l'entité entreprise
--   2. Code parrain unique par cabinet pour traçabilité acquisition
--   3. Lien parrainage : PME apportée → quel cabinet, quelle remise appliquée
--   4. Table cabinet_invitations : invitations email envoyées par les cabinets
--   5. Table cabinet_connections : accès actifs cabinet ↔ PME
--   6. Super-admin global (toi) pour la console KPIs admin
--
-- Modèle économique :
--   - Cabinet : licence à vie GRATUITE (entreprises.type_compte = 'cabinet_partenaire')
--   - PME apportée par cabinet : -15 % la 1ère année (remise_parrainage_pct)
--   - Aucune commission cash au cabinet (avantages en nature : badge, support 4h)
--
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/029_cabinets_partenaires.sql
-- ============================================================================

BEGIN;

-- 0) Étendre la contrainte CHECK sur abonnements.palier pour autoriser
--    le nouveau palier 'cabinet_partenaire' (licence gratuite)
ALTER TABLE abonnements DROP CONSTRAINT IF EXISTS abonnements_palier_check;
ALTER TABLE abonnements ADD CONSTRAINT abonnements_palier_check
  CHECK (palier IN ('decouverte', 'starter', 'pro', 'cabinet', 'cabinet_partenaire'));

-- 1) Super-admin global (pour ta console KPIs admin)
-- Un seul SUPER_ADMIN est attendu en prod (toi). Vérifié dans le middleware.
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN utilisateurs.is_super_admin IS
  'TRUE pour le compte du fondateur ApeX. Donne accès à /admin (KPIs MRR, '
  'leaderboard cabinets, statistiques d''acquisition). À activer manuellement '
  'via UPDATE utilisateurs SET is_super_admin=TRUE WHERE email=''toi@apex.ci''.';

-- 2) Type de compte sur entreprises (PME standard ou Cabinet partenaire)
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS type_compte VARCHAR(30) NOT NULL DEFAULT 'pme',
  ADD CONSTRAINT entreprises_type_compte_check
    CHECK (type_compte IN ('pme', 'cabinet_partenaire'));

COMMENT ON COLUMN entreprises.type_compte IS
  'pme : entreprise classique soumise à abonnement payant. '
  'cabinet_partenaire : cabinet d''expert-comptable bénéficiant de la licence '
  'gratuite à vie (en échange de l''apport de PME clientes).';

-- 3) Code parrain unique pour les cabinets (généré à l'activation)
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS code_parrain VARCHAR(20) UNIQUE;

COMMENT ON COLUMN entreprises.code_parrain IS
  'Code unique du cabinet partenaire (ex : CAB-A3F9B2). Génère l''URL '
  'd''invitation https://apex.ci/r/CAB-A3F9B2 traçable pour les PME apportées.';

-- 4) Lien parrainage : PME → cabinet qui l'a apportée
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS parrainee_par_cabinet_id UUID REFERENCES entreprises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remise_parrainage_pct INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN entreprises.parrainee_par_cabinet_id IS
  'Si cette PME a été invitée par un cabinet partenaire, ID dudit cabinet. '
  'Sert au leaderboard admin + au calcul de remise pendant 12 mois.';
COMMENT ON COLUMN entreprises.remise_parrainage_pct IS
  'Pourcentage de remise sur l''abonnement (généralement 15 pendant la 1ère '
  'année si parrainée). 0 = pas de remise (compte direct ou hors période).';

-- 5) Table des invitations envoyées par les cabinets (parcours onboarding PME)
-- Une invitation = un email + token unique d'activation. Statuts :
--   pending  : envoyée, PME pas encore inscrite
--   accepted : PME inscrite, compte créé (connection également active)
--   expired  : token expiré (30 jours sans clic)
--   revoked  : cabinet a annulé l'invitation avant acceptation
CREATE TABLE IF NOT EXISTS cabinet_invitations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabinet_id            UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  email_pme             VARCHAR(255) NOT NULL,
  nom_pme               VARCHAR(150),
  telephone_pme         VARCHAR(30),
  token                 VARCHAR(64) NOT NULL UNIQUE,
  statut                VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending', 'accepted', 'expired', 'revoked')),
  remise_proposee_pct   INTEGER NOT NULL DEFAULT 15,
  expires_at            TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  relance_envoyee_at    TIMESTAMP,                -- horodatage relance J+2
  acceptee_at           TIMESTAMP,
  acceptee_par          UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_par              UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinet_invitations_cabinet ON cabinet_invitations(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_cabinet_invitations_token ON cabinet_invitations(token) WHERE statut = 'pending';
CREATE INDEX IF NOT EXISTS idx_cabinet_invitations_relance
  ON cabinet_invitations(created_at)
  WHERE statut = 'pending' AND relance_envoyee_at IS NULL;

COMMENT ON TABLE cabinet_invitations IS
  'Invitations envoyées par les cabinets partenaires aux PME prospectes. '
  'Chaque invitation a un token unique pour le lien /rejoindre/:token. '
  'Cron de relance J+2 sur les pending sans relance_envoyee_at.';

-- 6) Table des connexions actives cabinet ↔ PME
-- Une connexion = autorisation du cabinet à accéder au compte de la PME.
-- Créée automatiquement à l'acceptation d'une invitation, ou manuellement
-- par la PME qui invite son comptable.
CREATE TABLE IF NOT EXISTS cabinet_connections (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabinet_id            UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  pme_id                UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  statut                VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (statut IN ('active', 'paused', 'revoked')),
  role_dans_pme         VARCHAR(30) NOT NULL DEFAULT 'comptable',
  invitation_id         UUID REFERENCES cabinet_invitations(id) ON DELETE SET NULL,
  cree_par_cabinet      BOOLEAN NOT NULL DEFAULT TRUE,
  active_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Un cabinet ne peut être lié qu'une seule fois à une PME donnée
  CONSTRAINT unique_cabinet_pme UNIQUE (cabinet_id, pme_id)
);

CREATE INDEX IF NOT EXISTS idx_cabinet_connections_cabinet ON cabinet_connections(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_cabinet_connections_pme ON cabinet_connections(pme_id, statut);

COMMENT ON TABLE cabinet_connections IS
  'Liens actifs cabinet ↔ PME : autorisations d''accès du cabinet aux données '
  'de la PME. Le role_dans_pme (par défaut « comptable ») détermine les '
  'permissions appliquées via la matrice rôles existante.';

COMMIT;
