#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
elif command -v docker-compose >/dev/null 2>&1; then
  echo "Detected docker-compose v1. This project requires Docker Compose v2 (docker compose)."
  echo "Reason: docker-compose v1 can crash with \"KeyError: 'ContainerConfig'\" on modern Docker."
  echo "Please install/enable Docker Compose v2 and re-run: docker compose up --build -d"
  exit 1
else
  echo "Docker Compose not found."
  exit 1
fi

if [ -x "$PROJECT_DIR/scripts/show-banner.sh" ]; then
  "$PROJECT_DIR/scripts/show-banner.sh" "$PROJECT_DIR"
fi
