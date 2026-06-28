#!/bin/bash
# serveravatar-setup.sh
# Runs on the VPS after ServerAvatar is installed.
# Sets up MySQL, creates the app directory, runs Docker deploy.
set -e

APP_DIR="/var/www/navigator.alptravel.co"
DB_NAME="navigator_alp"
DB_USER="navigator"
DB_PASS="X9hMAEkQvOaT4JRE8w9KNApi"

echo ""
echo "=== [1/5] Install Docker (if needed) ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "Docker already installed: $(docker --version)"
fi

echo ""
echo "=== [2/5] Install MySQL 8 (if needed) ==="
if ! command -v mysql &>/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  systemctl enable --now mysql
else
  echo "MySQL already installed"
fi

echo ""
echo "=== [3/5] Create database and user ==="
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "Database '${DB_NAME}' ready."

echo ""
echo "=== [4/5] Install Node.js 22 (for migrations) ==="
if ! node --version 2>/dev/null | grep -q "v22"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node --version)"

echo ""
echo "=== [5/5] Create app directory ==="
mkdir -p "${APP_DIR}"
echo "App directory ready at ${APP_DIR}"

echo ""
echo "=== DONE ==="
echo "Next: Upload app files to ${APP_DIR}, then run deploy.sh"
