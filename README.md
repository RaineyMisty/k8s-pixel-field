# PixelField

## Live Demo

<p align="center">
  <a href="http://18.191.166.120/">
    <strong>🎮 Play PixelField Live →</strong>
  </a>
</p>

<p align="center">
  A real-time collaborative pixel canvas deployed on k8s.
</p>

<p align="center">
  <a href="https://github.com/RaineyMisty/k8s-pixel-field">GitHub Repository</a>
  ·
  <a href="#system-architecture">Architecture</a>
  ·
  <a href="#project-structure">Structure</a>
</p>


## Introduction
PixelField is a shared pixel where users can leave their marks in a continuously evolving two-dimensional space.

Multiple users can interact with the system simutaneously by modifying pixels across the world. Over time, these interactions form an emergent "pixel ecosystem" shaped collective by its users.

This project is a cloud-native operations system, using Kubernetes ad the primary orchestration platform. It focuses on deployment, system resilience, and horizontal scalability in a distributed environment.

## Goal
The main goal is to design and evaluate a distributed system with the following properties:

### 1. Persistence
- The system maintains a consistent and durable pixel state, ensuring that data is preserved across service restarts and failures.

### 2. Concurrency
- The system supports multiple users interacting with the same or different pixels simultaneously while  maintaining correct state updates.

### 3. Self-healing
- When a component (e.g., a pod) fails, the system automatically recovers and continues operating without manual intervention.

### 4. Scalability
- The system can scale from a small setup to a larger pixel field, supporting growth in both the number of users and the size of the world.

### 5. Platform Accessibility
- The system is accessible through a standard web interface, allowing consistent usage across different devices and browsers.

## System Architecture

```text
User (Browser)
      ↓
Ingress (Traefik on port 80)
      ↓
Path-based routing
      ├── /          → web-service → web-deployment → Nginx static frontend
      ├── /pixels    → pixel-api-service → pixel-api-deployment → Node.js API
      ├── /ws        → pixel-api-service → pixel-api-deployment → WebSocket
      └── /health    → pixel-api-service → pixel-api-deployment → health check
      ↓
Pixel API Deployment
      ↓
PersistentVolumeClaim: pixel-data-pvc
      ↓
Persistent Volume
      ↓
pixels.json
```

## Project Structure
```text
k8s-pixel-field/
├── services/        # Application services
│   ├── pixel-api/   # Backend API
│   └── web/         # Frontend UI
│
└── deploy/          # Deployment configuration
    └── k8s/         # Kubernetes manifests
```

## Development Workflow
- The `main` branch is protected and must remain stable.
- Create a new branch for each feature or fix.
- Open a pull request before merging into `main`.
- At least one approval is required before merging.

## Commit Convention
Commit should be short, clear, and action-oriented.

Recommended format: `type: short discription`

Allowed types:
```text
feat: add new feature
fix: fix a bug
docs: update documentation
refactor: improve code structure
test: add or update tests
chore: maintain project config or tool
```

## License
This project is licensed under the MIT License.
