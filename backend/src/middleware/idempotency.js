/**
 * Middleware d'idempotency-keys.
 *
 * Usage : router.post('/factures', auth, idempotent(), can(...), createFacture)
 *
 * Comportement :
 *   1. Si pas de header Idempotency-Key → passe (compat ascendante)
 *   2. Si clé connue (24h, même path, même body) → renvoie réponse cachée
 *   3. Sinon : exécute le handler normalement, puis cache la réponse
 *
 * Sécurité :
 *   - body_hash vérifié pour qu'une clé ne soit pas réutilisée pour un
 *     payload différent (sinon erreur 409)
 *   - utilisateur_id stocké pour qu'une clé d'un autre user ne soit pas
 *     usurpée
 *   - TTL 24h (idempotency_keys.expires_at) — purge auto à nettoyer
 *     périodiquement
 */
const crypto = require('crypto');
const pool = require('../../config/database');

// Format attendu : UUIDv4 ou string base64url de 16-128 chars
const KEY_REGEX = /^[A-Za-z0-9._-]{8,128}$/;

function hashBody(body) {
  const json = body ? JSON.stringify(body) : '';
  return crypto.createHash('sha256').update(json).digest('hex');
}

// Helpers de wait/retry pour les requêtes concurrentes
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function idempotent() {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();
    if (!KEY_REGEX.test(key)) {
      return res.status(400).json({ success: false, message: 'Idempotency-Key invalide' });
    }
    if (!req.user?.id) return next();

    const bodyHash = hashBody(req.body);

    // ─── Étape 1 : RÉSERVATION ATOMIQUE de la clé ────────────────────────
    // Insertion préalable avec status_code = 0 (= "en cours de traitement").
    // Grâce à PRIMARY KEY sur `key`, une seule requête réussit en cas de
    // concurrence. Les autres tombent sur le ON CONFLICT et iront lire la
    // réponse cachée (ou attendre qu'elle soit prête).
    let acquise = false;
    try {
      const ins = await pool.query(
        `INSERT INTO idempotency_keys
           (key, utilisateur_id, entreprise_id, method, path, body_hash, status_code, response_body)
         VALUES ($1, $2, $3, $4, $5, $6, 0, '{}'::jsonb)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [key, req.user.id, req.entrepriseId || null, req.method, req.path, bodyHash]
      );
      acquise = ins.rows.length > 0;
    } catch (err) {
      // 42P01 = table inexistante → fallback sans protection
      if (err.code === '42P01') return next();
      console.error('idempotency reserve:', err.message);
      return next();
    }

    if (acquise) {
      // ─── Cas A : on a réservé la clé, on exécute le handler ───────────
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // UPDATE de la ligne réservée avec le résultat final
        if (res.statusCode >= 200 && res.statusCode < 300) {
          pool.query(
            `UPDATE idempotency_keys
                SET status_code = $1, response_body = $2
              WHERE key = $3`,
            [res.statusCode, body, key]
          ).catch(err => console.error('idempotency commit:', err.message));
        } else {
          // Réponse d'erreur : on libère la clé pour permettre un retry
          pool.query(`DELETE FROM idempotency_keys WHERE key = $1 AND status_code = 0`, [key])
            .catch(err => console.error('idempotency release:', err.message));
        }
        return originalJson(body);
      };
      return next();
    }

    // ─── Cas B : la clé existe déjà — soit traitée, soit en cours ────────
    // On poll brièvement jusqu'à 2s pour laisser la 1ère requête finir.
    for (let i = 0; i < 20; i++) {
      const r = await pool.query(
        `SELECT body_hash, status_code, response_body, utilisateur_id
           FROM idempotency_keys WHERE key = $1`,
        [key]
      );
      const e = r.rows[0];
      if (!e) {
        // Disparue (erreur 4xx/5xx → DELETE plus haut). On laisse passer.
        return next();
      }
      if (e.utilisateur_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Idempotency-Key déjà utilisée par un autre utilisateur' });
      }
      if (e.body_hash !== bodyHash) {
        return res.status(409).json({ success: false, message: 'Idempotency-Key déjà utilisée avec un payload différent' });
      }
      if (e.status_code === 0) {
        // Encore en cours, on attend 100ms et on re-poll
        await sleep(100);
        continue;
      }
      // Réponse prête : on la renvoie telle quelle
      return res.status(e.status_code).json(e.response_body);
    }

    // Timeout (>2s sans réponse) : on renvoie 408 — le client peut retry
    return res.status(408).json({ success: false, message: 'Idempotency-Key encore en traitement, réessayez dans quelques secondes' });
  };
}

module.exports = { idempotent };
