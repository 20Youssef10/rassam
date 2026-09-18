#!/usr/bin/env bash
# Manual GHCR publish — no GitHub Actions / no Actions billing required.
# Requires: docker, gh (authenticated)
# Usage: bash scripts/publish-ghcr.sh [tag]
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:-v0.1.0}"
OWNER="20Youssef10"
# GHCR image names must be lowercase
NS="ghcr.io/$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')/rassam"

echo "Logging in to GHCR as $OWNER via gh token..."
TOKEN="$(gh auth token)"
echo "$TOKEN" | docker login ghcr.io -u "$OWNER" --password-stdin

echo "Building & pushing:"
echo "  $NS/web:$TAG"
echo "  $NS/room:$TAG"
echo "  $NS/storage:$TAG"

docker build -t "$NS/web:$TAG" -t "$NS/web:latest" .
docker push "$NS/web:$TAG"
docker push "$NS/web:latest"

docker build -t "$NS/room:$TAG" -t "$NS/room:latest" ./collab
docker push "$NS/room:$TAG"
docker push "$NS/room:latest"

docker build -t "$NS/storage:$TAG" -t "$NS/storage:latest" ./storage
docker push "$NS/storage:$TAG"
docker push "$NS/storage:latest"

echo "Done. Images:"
echo "  $NS/web"
echo "  $NS/room"
echo "  $NS/storage"
