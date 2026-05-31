/**
 * Synchronisation des abonnés newsletter vers une Audience Resend.
 *
 * Permet d'envoyer ensuite les campagnes (newsletters) directement depuis
 * Resend → Broadcasts, avec gestion automatique du lien de désinscription.
 *
 * Variables d'env :
 *   RESEND_AUDIENCE_API_KEY — clé Resend « Full access » pour gérer les
 *                          contacts de l'audience. La clé d'envoi
 *                          transactionnel (RESEND_API_KEY) est souvent
 *                          restreinte à « send emails » et ne peut PAS
 *                          gérer les audiences → on utilise une clé dédiée.
 *                          À défaut, on retombe sur RESEND_API_KEY (qui doit
 *                          alors être en Full access).
 *   RESEND_AUDIENCE_ID   — ID de l'audience « ApeX Newsletter »
 *                          (Resend → Audience → bouton </> → audienceId)
 *
 * Toutes les fonctions sont « fire-and-forget » : elles ne throw JAMAIS et
 * sont des no-op si les clés ne sont pas configurées (dev, ou audience non
 * créée). La source de vérité reste notre table `newsletter_abonnes` ;
 * Resend n'est qu'un miroir pour l'envoi des campagnes.
 */
'use strict';

const RESEND_BASE = 'https://api.resend.com';

// Clé dédiée à la gestion d'audience (Full access), sinon repli sur la clé
// d'envoi — qui doit alors elle-même avoir le Full access.
function audienceKey() {
  return process.env.RESEND_AUDIENCE_API_KEY || process.env.RESEND_API_KEY;
}

function actif() {
  return Boolean(audienceKey() && process.env.RESEND_AUDIENCE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${audienceKey()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Ajoute (ou réactive) un contact dans l'audience. Upsert : si le contact
 * existe déjà, on bascule simplement unsubscribed=false via PATCH.
 */
async function ajouterContact({ email, prenom = '' }) {
  if (!actif() || !email) return;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  try {
    const r = await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, first_name: prenom || undefined, unsubscribed: false }),
    });
    if (!r.ok) {
      // Contact déjà présent (ou autre) → on tente une mise à jour pour
      // garantir unsubscribed=false (cas d'un réabonnement).
      await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ unsubscribed: false }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[resendAudience][ajouter]', err.message);
  }
}

/**
 * Marque le contact comme désabonné dans l'audience (sans le supprimer,
 * pour respecter l'opt-out). No-op si le contact n'existe pas.
 */
async function desabonnerContact(email) {
  if (!actif() || !email) return;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  try {
    await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ unsubscribed: true }),
    });
  } catch (err) {
    console.error('[resendAudience][desabonner]', err.message);
  }
}

module.exports = { ajouterContact, desabonnerContact };
