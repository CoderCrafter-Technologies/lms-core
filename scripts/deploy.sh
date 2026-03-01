#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up --build -d
else
  echo "Docker Compose not found."
  exit 1
fi

if [ -x "$PROJECT_DIR/scripts/show-banner.sh" ]; then
  "$PROJECT_DIR/scripts/show-banner.sh" "$PROJECT_DIR"
fi
