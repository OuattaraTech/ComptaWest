-- ============================================================================
-- MIGRATION 012 : RÔLE "RH" (RESSOURCES HUMAINES)
-- ============================================================================
-- Objectif : permettre de confier la gestion de la paie (employés, bulletins,
-- rubriques) à une personne SANS lui ouvrir la comptabilité générale.
--
-- Contexte : le rôle "comptable" donne accès à tout le cycle comptable ET à la
-- paie. Or le comptable est souvent externe (cabinet) alors que la paie reste
-- gérée en interne pour des raisons de confidentialité des salaires. Le rôle
-- "rh" est additif : il ne retire rien à "comptable" (qui garde l'accès paie),
-- il ouvre un accès paie-seulement.
--
-- Côté applicatif : un middleware eaPaie autorise proprietaire/admin/comptable/rh
-- sur toutes les routes /paie/* (y compris les lectures, ce qui ferme au passage
-- l'accès en lecture qui était ouvert à tous les rôles).
-- ============================================================================

ALTER TABLE membres_entreprise DROP CONSTRAINT IF EXISTS membres_entreprise_role_check;

ALTER TABLE membres_entreprise ADD CONSTRAINT membres_entreprise_role_check
  CHECK (role IN ('proprietaire','admin','comptable','rh','user','lecture'));

COMMENT ON COLUMN membres_entreprise.role IS
  'Rôle du membre : proprietaire, admin, comptable, rh (paie uniquement), user, lecture.';
