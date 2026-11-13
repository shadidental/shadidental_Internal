#!/usr/bin/env bash
# Runs once when the Codespace is created.
set -e
npm install
if [ ! -f .env ]; then
  cat > .env <<ENV
EMAIL_TRANSPORT="log"
IT_MAILBOX="it@example.com"
HR_MAILBOX=""
ENV
  echo "Created .env (emails are printed in the terminal, not sent)."
fi
if [ -n "$DATABASE_URL" ] && [ -n "$DIRECT_URL" ]; then
  npx prisma migrate deploy
  if [ -n "$SEED_ADMIN_EMAIL" ]; then SEED_DEMO=true npm run db:seed; fi
else
  echo "⚠  DATABASE_URL / DIRECT_URL Codespaces secrets are not set – see README (Testing in GitHub Codespaces)."
fi
