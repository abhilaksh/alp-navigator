#!/bin/bash
# deploy.sh — run as root on the VPS (178.16.137.129)
# Usage: ./deploy.sh [--rebuild]
set -e

APP_DIR="/var/www/navigator.alptravel.co"
REPO_URL="https://github.com/alptravel/navigator"   # update if you have a git remote

echo "==> Deploying Alp Navigator to $APP_DIR"

# --- Step 1: ensure app dir exists ---
mkdir -p "$APP_DIR"

# --- Step 2: if this is a fresh deploy, copy files (rsync from upload, or git clone) ---
# If using git: git -C "$APP_DIR" pull || git clone "$REPO_URL" "$APP_DIR"
# For manual upload via SFTP, files are already in place.

cd "$APP_DIR"

# --- Step 3: ensure .env.production exists ---
if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found in $APP_DIR"
  echo "Copy .env.production.example to .env.production and fill in real values."
  exit 1
fi

# --- Step 4: build and start with Docker Compose ---
echo "==> Building Docker image..."
docker compose build --no-cache

echo "==> Stopping old container (if any)..."
docker compose down || true

echo "==> Starting container..."
docker compose up -d

echo "==> Container started. App is running on port 3000."
echo ""
echo "==> Checking health..."
sleep 5
curl -sf http://localhost:3000 > /dev/null && echo "✓ App responding on port 3000" || echo "✗ App not responding yet — check: docker compose logs app"
