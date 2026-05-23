/**
 * Capture automatique des 10 écrans ApeX pour le motion design Remotion.
 *
 * Prérequis :
 *   - Backend ApeX sur http://localhost:5000
 *   - Frontend ApeX sur http://localhost:5173
 *   - npm install (Puppeteer télécharge ~150 Mo de Chromium)
 *
 * Usage :
 *   cd marketing/scripts
 *   npm install
 *   npm run capture
 *
 * Les PNG sortent dans ../remotion-apex/public/ avec les noms attendus
 * par le projet Remotion (01-dashboard.png, etc.).
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL  = 'http://localhost:5000';
const OUTPUT_DIR   = path.resolve(__dirname, '../remotion-apex/public');
const WIDTH = 1920;
const HEIGHT = 1080;

// Délais conservateurs pour s'assurer que tout est rendu / animations terminées
const WAIT_AFTER_NAV = 2500;
const WAIT_AFTER_CLICK = 1500;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 1. Crée un compte démo isolé via l'API REST (rapide, pas besoin de
 *    cliquer dans l'UI).
 * 2. Retourne le JWT pour qu'on puisse le mettre dans localStorage avant
 *    de naviguer vers les pages protégées.
 */
async function creerCompteDemo() {
  const res = await fetch(`${BACKEND_URL}/api/auth/demo`, { method: 'POST' });
  const json = await res.json();
  if (!json.success) throw new Error('Echec creation demo : ' + JSON.stringify(json));
  console.log(`✓ Compte démo créé : ${json.data.user.email}`);
  return json.data.token;
}

