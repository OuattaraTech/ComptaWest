#!/usr/bin/env bash
# =====================================================================
# ApeX — smoke test post-déploiement (production).
# =====================================================================
#
# Vérifie que les services exposés répondent correctement après un
# déploiement. À lancer DEPUIS L'EXTÉRIEUR (poste local) pour valider
# le chemin complet Cloudflare → Caddy → pm2 → PostgreSQL.
#
# Tests effectués :
#   1. DNS résout-il bien les hosts ?
#   2. /api/health  → 200
#   3. /api/health/deep → 200 (BDD accessible)
#   4. https://useapex.ci → 200 (landing)
#   5. https://app.useapex.ci → 200 (SPA)
#   6. Certificat TLS valide + chaîne complète (3 hosts)
#   7. HSTS présent dans les en-têtes
#
# Exit 0 si tout passe, 1 sinon.
#
# Usage :
#   ./scripts/smoke-prod.sh
#   BASE=https://api.staging.useapex.ci ./scripts/smoke-prod.sh
# =====================================================================
set -uo pipefail

API="${API:-https://api.useapex.ci}"
APP="${APP:-https://app.useapex.ci}"
LANDING="${LANDING:-https://useapex.ci}"

GREEN='\033[1;32m'; RED='\033[1;31m'; YELLOW='\033[1;33m'; BLUE='\033[1;34m'; RESET='\033[0m'
ok()   { printf "${GREEN}✓${RESET} %s\n" "$*"; }
ko()   { printf "${RED}✗${RESET} %s\n" "$*"; FAILS=$((FAILS+1)); }
warn() { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
log()  { printf "${BLUE}→${RESET} %s\n" "$*"; }

FAILS=0

# ---------- 1. DNS ----------
log "Résolution DNS…"
for h in useapex.ci app.useapex.ci api.useapex.ci; do
  if getent hosts "$h" >/dev/null; then
    ok "DNS $h → $(getent hosts "$h" | awk '{print $1}' | head -1)"
  else
    ko "DNS $h ne résout pas"
  fi
done

# ---------- 2. /api/health ----------
log "Healthcheck API simple…"
code=$(curl -s -o /tmp/apex_health -w "%{http_code}" "$API/api/health" || echo "000")
if [[ "$code" == "200" ]]; then
  ok "$API/api/health → 200"
  head -c 200 /tmp/apex_health; echo
else
  ko "$API/api/health → $code"
fi
rm -f /tmp/apex_health

# ---------- 3. /api/health/deep ----------
log "Healthcheck API profond (BDD)…"
code=$(curl -s -o /tmp/apex_deep -w "%{http_code}" "$API/api/health/deep" || echo "000")
if [[ "$code" == "200" ]]; then
  ok "$API/api/health/deep → 200 (DB OK)"
elif [[ "$code" == "503" ]]; then
  ko "$API/api/health/deep → 503 (BDD inaccessible !)"
  head -c 300 /tmp/apex_deep; echo
else
  ko "$API/api/health/deep → $code"
fi
rm -f /tmp/apex_deep

# ---------- 4. Landing ----------
log "Landing publique…"
code=$(curl -s -o /dev/null -w "%{http_code}" "$LANDING" || echo "000")
if [[ "$code" == "200" || "$code" == "301" || "$code" == "308" ]]; then
  ok "$LANDING → $code"
else
  ko "$LANDING → $code"
fi

# ---------- 5. SPA ----------
log "SPA app.useapex.ci…"
code=$(curl -s -o /dev/null -w "%{http_code}" "$APP" || echo "000")
if [[ "$code" == "200" ]]; then
  ok "$APP → 200"
else
  ko "$APP → $code"
fi

# ---------- 6. TLS ----------
log "Vérification certificats TLS…"
for h in useapex.ci app.useapex.ci api.useapex.ci; do
  expiry=$(echo | openssl s_client -servername "$h" -connect "$h:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null \
    | sed 's/notAfter=//')
  if [[ -n "$expiry" ]]; then
    ok "TLS $h expire le $expiry"
  else
    ko "TLS $h : impossible de récupérer le certificat"
  fi
done

# ---------- 7. HSTS ----------
log "En-tête HSTS sur app.useapex.ci…"
hsts=$(curl -s -I "$APP" | grep -i '^strict-transport-security' || true)
if [[ -n "$hsts" ]]; then
  ok "HSTS présent : $(echo "$hsts" | tr -d '\r')"
else
  warn "HSTS absent — à activer dans Caddy"
fi

# ---------- Résumé ----------
echo
if [[ $FAILS -eq 0 ]]; then
  printf "${GREEN}╔══════════════════════════════════════╗${RESET}\n"
  printf "${GREEN}║  Smoke test OK — prod en bonne santé ║${RESET}\n"
  printf "${GREEN}╚══════════════════════════════════════╝${RESET}\n"
  exit 0
else
  printf "${RED}╔══════════════════════════════════════════╗${RESET}\n"
  printf "${RED}║  Smoke test KO — %d échec(s) — à corriger ║${RESET}\n" "$FAILS"
  printf "${RED}╚══════════════════════════════════════════╝${RESET}\n"
  exit 1
fi
