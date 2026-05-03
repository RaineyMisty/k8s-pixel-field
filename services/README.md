# PixelField Server

This folder contains the main services of PixelField.

## Deployment

This project is currently deployed on one AWS EC2 instance.

The EC2 server has: `ubuntu24.04`, `docker`, `k3s`, `kubectl`.

## Network Structure (current)

Current public demo structure:
```text
Browser
  ↓
http://<EC2_PUBLIC_IP>:5500
  ↓
EC2:5500
  ↓
Python static web server
  ↓
services/web/index.html
```

Current temporary ports:
```text
5500 → frontend static website
8080 → backend Node.js API
80   → currently owned by k3s / Traefik, returns default 404
```

## Deploy Commands

### Build and run backend API

```bash
cd ~/k8s-pixel-field/services/pixel-api

sudo docker build -t pixel-api .

sudo docker run -d \
  --name pixel-api \
  -p 8080:8080 \
  -v "$PWD/data:/app/data" \
  pixel-api
```

Check backend health:

```bash
curl http://localhost:8080/health
```

Check backend container:

```bash
sudo docker ps
sudo docker logs pixel-api
```

Restart backend:

```bash
sudo docker restart pixel-api
```

Rebuild backend after code changes:

```bash
cd ~/k8s-pixel-field/services/pixel-api

sudo docker rm -f pixel-api

sudo docker build -t pixel-api .

sudo docker run -d \
  --name pixel-api \
  -p 8080:8080 \
  -v "$PWD/data:/app/data" \
  pixel-api
```

### Run frontend website in background

```bash
cd ~/k8s-pixel-field/services/web

nohup python3 -m http.server 5500 --bind 0.0.0.0 > web.log 2>&1 &
```

Check frontend:

```bash
curl http://localhost:5500 | head
```

View frontend log:

```bash
tail -f ~/k8s-pixel-field/services/web/web.log
```

Stop frontend server:

```bash
pkill -f "python3 -m http.server 5500"
```

## Current limitations and next steps

### 1. Use port 80 instead of port 5500

Currently the frontend is accessed through:

```text
http://<EC2_PUBLIC_IP>:5500
```

The final version should be accessed through:

```text
http://<EC2_PUBLIC_IP>
```

Right now port 80 is already used by k3s / Traefik and returns a default 404 page.

### 2. Add Kubernetes Ingress / gateway routing

The final Kubernetes version should use Ingress / Traefik to route traffic.

Target structure:

```text
Browser
  ↓
http://<EC2_PUBLIC_IP>
  ↓
EC2:80
  ↓
Traefik Ingress
    ├── /       → web service
    ├── /pixels → pixel-api service
    └── /health → pixel-api service
```

### 3. Do not expose backend port 8080 directly

Currently the backend API is publicly exposed. The final version should only expose port 80/443 publicly, and the backend should only be reachable through Kubernetes Service and Ingress routing.

### 4. Add real-time update

Currently, if one user changes a pixel, another user needs to refresh the page to see the change.

### 5. Move temporary deployment into Kubernetes

Target version:

```text
Kubernetes Deployment → web
Kubernetes Deployment → pixel-api
Kubernetes Service → web-service
Kubernetes Service → pixel-api-service
Kubernetes PVC → persistent pixel data
Kubernetes Ingress → public routing
```

