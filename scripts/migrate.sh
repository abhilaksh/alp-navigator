#!/bin/bash
# migrate.sh — run DB migrations against the local MySQL
# Run from the app directory on the VPS
set -e

if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found"; exit 1
fi

export $(grep -v '^#' .env.production | xargs)

echo "Running Drizzle migrations against: $DATABASE_URL"
npx drizzle-kit migrate
echo "Migrations complete."
