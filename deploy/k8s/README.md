# Kubernetes Deployment Manifests

This directory contains the Kubernetes manifests for deploying PixelField.

## Components

- `pixel-api-deployment.yaml`
  - Runs the Pixel API backend as Kubernetes pods.

- `pixel-api-service.yaml`
  - Provides a stable internal endpoint for the Pixel API.

- `pvc.yaml`
  - Requests persistent storage for PixelField data.

- `ingress.yaml`
  - Defines the external entry point for accessing the application from a browser.