async function main() {
  console.log('🎬 Capture des 10 écrans ApeX pour Remotion');
  console.log(`   Frontend : ${FRONTEND_URL}`);
  console.log(`   Backend  : ${BACKEND_URL}`);
  console.log(`   Sortie   : ${OUTPUT_DIR}`);
  console.log('');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // ── 1. Compte démo via API ───────────────────────────────────────────
  const token = await creerCompteDemo();

  // ── 2. Lancement Chromium en taille desktop ──────────────────────────
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();

  // Injection du JWT + skip onboarding sur TOUTES les pages
  // (les modales d'onboarding bloqueraient sinon chaque capture)
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok) => {
    localStorage.setItem('cw_token', tok);
    // Marque l'onboarding comme « vu » pour toutes les pages (v2 = version actuelle)
    const pages = [
      'dashboard', 'factures', 'devis', 'clients', 'depenses', 'tresorerie',
      'paie', 'comptabilite', 'immobilisations', 'taxes', 'produits',
      'fournisseurs', 'parametres', 'audit-log', 'rapports',
    ];
    for (const p of pages) {
      localStorage.setItem(`cw_onboarding_${p}_v2_seen`, '1');
    }
  }, token);
  console.log('✓ Token + flags onboarding injectés');

  // ── 3. Liste des captures à prendre ──────────────────────────────────
  // Format : { fichier, url, click? (sélecteur), description }
  const captures = [
    {
      fichier: '01-dashboard.png',
      url: '/dashboard',
      description: 'Vue d\'ensemble + KPIs',
    },
    {
      fichier: '02-factures-liste.png',
      url: '/factures',
      description: 'Liste des factures avec statuts variés',
    },
    {
      fichier: '03-facture-modale.png',
      url: '/factures',
      // Tente d'ouvrir la modale « Nouvelle facture »
      click: 'button:has-text("Nouvelle facture"), button:has-text("Créer")',
      description: 'Modale création facture (formulaire vide)',
    },
    // 04-facture-pdf : capturé séparément via API + pdftoppm (PDF natif)
    {
      fichier: '05-paie-liste.png',
      url: '/paie',
      description: 'Liste des bulletins de paie',
    },
    // 06-paie-bulletin : capturé séparément (cliquer sur un bulletin)
    {
      fichier: '07-tresorerie.png',
      url: '/tresorerie',
      description: 'Comptes de trésorerie',
    },
    {
      fichier: '08-mobile-money.png',
      url: '/parametres?tab=integrations',
      description: 'Onglet Intégrations (Wave/Orange/MTN)',
    },
    {
      fichier: '09-comptabilite.png',
      url: '/comptabilite',
      description: 'Grand Livre / écritures',
    },
    {
      fichier: '10-fne-wizard.png',
      url: '/parametres?tab=fiscal',
      description: 'Wizard FNE 6 étapes',
    },
  ];

  // ── 4. Boot initial : aller au dashboard et attendre que tout charge ─
  // On NE peut PAS faire page.goto() pour chaque page : ça reset le React
  // state et l'app redirige vers paramètres par défaut. Solution : cliquer
  // dans la sidebar comme un humain.
  console.log('⏳ Boot initial du dashboard...');
  await page.goto(FRONTEND_URL + '/dashboard', { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(4000); // Laisser tout charger : Sidebar, KPIs, graphiques

  // ── 5. Boucle de capture via NAVIGATION SIDEBAR ──────────────────────
  for (const c of captures) {
    console.log(`📸 ${c.fichier} ← ${c.url}`);
    try {
      // Pour les URL avec ?tab=... : navigation directe (l'app ne reset pas)
      // Pour les URL simples : clic sur le lien sidebar (NavLink)
      const cleanPath = c.url.split('?')[0];

      if (c.url.includes('?')) {
        // Tabs : on peut naviguer par URL
        await page.evaluate((href) => {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, c.url);
      } else {
        // Clic sur le NavLink correspondant dans la sidebar
        await page.evaluate((target) => {
          const links = [...document.querySelectorAll('a[href]')];
          const lien = links.find(a => a.getAttribute('href') === target);
          if (lien) lien.click();
        }, cleanPath);
      }
      await delay(WAIT_AFTER_NAV);
    } catch (err) {
      console.log(`   ⚠ Navigation échouée : ${err.message}`);
    }

    if (c.click) {
      try {
        await page.evaluate(() => {
          const candidats = [
            ...document.querySelectorAll('button'),
          ].filter(b => /nouvelle facture|nouveau|créer|ajouter/i.test(b.textContent || ''));
          if (candidats[0]) candidats[0].click();
        });
        await delay(WAIT_AFTER_CLICK);
      } catch (err) {
        console.log(`   ⚠ Click bouton échoué`);
      }
    }

    const outputPath = path.join(OUTPUT_DIR, c.fichier);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`   ✓ ${(fs.statSync(outputPath).size / 1024).toFixed(0)} KB`);
  }

  // ── 6. Capture spéciale : modale « Nouvelle facture » ────────────────
  console.log(`📸 03-facture-modale.png (modale ouverte)`);
  await page.evaluate(() => {
    const lien = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === '/factures');
    if (lien) lien.click();
  });
  await delay(WAIT_AFTER_NAV);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
      .filter(b => /nouvelle facture|\+ facture|créer une facture|nouveau/i.test(b.textContent));
    if (btns[0]) btns[0].click();
  });
  await delay(WAIT_AFTER_CLICK);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03-facture-modale.png') });
  console.log(`   ✓ modale capturée`);

  // ── 7. Capture spéciale : bulletin de paie ouvert ────────────────────
  console.log(`📸 06-paie-bulletin.png (bulletin ouvert)`);
  await page.evaluate(() => {
    const lien = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === '/paie');
    if (lien) lien.click();
  });
  await delay(WAIT_AFTER_NAV + 500);
  // Clique sur le 1er bouton « œil/voir/détail » d'une ligne bulletin
  try {
    await page.evaluate(() => {
      // Cherche un bouton dans une ligne de tableau
      const ligne = document.querySelector('tbody tr');
      if (ligne) {
        const btn = ligne.querySelector('button');
        if (btn) btn.click();
        else ligne.click();
      }
    });
    await delay(WAIT_AFTER_CLICK);
  } catch (err) {
    console.log(`   ⚠ Click bulletin échoué`);
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06-paie-bulletin.png') });
  console.log(`   ✓ bulletin capturé`);

  await browser.close();

  // ── 7. Capture PDF facture : via API + pdftoppm ──────────────────────
  console.log(`📸 04-facture-pdf.png (PDF facture certifiée FNE)`);
  try {
    // Récupère la 1ère facture de l'entreprise démo
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const me = (await meRes.json()).data;

    // Récupère l'entreprise courante
    const entRes = await fetch(`${BACKEND_URL}/api/entreprises/me`, { headers: { Authorization: `Bearer ${token}` } });
    const entreprise = (await entRes.json()).data;
    const eid = entreprise?.id || entreprise?.[0]?.id;

    if (eid) {
      const factRes = await fetch(`${BACKEND_URL}/api/factures?limit=1`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Entreprise-Id': eid },
      });
      const fact = ((await factRes.json()).data || [])[0];

      if (fact) {
        const pdfRes = await fetch(`${BACKEND_URL}/api/rapports/facture/${fact.id}/pdf`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Entreprise-Id': eid },
        });
        const buffer = Buffer.from(await pdfRes.arrayBuffer());
        const pdfTmp = '/tmp/apex-facture.pdf';
        fs.writeFileSync(pdfTmp, buffer);
        execSync(`pdftoppm -png -r 150 -f 1 -l 1 "${pdfTmp}" /tmp/apex-facture-img`);
        execSync(`convert /tmp/apex-facture-img-1.png -resize 1920x1080^ -gravity center -extent 1920x1080 "${path.join(OUTPUT_DIR, '04-facture-pdf.png')}"`);
        console.log(`   ✓ PDF capturé via pdftoppm + convert`);
      } else {
        console.log(`   ⚠ Aucune facture trouvée, placeholder conservé`);
      }
    }
  } catch (err) {
    console.log(`   ⚠ Capture PDF échouée : ${err.message} (placeholder conservé)`);
  }

  console.log('');
  console.log('🎉 Captures terminées !');
  console.log(`   Vérifie le résultat : ls -la ${OUTPUT_DIR}/`);
  console.log('   Relance Remotion Studio : cd ../remotion-apex && npm start');
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
