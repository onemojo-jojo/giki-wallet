#!/bin/bash
# Auto-deploy: checks GHCR for new images and restarts if updated
# Run via cron every 2 minutes: */2 * * * * /opt_2/giki-wallet/deploy.sh >> /opt_2/giki-wallet/deploy.log 2>&1

set -euo pipefail

PROJECT_DIR="/opt_2/giki-wallet"
BACKEND_IMAGE="ghcr.io/hash-walker/giki-wallet-backend:latest"
FRONTEND_IMAGE="ghcr.io/hash-walker/giki-wallet-frontend:latest"

cd "$PROJECT_DIR"

# Get current image digests
OLD_BACKEND=$(docker inspect --format='{{index .RepoDigests 0}}' "$BACKEND_IMAGE" 2>/dev/null || echo "none")
OLD_FRONTEND=$(docker inspect --format='{{index .RepoDigests 0}}' "$FRONTEND_IMAGE" 2>/dev/null || echo "none")

# Pull latest
docker compose pull backend frontend --quiet

# Get new digests
NEW_BACKEND=$(docker inspect --format='{{index .RepoDigests 0}}' "$BACKEND_IMAGE" 2>/dev/null || echo "none")
NEW_FRONTEND=$(docker inspect --format='{{index .RepoDigests 0}}' "$FRONTEND_IMAGE" 2>/dev/null || echo "none")

# Only restart if something changed
if [ "$OLD_BACKEND" != "$NEW_BACKEND" ] || [ "$OLD_FRONTEND" != "$NEW_FRONTEND" ]; then
    echo "[$(date)] New images detected, deploying..."
    docker compose up -d --no-deps backend frontend
    docker image prune -f
    echo "[$(date)] Deploy complete."
else
    echo "[$(date)] No changes."
fi
