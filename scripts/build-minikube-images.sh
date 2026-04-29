#!/usr/bin/env bash
set -euo pipefail

eval "$(minikube docker-env)"

docker build -t pixelfield-api:latest services/pixel-api
docker build -t pixelfield-web:latest services/web

echo "Built pixelfield-api:latest and pixelfield-web:latest inside Minikube."
