-- Migration 036 — Immutabilité stricte de la table audit_log.
--
-- En contexte SYSCOHADA (art. 17 OHADA), les pistes d'audit doivent
-- être inviolables : aucune écriture comptable ni action sensible
-- ne doit pouvoir être modifiée ou supprimée sans laisser de trace.
-- Si quelqu'un pouvait UPDATE/DELETE audit_log, l'intégrité de la
-- piste d'audit serait nulle.
--
-- Solution : trigger SQL qui lève une exception sur toute tentative
-- de modification ou suppression. Seul INSERT est autorisé.

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log est immuable — % refusé sur la ligne %', TG_OP, OLD.id
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- Note : TRUNCATE reste possible par un superadmin PostgreSQL (utilité
-- de purge des très vieux logs avec stratégie d'archivage).
