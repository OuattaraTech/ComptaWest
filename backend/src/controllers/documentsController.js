/**
 * Collecte de documents cabinet ↔ PME (GED légère, migration 042).
 *
 * Côté CABINET (entreprise courante = cabinet partenaire connecté à la PME) :
 *   - demander des pièces, suivre le statut, valider/refuser, relancer par email
 * Côté PME (entreprise courante = la PME) :
 *   - voir les demandes de son cabinet, téléverser les fichiers
 *
 * Stockage : fichiers sur disque sous UPLOADS_DIR (configurable), seules les
 * métadonnées sont en base. Téléchargement via endpoint authentifié (jamais
 * de fichier servi en statique → contrôle d'accès cabinet/PME).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { body } = require('express-validator');
const pool = require('../../config/database');
const { logAudit } = require('../utils/audit');
const { envoyerEmail } = require('../utils/email');
const { relanceDocuments } = require('../utils/emailTemplates');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

const MIMES_OK = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const estCabinet = (req) => req.entreprise?.type_compte === 'cabinet_partenaire';

async function connexionActive(cabinetId, pmeId) {
  const r = await pool.query(
    `SELECT 1 FROM cabinet_connections
      WHERE cabinet_id = $1 AND pme_id = $2 AND statut = 'active'`,
    [cabinetId, pmeId]
  );
  return r.rowCount > 0;
}

function sanitizeNom(nom) {
  return (nom || 'fichier').replace(/[^\w.\-]+/g, '_').slice(0, 120);
}

// ─── Multer (disque) ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const pmeId = req.entrepriseId;
    const dir = path.join(UPLOADS_DIR, String(pmeId));
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomBytes(8).toString('hex')}-${sanitizeNom(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIMES_OK.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Type de fichier non autorisé'));
  },
}).single('fichier');

// ═══════════════════════ CÔTÉ CABINET ════════════════════════════════════════

const demandeRules = [
  body('libelle').trim().notEmpty().withMessage('Libellé requis').isLength({ max: 200 }),
  body('categorie').optional().isIn(['banque', 'facture', 'contrat', 'fiscal', 'social', 'autre']),
  body('periode').optional({ checkFalsy: true }).isLength({ max: 20 }),
  body('note').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];

// GET /api/cabinets/clients/:pmeId/documents
const listePourCabinet = async (req, res) => {
  try {
    if (!estCabinet(req)) return res.status(403).json({ success: false, message: 'Réservé aux cabinets partenaires.' });
    const { pmeId } = req.params;
    if (!(await connexionActive(req.entrepriseId, pmeId))) {
      return res.status(403).json({ success: false, message: 'PME non connectée à votre cabinet.' });
    }
    const r = await pool.query(
      `SELECT dr.*,
              COALESCE(json_agg(json_build_object(
                'id', df.id, 'nom_fichier', df.nom_fichier, 'mime', df.mime,
                'taille_octets', df.taille_octets, 'created_at', df.created_at
              ) ORDER BY df.created_at) FILTER (WHERE df.id IS NOT NULL), '[]') AS fichiers
         FROM document_requests dr
         LEFT JOIN document_files df ON df.request_id = dr.id
        WHERE dr.cabinet_id = $1 AND dr.pme_id = $2
        GROUP BY dr.id
        ORDER BY dr.created_at DESC`,
      [req.entrepriseId, pmeId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('[documents][listeCabinet]', err.message);
    res.status(500).json({ success: false, message: 'Erreur de chargement.' });
  }
};

// POST /api/cabinets/clients/:pmeId/documents
const creerDemande = async (req, res) => {
  try {
    if (!estCabinet(req)) return res.status(403).json({ success: false, message: 'Réservé aux cabinets partenaires.' });
    const { pmeId } = req.params;
    if (!(await connexionActive(req.entrepriseId, pmeId))) {
      return res.status(403).json({ success: false, message: 'PME non connectée à votre cabinet.' });
    }
    const { libelle, categorie = 'autre', periode = null, note = null } = req.body;
    const r = await pool.query(
      `INSERT INTO document_requests (cabinet_id, pme_id, libelle, categorie, periode, note, cree_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.entrepriseId, pmeId, libelle.trim(), categorie, periode || null, note || null, req.user.id]
    );
    logAudit(req, 'DOC_REQUEST_CREATE', 'document', r.rows[0].id, { pme_id: pmeId, libelle });
    res.status(201).json({ success: true, data: { ...r.rows[0], fichiers: [] } });
  } catch (err) {
    console.error('[documents][creer]', err.message);
    res.status(500).json({ success: false, message: 'Création impossible.' });
  }
};

// PATCH /api/cabinets/documents/:id  { statut: 'valide'|'refuse'|'demande' }
const majStatut = async (req, res) => {
  try {
    if (!estCabinet(req)) return res.status(403).json({ success: false, message: 'Réservé aux cabinets partenaires.' });
    const statut = req.body.statut;
    if (!['valide', 'refuse', 'demande'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    const r = await pool.query(
      `UPDATE document_requests SET statut = $1, updated_at = NOW()
        WHERE id = $2 AND cabinet_id = $3 RETURNING id`,
      [statut, req.params.id, req.entrepriseId]
    );
    if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[documents][majStatut]', err.message);
    res.status(500).json({ success: false, message: 'Mise à jour impossible.' });
  }
};

// DELETE /api/cabinets/documents/:id
const supprimerDemande = async (req, res) => {
  try {
    if (!estCabinet(req)) return res.status(403).json({ success: false, message: 'Réservé aux cabinets partenaires.' });
    // Récupère les chemins disque avant suppression (cascade en base).
    const files = await pool.query(
      `SELECT df.chemin FROM document_files df
        JOIN document_requests dr ON dr.id = df.request_id
       WHERE dr.id = $1 AND dr.cabinet_id = $2`,
      [req.params.id, req.entrepriseId]
    );
    const r = await pool.query(
      `DELETE FROM document_requests WHERE id = $1 AND cabinet_id = $2 RETURNING id`,
      [req.params.id, req.entrepriseId]
    );
    if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    for (const f of files.rows) {
      fs.unlink(path.join(UPLOADS_DIR, f.chemin), () => {});
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[documents][supprimer]', err.message);
    res.status(500).json({ success: false, message: 'Suppression impossible.' });
  }
};

// POST /api/cabinets/clients/:pmeId/documents/relance
// Envoie un email à la PME listant les pièces encore en attente.
const relancer = async (req, res) => {
  try {
    if (!estCabinet(req)) return res.status(403).json({ success: false, message: 'Réservé aux cabinets partenaires.' });
    const { pmeId } = req.params;
    if (!(await connexionActive(req.entrepriseId, pmeId))) {
      return res.status(403).json({ success: false, message: 'PME non connectée à votre cabinet.' });
    }
    const enAttente = await pool.query(
      `SELECT libelle, periode FROM document_requests
        WHERE cabinet_id = $1 AND pme_id = $2 AND statut = 'demande'
        ORDER BY created_at`,
      [req.entrepriseId, pmeId]
    );
    if (enAttente.rowCount === 0) {
      return res.status(400).json({ success: false, message: 'Aucune pièce en attente à relancer.' });
    }

    const dest = await pool.query(
      `SELECT DISTINCT u.email, u.nom
         FROM membres_entreprise m JOIN utilisateurs u ON u.id = m.utilisateur_id
        WHERE m.entreprise_id = $1 AND m.actif = TRUE AND u.actif = TRUE
          AND COALESCE(u.is_demo, FALSE) = FALSE`,
      [pmeId]
    );
    const pmeNom = (await pool.query('SELECT nom FROM entreprises WHERE id = $1', [pmeId])).rows[0]?.nom || '';
    const cabinetNom = req.entreprise?.nom || 'Votre cabinet';
    const docs = enAttente.rows.map(d => d.periode ? `${d.libelle} (${d.periode})` : d.libelle);

    let envoyes = 0;
    for (const u of dest.rows) {
      const { subject, html, text } = relanceDocuments({ cabinet_nom: cabinetNom, pme_nom: pmeNom, nom: u.nom, documents: docs });
      envoyerEmail({ to: u.email, subject, html, text, tags: { type: 'doc_relance' } }).catch(() => {});
      envoyes++;
    }
    logAudit(req, 'DOC_REQUEST_RELANCE', 'document', pmeId, { en_attente: docs.length, destinataires: envoyes });
    res.json({ success: true, message: `Relance envoyée (${docs.length} pièce(s), ${envoyes} destinataire(s)).` });
  } catch (err) {
    console.error('[documents][relance]', err.message);
    res.status(500).json({ success: false, message: 'Relance impossible.' });
  }
};

// ═══════════════════════ CÔTÉ PME ════════════════════════════════════════════

// GET /api/documents/demandes — demandes adressées à la PME courante.
const listePourPme = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT dr.id, dr.libelle, dr.categorie, dr.periode, dr.note, dr.statut, dr.created_at,
              c.nom AS cabinet_nom,
              COALESCE(json_agg(json_build_object(
                'id', df.id, 'nom_fichier', df.nom_fichier, 'taille_octets', df.taille_octets, 'created_at', df.created_at
              ) ORDER BY df.created_at) FILTER (WHERE df.id IS NOT NULL), '[]') AS fichiers
         FROM document_requests dr
         JOIN entreprises c ON c.id = dr.cabinet_id
         LEFT JOIN document_files df ON df.request_id = dr.id
        WHERE dr.pme_id = $1
        GROUP BY dr.id, c.nom
        ORDER BY (dr.statut = 'demande') DESC, dr.created_at DESC`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('[documents][listePme]', err.message);
    res.status(500).json({ success: false, message: 'Erreur de chargement.' });
  }
};

// POST /api/documents/demandes/:id/fichier  (multipart, champ "fichier")
const televerser = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier.' });
    try {
      // La demande doit appartenir à la PME courante.
      const dr = await pool.query(
        `SELECT id, cabinet_id FROM document_requests WHERE id = $1 AND pme_id = $2`,
        [req.params.id, req.entrepriseId]
      );
      if (dr.rowCount === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ success: false, message: 'Demande introuvable.' });
      }
      const cheminRelatif = path.relative(UPLOADS_DIR, req.file.path);
      const f = await pool.query(
        `INSERT INTO document_files
           (request_id, cabinet_id, pme_id, nom_fichier, mime, taille_octets, chemin, uploaded_par)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, nom_fichier, taille_octets, created_at`,
        [req.params.id, dr.rows[0].cabinet_id, req.entrepriseId,
         req.file.originalname.slice(0, 255), req.file.mimetype, req.file.size, cheminRelatif, req.user.id]
      );
      await pool.query(`UPDATE document_requests SET statut = 'fourni', updated_at = NOW() WHERE id = $1`, [req.params.id]);
      logAudit(req, 'DOC_FILE_UPLOAD', 'document', req.params.id, { nom: req.file.originalname });
      res.status(201).json({ success: true, data: f.rows[0] });
    } catch (e) {
      if (req.file) fs.unlink(req.file.path, () => {});
      console.error('[documents][upload]', e.message);
      res.status(500).json({ success: false, message: 'Téléversement impossible.' });
    }
  });
};

// GET /api/documents/fichiers/:id — téléchargement authentifié.
// Accès : membre de la PME propriétaire OU du cabinet (connexion active).
const telecharger = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM document_files WHERE id = $1', [req.params.id]);
    const file = r.rows[0];
    if (!file) return res.status(404).json({ success: false, message: 'Fichier introuvable.' });

    const estPme = req.entrepriseId === file.pme_id;
    const estCab = req.entrepriseId === file.cabinet_id && (await connexionActive(file.cabinet_id, file.pme_id));
    if (!estPme && !estCab) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const abs = path.join(UPLOADS_DIR, file.chemin);
    if (!fs.existsSync(abs)) return res.status(404).json({ success: false, message: 'Fichier absent du stockage.' });
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.download(abs, file.nom_fichier);
  } catch (err) {
    console.error('[documents][download]', err.message);
    res.status(500).json({ success: false, message: 'Téléchargement impossible.' });
  }
};

module.exports = {
  demandeRules,
  listePourCabinet, creerDemande, majStatut, supprimerDemande, relancer,
  listePourPme, televerser, telecharger,
};
