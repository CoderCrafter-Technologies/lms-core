#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/etc/update-motd.d/99-codercrafter-lms"
SHOW_BANNER="${REPO_ROOT}/scripts/show-banner.sh"

cat <<EOF | sudo tee "$TARGET" >/dev/null
#!/usr/bin/env bash
set -euo pipefail

SHOW_BANNER="$SHOW_BANNER"
PROJECT_DIR="$REPO_ROOT"

if [ -x "\$SHOW_BANNER" ]; then
  "\$SHOW_BANNER" "\$PROJECT_DIR"
  exit 0
fi

echo "CoderCrafter LMS"
EOF

sudo chmod +x "$TARGET"
echo "Installed MOTD banner at $TARGET"
