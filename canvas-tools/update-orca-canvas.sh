#!/bin/zsh
# Builds this checkout as "Orca Canvas.app" and installs it beside the official Orca.
# Usage: canvas-tools/update-orca-canvas.sh [--skip-build]
set -euo pipefail

REPO="${0:A:h:h}"
APP_NAME="Orca Canvas"
BUNDLE_ID="com.stablyai.orca.canvas"
INSTALL_DIR="/Applications"
BACKUP_DIR="$HOME/Library/Application Support/orca-canvas-backups"
PROFILE_DIR="$HOME/Library/Application Support/orca-canvas"
OFFICIAL_PROFILE_DIR="$HOME/Library/Application Support/orca"

log() { print -P "%F{cyan}[orca-canvas]%f $*" }

source "$HOME/.nvm/nvm.sh" >/dev/null
nvm use 24 >/dev/null
cd "$REPO"

if [[ -n "$(git status --porcelain)" ]]; then
  log "Note: building uncommitted changes."
fi

if [[ "${1:-}" != "--skip-build" ]]; then
  export ORCA_CANVAS_STANDALONE=1 CSC_IDENTITY_AUTO_DISCOVERY=false
  log "Installing dependencies…"
  pnpm install --frozen-lockfile
  pnpm -C mobile install --frozen-lockfile
  log "Building (10–20 min)…"
  pnpm run build:desktop
  pnpm run build:computer-macos
  pnpm run build:keyboard-layout-macos
  pnpm run build:process-footprint-macos
  pnpm run build:notification-status-macos
  pnpm run ensure:electron-runtime
  rm -rf dist/mac dist/mac-arm64 dist/mac-universal
  pnpm exec electron-builder --config config/electron-builder.config.cjs --mac --dir \
    "-c.appId=$BUNDLE_ID" "-c.productName=$APP_NAME"
fi

BUILT_APP="$(ls -d dist/mac*/"$APP_NAME.app" 2>/dev/null | head -1)"
if [[ -z "$BUILT_APP" ]]; then
  log "No built app found under dist/. Run without --skip-build."
  exit 1
fi

if pgrep -x "$APP_NAME" >/dev/null; then
  log "Quitting the running $APP_NAME…"
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" || true
  for _ in {1..30}; do
    pgrep -x "$APP_NAME" >/dev/null || break
    sleep 1
  done
  if pgrep -x "$APP_NAME" >/dev/null; then
    log "$APP_NAME is still running. Quit it and rerun with --skip-build."
    exit 1
  fi
fi

if [[ -d "$INSTALL_DIR/$APP_NAME.app" ]]; then
  mkdir -p "$BACKUP_DIR"
  rm -rf "$BACKUP_DIR/$APP_NAME.previous.app"
  mv "$INSTALL_DIR/$APP_NAME.app" "$BACKUP_DIR/$APP_NAME.previous.app"
  log "Previous version kept at $BACKUP_DIR/$APP_NAME.previous.app"
fi
ditto "$BUILT_APP" "$INSTALL_DIR/$APP_NAME.app"
log "Installed $INSTALL_DIR/$APP_NAME.app"

# First install only: copy projects, workspaces and settings from the official Orca.
if [[ ! -d "$PROFILE_DIR" && -d "$OFFICIAL_PROFILE_DIR" ]]; then
  log "Copying projects and settings from the official Orca…"
  node config/scripts/development/profile-seeding/dev-profile-seed.mjs \
    "--from=$OFFICIAL_PROFILE_DIR" "--to=$PROFILE_DIR"
fi

open "$INSTALL_DIR/$APP_NAME.app"
log "Done: $(git log -1 --format='%h %s')"
