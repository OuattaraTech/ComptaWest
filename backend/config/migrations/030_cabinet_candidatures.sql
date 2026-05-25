-- ============================================================================
-- MIGRATION 030 : table cabinet_candidatures
-- ============================================================================
-- Stocke les demandes de partenariat envoyées par les cabinets via le
-- formulaire public /partenaires-cabinets. Le super-admin les valide ensuite
-- via la console /admin (LOT 4) et active manuellement les comptes.
--
-- Pas de validation auto : on veut vérifier le numéro ONECCA et le profil
-- LinkedIn du cabinet avant d'offrir une licence gratuite à vie.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cabinet_candidatures (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom_cabinet       VARCHAR(150) NOT NULL,
  nom_responsable   VARCHAR(150) NOT NULL,
  email_pro         VARCHAR(255) NOT NULL,
  telephone         VARCHAR(30),
  numero_onecca     VARCHAR(50),
  ville             VARCHAR(100),
  nb_collaborateurs INTEGER,
  nb_clients_pme    INTEGER,
  message           TEXT,
  source            VARCHAR(50) DEFAULT 'site_web',  -- site_web / linkedin / referral / event
  statut            VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending', 'contacte', 'valide', 'refuse')),
  notes_admin       TEXT,
  ip_soumission     VARCHAR(45),
  user_agent        TEXT,
  traite_at         TIMESTAMP,
  traite_par        UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cabinet_cree_id   UUID REFERENCES entreprises(id) ON DELETE SET NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinet_candidatures_statut ON cabinet_candidatures(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_candidatures_email ON cabinet_candidatures(email_pro);

COMMENT ON TABLE cabinet_candidatures IS
  'Demandes de partenariat envoyées par les cabinets via le formulaire '
  '/partenaires-cabinets. Validation manuelle par le super-admin avant '
  'activation du compte cabinet_partenaire (licence gratuite à vie).';

COMMIT;
