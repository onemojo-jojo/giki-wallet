#!/bin/bash
# Auto-deploy: checks GHCR for new images and restarts if updated
# Run via cron every 2 minutes: */2 * * * * /opt_2/giki-wallet/deploy.sh >> /opt_2/giki-wallet/deploy.log 2>&1

set -euo pipefail

PROJECT_DIR="/opt_2/giki-wallet"
IMAGES=(
  "ghcr.io/hash-walker/giki-wallet-backend:latest"
  "ghcr.io/hash-walker/giki-wallet-frontend:latest"
  "ghcr.io/hash-walker/giki-wallet-nginx:latest"
  "ghcr.io/hash-walker/giki-wallet-migrations:latest"
)

cd "$PROJECT_DIR"

# Capture current digests
declare -A OLD_DIGESTS
for img in "${IMAGES[@]}"; do
  OLD_DIGESTS["$img"]=$(docker inspect --format='{{index .RepoDigests 0}}' "$img" 2>/dev/null || echo "none")
done

# Pull all images
docker compose pull --quiet

# Check if anything changed
CHANGED=false
for img in "${IMAGES[@]}"; do
  NEW=$(docker inspect --format='{{index .RepoDigests 0}}' "$img" 2>/dev/null || echo "none")
  if [ "${OLD_DIGESTS[$img]}" != "$NEW" ]; then
    CHANGED=true
    break
  fi
done

if [ "$CHANGED" = true ]; then
    echo "[$(date)] New images detected, deploying..."
    docker compose up -d --no-deps backend frontend migrations
    docker compose restart nginx
    docker image prune -f
    echo "[$(date)] Deploy complete."
else
    echo "[$(date)] No changes."
fi
