-- Migration 037 — Table `app_parametres` (clé-valeur global app).
--
-- Centralise les paramètres applicatifs globaux (non liés à une
-- entreprise) qui peuvent évoluer sans redéploiement : URL canonique,
-- email de support, mentions légales, libellé marketing, etc.
--
-- Les variables d'env (FRONTEND_URL, EMAIL_FROM…) restent la source
-- de vérité pour les composants techniques (CORS, SMTP). Cette table
-- sert pour ce qui est affiché côté UI/email et doit pouvoir être
-- modifié depuis l'admin sans redémarrer le service.
--
-- Application :
--   psql -U <user> -d comptawest -f config/migrations/037_app_parametres.sql

BEGIN;

CREATE TABLE IF NOT EXISTS app_parametres (
  cle           TEXT PRIMARY KEY,
  valeur        TEXT NOT NULL,
  description   TEXT,
  modifiable_ui BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES utilisateurs(id) ON DELETE SET NULL
);

COMMENT ON TABLE app_parametres IS
  'Paramètres globaux applicatifs (URL canonique, contacts, libellés). '
  'Modifiables depuis /admin sans redéploiement. Les variables d''env '
  'restent prioritaires pour les composants techniques.';

-- Seed initial avec les valeurs du nouveau domaine useapex.ci.
-- ON CONFLICT DO NOTHING : ne pas écraser une valeur déjà ajustée
-- par l'admin si la migration est re-jouée.

INSERT INTO app_parametres (cle, valeur, description, modifiable_ui) VALUES
  ('app.url_publique',
   'https://useapex.ci',
   'URL de la landing publique (utilisée dans les emails et CTA).',
   TRUE),

  ('app.url_application',
   'https://app.useapex.ci',
   'URL de l''application connectée (liens d''invitation, retours paiement).',
   TRUE),

  ('app.url_api',
   'https://api.useapex.ci',
   'URL publique de l''API (webhooks Mobile Money, callbacks FNE).',
   TRUE),

  ('app.email_support',
   'support@useapex.ci',
   'Email de support affiché dans l''UI et le pied des emails.',
   TRUE),

  ('app.email_expediteur',
   'ApeX <noreply@useapex.ci>',
   'Adresse expéditeur affichée dans les emails transactionnels.',
   TRUE),

  ('app.email_reply_to',
   'support@useapex.ci',
   'Adresse Reply-To des emails transactionnels.',
   TRUE),

  ('app.email_cabinet',
   'cabinet@useapex.ci',
   'Email de contact dédié aux cabinets ONECCA partenaires.',
   TRUE),

  ('app.email_fne',
   'dgi@useapex.ci',
   'Email lié à la certification FNE / échanges DGI.',
   TRUE),

  ('app.numero_whatsapp_support',
   '',
   'Numéro WhatsApp affiché sur la landing et dans les emails (format +225XXXXXXXX, vide = caché).',
   TRUE),

  ('app.nom_commercial',
   'ApeX',
   'Nom commercial affiché dans l''UI, les emails et les exports.',
   FALSE),

  ('app.baseline',
   'La comptabilité SYSCOHADA simple et conforme pour les PME ivoiriennes.',
   'Baseline marketing utilisée sur la landing et dans les signatures email.',
   TRUE),

  ('app.url_status',
   'https://status.useapex.ci',
   'URL de la page de statut (UptimeRobot ou équivalent).',
   TRUE),

  ('app.url_docs',
   'https://docs.useapex.ci',
   'URL du centre d''aide / documentation utilisateur.',
   TRUE)
ON CONFLICT (cle) DO NOTHING;

-- Trigger updated_at automatique pour tracer les modifications admin.
CREATE OR REPLACE FUNCTION app_parametres_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_parametres_updated_at ON app_parametres;
CREATE TRIGGER trg_app_parametres_updated_at
  BEFORE UPDATE ON app_parametres
  FOR EACH ROW
  EXECUTE FUNCTION app_parametres_touch_updated_at();

COMMIT;
