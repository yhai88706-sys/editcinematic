#!/usr/bin/env bash
# Deployment helper script that builds the Docker image and verifies health.
set -euo pipefail

IMAGE_NAME="mt5-robot"
CONTAINER_NAME="mt5-robot-container"

# Build the container image
python -m venv .deploy-venv || true
source .deploy-venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -m backend.ml_model  # ensure model built

deactivate
rm -rf .deploy-venv

docker build -t "$IMAGE_NAME" .

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run -d --name "$CONTAINER_NAME" -p 5000:5000 "$IMAGE_NAME"

sleep 5
curl -f http://localhost:5000/api/health
