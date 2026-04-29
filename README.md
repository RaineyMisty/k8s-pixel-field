# PixelField

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
Ingress / Gateway
      ↓
Web Service
      ↓
Pixel API Service
      ↓
Storage Layer
      ↓
Persistent Volume
```

## Project Structure
```text
k8s-pixel-field/
├── services/        # Application services
│   ├── pixel-api/   # Backend API
│   └── web/         # Frontend UI
│
├── deploy/          # Deployment configuration
│   ├── k8s/         # Kubernetes manifests
│   └── docker/      # Local / build configuration 
│
├── docs/            # Architecture and design notes
├── scripts/         # Helper scripts
└── tests/           # Tests
```
## Endpoints
- `GET /health`
- `GET /pixels?width=<n>&height=<n>`
- `PUT /pixels/:x/:y` with JSON body `{ "colorIndex": <int> }`

## Run

cd services/pixel-api
npm start

- In seperate terminal 
cd services/web
python3 -m http.server 5500

- open html 

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

# Services

## Backend (pixel-api)

### Requirements
- Python 3.10+
- FastAPI
- Uvicorn

### How to Run
```bash
# Run in pixel-api fold and setup
cd ./services/pixel-api
pip install -r requirements.txt

# Run uvicorn
uvicorn app.main:app --reload
```

Now we can see the web page throw `http://127.0.0.1:8000`

To test click, using this command:
```bash
curl -X POST http://127.0.0.1:8000/pixels/click -H "Content-Type: application/json" -d '{"x":1,"y":2}'
```
If it is PowerShell, using this instead:
```bash
curl -Method POST http://127.0.0.1:8000/pixels/click -Headers @{"Content-Type"="application/json"} -Body '{"x":1,"y":2}'
```

Expected Result:
```json
{"x":1,"y":2,"version":1}
```
Repeated calls will increase version.