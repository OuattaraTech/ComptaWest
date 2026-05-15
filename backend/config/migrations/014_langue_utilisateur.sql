-- Préférence de langue par utilisateur (fr / en).
-- Lue/écrite via /auth/me et PUT /auth/me/langue, persistée côté frontend
-- dans localStorage pour les utilisateurs non connectés (page login).
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS langue VARCHAR(5) NOT NULL DEFAULT 'fr';
