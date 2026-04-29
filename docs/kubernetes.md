# Kubernetes Deployment

This branch deploys PixelField as two Kubernetes services:

```text
Browser
  -> web-service / web-deployment
  -> pixel-api-service / pixel-api-deployment
  -> pixel-data-pvc
```

## Files

- `00-namespace.yaml`: creates the `pixelfield` namespace.
- `01-pixel-data-pvc.yaml`: creates persistent storage for `pixels.json`.
- `02-pixel-api-deployment.yaml`: runs the Node.js pixel API.
- `03-pixel-api-service.yaml`: gives the API a stable internal service name.
- `04-web-deployment.yaml`: runs the static web page through Nginx.
- `05-web-service.yaml`: gives the web frontend a stable service name.
- `06-web-ingress.yaml`: optional Ingress entry point.
- `07-web-hpa.yaml`: scales the web deployment based on CPU usage.

## Run on Minikube

```bash
minikube start
chmod +x scripts/*.sh
./scripts/build-minikube-images.sh
./scripts/deploy-k8s.sh
kubectl port-forward -n pixelfield svc/web-service 5500:80
```

Then open:

```text
http://localhost:5500
```

## Test self-healing

```bash
kubectl delete pod -n pixelfield -l app=pixelfield-web
kubectl get pods -n pixelfield -w
```

Kubernetes recreates the deleted pod.

## Test persistence

Change some pixels, then delete the API pod:

```bash
kubectl delete pod -n pixelfield -l app=pixel-api
```

After Kubernetes recreates the pod, refresh the page. Pixel data should remain because it is stored through the PVC.

## Test scaling

```bash
kubectl scale deployment web-deployment -n pixelfield --replicas=3
kubectl get pods -n pixelfield
```
