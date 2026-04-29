#!/usr/bin/env bash
set -euo pipefail

kubectl apply -f deploy/k8s/
kubectl get all -n pixelfield
