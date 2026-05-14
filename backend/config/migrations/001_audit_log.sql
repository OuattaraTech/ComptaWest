-- ============================================
-- Migration 001 : Audit log
-- Trace des actions sensibles (qui / quoi / quand / avant / après)
-- À exécuter sur les bases existantes :
--   psql -U <user> -d comptawest -f config/migrations/001_audit_log.sql
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  utilisateur_email VARCHAR(150),  -- conservé même si l'utilisateur est supprimé
  action VARCHAR(40) NOT NULL,     -- CREATE, UPDATE, DELETE, LOGIN_OK, LOGIN_FAIL, PAY, INVITE, REVOKE, ROLE_CHANGE...
  entite VARCHAR(40) NOT NULL,     -- factures, depenses, taxes, clients, membres, auth...
  entite_id UUID,                  -- nullable (ex : LOGIN_FAIL)
  details JSONB,                   -- payload libre : { avant, apres } ou métadonnées
  ip VARCHAR(45),                  -- IPv4/IPv6
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entreprise ON audit_log(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_audit_utilisateur ON audit_log(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_audit_entite ON audit_log(entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
