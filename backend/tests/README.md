# Tests ApeX — Backend

## Lancer les tests

**Prérequis** : le serveur backend doit tourner en `NODE_ENV=test` pour
désactiver le rate-limiter sur les endpoints d'authentification (sinon
les tests sont bloqués après 10 créations de démos).

```bash
# Terminal 1 : serveur en mode test
cd backend && npm run dev:test

# Terminal 2 : tests
cd backend && npm test
```

## Fichiers de tests

| Fichier | Couverture | Tests |
|---|---|---|
| `tva.test.js` | Calculs TVA, arrondis, multi-taux, symétrie HT↔TTC | 22 |
| `paie-ci.test.js` | Calculs paie CI (CNPS, ITS, parts, IS) | 14 |
| `amortissements.test.js` | Amortissements linéaires et dégressifs | 11 |
| `security-isolation.test.js` | Multi-tenant strict (cross-entreprise refusé) | 15 |
| `idempotency.test.js` | Anti double-clic (Idempotency-Key) | 7 |
| `audit-trail.test.js` | Traçabilité + immutabilité du log | 7 |
| `equilibre-comptable.test.js` | Partie double SYSCOHADA (D=C forcé) | 9 |
| `dsf-coherence.test.js` | Cohérence liasse fiscale + PDF + diagnostic | 8 |
| **TOTAL** | | **93** |

## Recommandations

Les tests d'intégration partagent un même serveur backend et une BDD
PostgreSQL. **Préférer l'exécution par fichier** pour éviter les
interférences (variables globales partagées, accumulation de comptes
démos) :

```bash
node --test tests/tva.test.js          # 22/22 ✓
node --test tests/equilibre-comptable.test.js  # 9/9 ✓
node --test tests/security-isolation.test.js   # 15/15 ✓
# etc.
```

En exécution suite complète (`npm test`), il peut subsister des
échecs liés à la concurrence (accumulation de comptes démos sur la
même IP, état partagé entre suites). Ces tests passent individuellement
et l'absence d'échec en CI sera assurée par un setup `beforeEach` plus
strict en V2.
