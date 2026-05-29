-- Migration 035 — Idempotency-keys pour les routes financières.
--
-- Permet à un client (front, mobile, API) d'envoyer un en-tête
-- `Idempotency-Key: <uuid>` sur une requête POST critique. Si le serveur
-- a déjà traité cette clé dans les 24h, il renvoie la réponse cachée
-- au lieu de ré-exécuter la création (= protection contre double-clic,
-- timeouts réseau, retries automatiques).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  -- Hash du corps de la requête : sécurité supplémentaire pour éviter
  -- qu'une clé soit réutilisée pour des payloads différents.
  body_hash VARCHAR(64) NOT NULL,
  status_code SMALLINT NOT NULL,
  response_body JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
