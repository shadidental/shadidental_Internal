#!/usr/bin/env bash
# Build on Render: install, apply database migrations, create the first admin
# (idempotent), then build the app.
set -euo pipefail
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
if [ -n "${SEED_ADMIN_EMAIL:-}" ]; then npm run db:seed; fi
npx next build
