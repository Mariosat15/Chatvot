#!/usr/bin/env bash
#
# check-secrets.sh — Fleet secret consistency checker
#
# WHY THIS EXISTS:
#   Admin/user sessions break silently when two servers in a fleet sign and
#   verify JWTs with DIFFERENT secret values. This happens when a stale secret
#   gets baked into PM2's saved process dump (~/.pm2/dump.pm2) and overrides the
#   value in .env (the env loader never overrides a variable that is already set,
#   so PM2's stale value wins on every restart/reboot).
#
# WHAT IT DOES:
#   Prints a safe one-way fingerprint (SHA-256 prefix — NEVER the secret itself)
#   for each shared secret, read from BOTH:
#     1. the .env file, and
#     2. the actual environment of each running PM2 process.
#
# HOW TO USE:
#   Run on EVERY server in the fleet and compare the output.
#   - For a given secret, the fingerprint MUST be identical on every server.
#   - On one server, the .env fingerprint and the process fingerprint should
#     agree (if the process shows a value at all). A mismatch means PM2 is
#     injecting a stale value that overrides .env — fix with:
#         pm2 delete <app> && pm2 start ecosystem.config.js --only <app> && pm2 save
#
# Usage: bash deploy/check-secrets.sh [/path/to/.env]
#

ENV_FILE="${1:-/var/www/chartvolt/.env}"
SECRETS="ADMIN_JWT_SECRET BETTER_AUTH_SECRET AUTH_SECRET INTERNAL_API_SECRET INTERNAL_API_KEY"
APPS="chartvolt-admin chartvolt-web chartvolt-websocket chartvolt-api chartvolt-worker"

fp() {
  # one-way fingerprint: sha256 prefix; safe to print
  printf '%s' "$1" | sha256sum | cut -c1-12
}

get_env_val() {
  # extract VALUE from a KEY=VALUE line (strips surrounding quotes)
  grep -E "^$1=" "$2" 2>/dev/null | head -n1 | cut -d= -f2- | sed 's/^"//; s/"$//'
}

echo "==================================================================="
echo " ChartVolt fleet secret check — $(hostname) — $(date -u '+%Y-%m-%d %H:%M:%SZ')"
echo "==================================================================="

echo ""
echo "[1] From .env file: $ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  for s in $SECRETS; do
    v="$(get_env_val "$s" "$ENV_FILE")"
    if [ -n "$v" ]; then
      echo "    $s  ->  sha256:$(fp "$v")"
    else
      echo "    $s  ->  (not set)"
    fi
  done
else
  echo "    !! .env not found at $ENV_FILE"
fi

echo ""
echo "[2] From running PM2 process environments:"
for app in $APPS; do
  pid="$(pm2 pid "$app" 2>/dev/null | head -n1)"
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    echo "    $app: (not running)"
    continue
  fi
  if [ ! -r "/proc/$pid/environ" ]; then
    echo "    $app (pid $pid): cannot read /proc/$pid/environ"
    continue
  fi
  echo "    $app (pid $pid):"
  for s in $SECRETS; do
    v="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -E "^$s=" | head -n1 | cut -d= -f2-)"
    if [ -n "$v" ]; then
      echo "        $s  ->  sha256:$(fp "$v")   [injected via process env]"
    else
      echo "        $s  ->  (not in process env; loaded from .env at runtime)"
    fi
  done
done

echo ""
echo "Compare fingerprints across servers. For each secret they MUST match."
echo "A secret whose process-env fingerprint differs from .env is being"
echo "overridden by a stale PM2 value — recreate that app to fix it:"
echo "  pm2 delete <app> && pm2 start ecosystem.config.js --only <app> && pm2 save"
echo "==================================================================="
