#!/usr/bin/env bash
set -euo pipefail

RESET_FLAG=""
if [[ ${1-} == "-r" || ${1-} == "--reset-db" ]]; then
  RESET_FLAG="--reset-db"
fi

say_info() { printf "\033[36m[start-all-macos] %s\033[0m\n" "$*"; }
say_warn() { printf "\033[33m[start-all-macos] WARN: %s\033[0m\n" "$*"; }

REPO_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
say_info "Repo root: $REPO_ROOT"

# 1) Start Postgres via docker compose (optional)
COMPOSE_DIR="$REPO_ROOT/infra/docker"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
if command -v docker >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then
  say_info "Starting Postgres via docker compose..."
  (cd "$COMPOSE_DIR" && docker compose up -d) || say_warn "docker compose up failed"
else
  [[ -f "$COMPOSE_FILE" ]] || say_warn "docker-compose.yml not found. Skipping DB container."
  command -v docker >/dev/null 2>&1 || say_warn "Docker CLI not found. Skipping DB container."
fi

# 2) Wait for Postgres 127.0.0.1:5432 (best effort 60s)
wait_port() {
  local host=$1 port=$2 timeout=${3:-60}
  local t=0
  while (( t < timeout )); do
    if command -v nc >/dev/null 2>&1; then
      if nc -z "$host" "$port" 2>/dev/null; then return 0; fi
    else
      # Fallback to /dev/tcp if nc not available
      (echo > /dev/tcp/$host/$port) >/dev/null 2>&1 && return 0 || true
    fi
    sleep 1; ((t++))
  done
  return 1
}

if wait_port 127.0.0.1 5432 60; then
  say_info "Postgres is reachable on 127.0.0.1:5432"
else
  say_warn "Postgres not reachable on 127.0.0.1:5432 after waiting. Proceeding anyway."
fi

# 3) Start backend in new Terminal window/tab if possible
BACKEND_SCRIPT="$REPO_ROOT/scripts/start-backend-macos.sh"
FRONTEND_SCRIPT="$REPO_ROOT/scripts/start-frontend-macos.sh"

open_in_terminal() {
  local cmd=$1
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "tell application \"Terminal\" to do script \"$cmd\"" >/dev/null 2>&1 || return 1
    return 0
  else
    return 1
  fi
}

if [[ -f "$BACKEND_SCRIPT" ]]; then
  say_info "Launching backend window..."
  CMD="\"$BACKEND_SCRIPT\" $RESET_FLAG"
  open_in_terminal "$CMD" || (echo "$CMD" &)
else
  say_warn "Backend script not found at $BACKEND_SCRIPT"
fi

if [[ -f "$FRONTEND_SCRIPT" ]]; then
  say_info "Launching frontend window..."
  CMD2="\"$FRONTEND_SCRIPT\""
  open_in_terminal "$CMD2" || (echo "$CMD2" &)
else
  say_warn "Frontend script not found at $FRONTEND_SCRIPT"
fi

echo
say_info "All launched. Open your browser:"
printf "  Backend:   http://localhost:3000\n  Frontend:  http://localhost:5173\n"
