#!/bin/sh
# Deploys the production Worker to the private domain kept in the git-ignored .env.deploy.
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env.deploy ]; then
  echo "Missing apps/api/.env.deploy. Copy .env.deploy.example and set PRODUCTION_DOMAIN." >&2
  exit 1
fi
. ./.env.deploy
: "${PRODUCTION_DOMAIN:?Set PRODUCTION_DOMAIN in apps/api/.env.deploy}"
exec pnpm exec wrangler deploy --env production \
  --domain "$PRODUCTION_DOMAIN" \
  --var "CORS_ORIGIN:https://$PRODUCTION_DOMAIN" \
  --var "OPENROUTER_SITE_URL:https://$PRODUCTION_DOMAIN" \
  "$@"
