#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/etc/update-motd.d/99-codercrafter-lms"

cat <<EOF | sudo tee "$TARGET" >/dev/null
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$REPO_ROOT"

compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  echo ""
}

get_port() {
  local svc="\$1"
  local port="\$2"
  local cmd
  cmd="\$(compose_cmd)"
  if [ -n "\$cmd" ] && [ -d "\$PROJECT_DIR" ]; then
    (cd "\$PROJECT_DIR" && \$cmd port "\$svc" "\$port" 2>/dev/null | awk -F: 'NR==1{print \$2}')
    return
  fi
}

frontend_port="\$(get_port frontend 3000)"
backend_port="\$(get_port backend 5000)"

if [ -z "\$frontend_port" ] && command -v docker >/dev/null 2>&1; then
  frontend_port="\$(docker port coder_frontend 3000 2>/dev/null | awk -F: 'NR==1{print \$2}')"
fi
if [ -z "\$backend_port" ] && command -v docker >/dev/null 2>&1; then
  backend_port="\$(docker port coder_backend 5000 2>/dev/null | awk -F: 'NR==1{print \$2}')"
fi

frontend_port="\${frontend_port:-3000}"
backend_port="\${backend_port:-5000}"

host_ip="\$(hostname -I 2>/dev/null | awk '{print \$1}')"
host_ip="\${host_ip:-127.0.0.1}"

frontend_url="http://\${host_ip}:\${frontend_port}"
backend_url="http://\${host_ip}:\${backend_port}/api"

cat <<BANNER

   ____          _                _____            __ _            
  / ___|___   __| | ___ _ __     / ____| ___  _ __ / _(_)_  ___ ___ 
 | |   / _ \\ / _\` |/ _ \\ '__|   | |    / _ \\| '__| |_| | |/ __/ _ \\
 | |__| (_) | (_| |  __/ |      | |___| (_) | |  |  _| | | (_|  __/
  \\____\\___/ \\__,_|\\___|_|       \\_____|\\___/|_|  |_| |_|_|\\___\\___|

CoderCrafter LMS
Frontend: \$frontend_url
Backend : \$backend_url

BANNER
EOF

sudo chmod +x "$TARGET"
echo "Installed MOTD banner at $TARGET"
