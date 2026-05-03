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

## Run on k3s

```bash
# Build docker images
cd ~/k8s-pixel-field/services/pixel-api
docker build -t pixelfield-api:latest .

cd ~/k8s-pixel-field/services/web
docker build -t pixelfield-web:latest .

# Import images to k3s
docker save pixelfield-api:latest | sudo k3s ctr -n k8s.io images import -
docker save pixelfield-web:latest | sudo k3s ctr -n k8s.io images import -

# Check images
sudo k3s ctr -n k8s.io images list | grep pixelfield

# Apply YAML
cd ~/k8s-pixel-field
kubectl apply -f deploy/k8s/00-namespace.yaml
kubectl apply -f deploy/k8s/01-pixel-data-pvc.yaml
kubectl apply -f deploy/k8s/02-pixel-api-deployment.yaml
kubectl apply -f deploy/k8s/03-pixel-api-service.yaml
kubectl apply -f deploy/k8s/04-web-deployment.yaml
kubectl apply -f deploy/k8s/05-web-service.yaml
kubectl apply -f deploy/k8s/06-web-ingress.yaml

# Check status
kubectl get all -n pixelfield
kubectl get pvc -n pixelfield
kubectl get ingress -n pixelfield

# Test website
curl http://localhost/health    # Expect {"status":"ok","clients":0}
curl -I http://localhost/       # Expect 200 OK
```

## Update step

```bash
# After modified file
cd ~/k8s-pixel-field/services/pixel-api
docker build -t pixelfield-api:latest .

cd ~/k8s-pixel-field/services/web
docker build -t pixelfield-web:latest .

# Import images
docker save pixelfield-api:latest | sudo k3s ctr -n k8s.io images import -
docker save pixelfield-web:latest | sudo k3s ctr -n k8s.io images import -

# Restart deployments
kubectl rollout restart deployment/pixel-api-deployment -n pixelfield
kubectl rollout restart deployment/web-deployment -n pixelfield

# Check status
kubectl get pods -n pixelfield
```
