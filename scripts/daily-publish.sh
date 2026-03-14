#!/usr/bin/env bash
# daily-publish.sh — Daily ShipLint npm publish
# Runs from cron at 16:00 UTC (8am Pacific)
# Only publishes if there are new commits since last publish tag.

set -euo pipefail

REPO_DIR="$HOME/ShipLint"
TS_DIR="$REPO_DIR/typescript"
LOG_FILE="$REPO_DIR/scripts/publish.log"
LOCK_FILE="/tmp/shiplint-publish.lock"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*" | tee -a "$LOG_FILE"; }

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
  log "SKIP: Lock file exists, another publish may be running"
  exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

log "=== Starting daily publish check ==="

# 1. Update repo
cd "$REPO_DIR"
git checkout main 2>&1 | tee -a "$LOG_FILE"
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# 2. Check for new commits since last publish
LAST_PUBLISH_TAG=$(git tag --list 'publish-*' --sort=-version:refname | head -1)
if [ -n "$LAST_PUBLISH_TAG" ]; then
  NEW_COMMITS=$(git rev-list "$LAST_PUBLISH_TAG"..HEAD --count -- typescript/)
  if [ "$NEW_COMMITS" -eq 0 ]; then
    log "SKIP: No new commits in typescript/ since $LAST_PUBLISH_TAG"
    exit 0
  fi
  log "Found $NEW_COMMITS new commit(s) in typescript/ since $LAST_PUBLISH_TAG"
else
  log "No previous publish tag found, proceeding with first publish"
fi

# 3. Check npm auth
if ! npm whoami &>/dev/null; then
  log "ERROR: npm auth not configured. Run 'npm login' or set up ~/.npmrc"
  exit 1
fi

# 4. Install deps, build, and test
cd "$TS_DIR"
log "Installing dependencies..."
npm ci 2>&1 | tee -a "$LOG_FILE"

log "Building..."
npm run build 2>&1 | tee -a "$LOG_FILE"

log "Running tests..."
if ! npm test 2>&1 | tee -a "$LOG_FILE"; then
  log "ERROR: Tests failed — aborting publish"
  exit 1
fi

# 5. Bump patch version
log "Bumping patch version..."
npm version patch --no-git-tag-version 2>&1 | tee -a "$LOG_FILE"
NEW_VERSION=$(node -p "require('./package.json').version")
log "New version: $NEW_VERSION"

# 6. Publish
log "Publishing shiplint@$NEW_VERSION..."
if ! npm publish 2>&1 | tee -a "$LOG_FILE"; then
  log "ERROR: npm publish failed"
  # Revert the version bump
  git checkout -- package.json package-lock.json 2>/dev/null || true
  exit 1
fi

# 7. Commit version bump and tag
cd "$REPO_DIR"
git add typescript/package.json typescript/package-lock.json
git commit -m "chore: bump shiplint to v$NEW_VERSION [skip ci]" 2>&1 | tee -a "$LOG_FILE"
git tag "publish-v$NEW_VERSION"
git push origin main --tags 2>&1 | tee -a "$LOG_FILE"
log "Pushed version bump and tag publish-v$NEW_VERSION"

# 8. Update macbuilder
log "Updating shiplint on macbuilder..."
if ssh macbuilder 'npm i -g shiplint' 2>&1 | tee -a "$LOG_FILE"; then
  log "macbuilder updated successfully"
else
  log "WARNING: Failed to update macbuilder (non-fatal)"
fi

log "=== Publish complete: shiplint@$NEW_VERSION ==="
