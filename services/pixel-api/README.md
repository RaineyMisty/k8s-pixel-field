# Pixel API Service

This service was initially implemented by Gaby.

## File Structure

```
pixel-api/
├── main.js              ← entry point (run this to start the server)
├── server.js            ← server logic, exported as startServer()
├── package.json
├── Dockerfile
├── data/
│   └── pixels.json      ← persisted pixel state
└── test/
    └── server.test.js   ← automated test suite
```

## How to Run

```bash
# Install dependencies (required — server uses the ws package)
cd ./services/pixel-api
npm install

# Start the server directly
npm start
```

The server starts on `http://localhost:8080` and `ws://localhost:8080/ws`.

```bash
# Test the HTTP health endpoint
curl http://localhost:8080/health
```

Expect `{"status":"ok","clients":0}` when the server is running with no WebSocket clients connected.

```bash
# In a separate terminal, serve the frontend
cd ./services/web
python3 -m http.server 5500
```

Now you can play PixelField at `http://localhost:5500`.

### Docker

```bash
# Build
cd ./services/pixel-api
docker build -t pixel-api .

# Run (ephemeral)
docker run --rm -p 8080:8080 pixel-api

# Run with persistent data
docker run --rm -p 8080:8080 -v "$PWD/data:/app/data" pixel-api
```

## Running Tests

```bash
cd ./services/pixel-api
npm test
```

The test suite uses Node's built-in test runner — no extra packages needed. Each test group
spins up its own server on a random free port with a temporary data directory, so tests never
touch your real `pixels.json` and can run safely at any time.

Tests cover:

- `GET /health`, `GET /pixels`, `PUT /pixels/:x/:y`
- Bounds filtering (`?width=&height=`)
- Input validation (negative, missing, and float `colorIndex`)
- Persistence to disk
- WebSocket connect, paint → `pixel_ack`, broadcast to other clients
- Sender does not receive its own broadcast

## API Summary

### HTTP

| Method    | Path                   | Description                          |
|-----------|------------------------|--------------------------------------|
| `GET`     | `/health`              | Check whether the API server is running |
| `GET`     | `/pixels`              | Get all stored pixels                |
| `GET`     | `/pixels?width=&height=` | Get pixels within a bounded area   |
| `PUT`     | `/pixels/:x/:y`        | Update one pixel                     |
| `OPTIONS` | `*`                    | Handle CORS preflight requests       |

### WebSocket

Connect to `ws://localhost:8080/ws`.

**Client → Server**

```json
{ "type": "pixel_update", "x": 3, "y": 7, "colorIndex": 2 }
```

**Server → Client (sender)**

```json
{ "type": "pixel_ack", "x": 3, "y": 7, "colorIndex": 2 }
```

Sent back to the client that painted the pixel to confirm the save succeeded.

**Server → Client (all other connected clients)**

```json
{ "type": "pixel_update", "x": 3, "y": 7, "colorIndex": 2 }
```

Broadcast to every other connected client so their canvas updates in real time.

**Server → Client (on error)**

```json
{ "type": "error", "message": "Coordinates must be non-negative integers" }
```

Sent only to the client that sent the invalid message.

## Function Overview

### `safeJsonParse(raw, fallback)`

Safely parses a JSON string. Returns the fallback value if parsing fails instead of
crashing the server.

### `loadData(dataFile)`

Loads pixel data from the given file path. Returns an empty pixel state if the file does
not exist or contains invalid JSON:

```json
{ "pixels": {} }
```

### `persistData(dataFile, data)`

Writes the current pixel state to disk. Writes to a `.tmp` file first then renames it
atomically, so a crash mid-write can never corrupt `pixels.json`.

### `broadcast(wss, senderWs, pixel)`

Sends a `pixel_update` message to every open WebSocket client except the sender.
Pass `null` as `senderWs` (e.g. from an HTTP PUT) to broadcast to all clients.

### `sendJson(res, statusCode, payload)`

Sends a JSON HTTP response with CORS headers so the frontend can call the API from
a different port or origin.

### `readBody(req)`

Reads and returns the full request body as a string. Rejects if the body exceeds 1 MB.

### `applyPixelUpdate(state, dataFile, x, y, colorIndex)`

Core pixel-update logic shared by both the HTTP PUT handler and the WebSocket message
handler. Validates coordinates and `colorIndex`, writes to the in-memory state, persists
to disk, and returns the saved pixel object. Throws with a `statusCode` property on
validation failure.

### `getPixelList(state)`

Converts the internal pixel storage format into a frontend-friendly list.

Internal format:

```json
{ "pixels": { "16,9": 1 } }
```

API response format:

```json
{ "pixels": [{ "x": 16, "y": 9, "colorIndex": 1 }] }
```

### `handleGetPixels(state, url, res)`

Handles `GET /pixels`. Returns all stored pixels, or only those within bounds when
`width` and `height` query parameters are supplied:

```
GET /pixels?width=40&height=30
```

### `handlePutPixel(state, dataFile, wss, req, res, x, y)`

Handles `PUT /pixels/:x/:y`. Reads and validates the request body, calls
`applyPixelUpdate`, broadcasts the change to all WebSocket clients, and responds with
the saved pixel.

Expected request body:

```json
{ "colorIndex": 3 }
```

### `handleWsMessage(state, dataFile, wss, ws, raw)`

Handles an incoming WebSocket message from a connected client. Expects
`{ type: "pixel_update", x, y, colorIndex }`. On success, persists the pixel,
broadcasts to all other clients, and sends a `pixel_ack` back to the sender.
Sends `{ type: "error", message }` back to the sender on validation failure.

### `isValidCoordinate(value)`

Returns `true` if the value is a non-negative integer.

### `startServer(options)`

Creates and starts a fully self-contained server instance. Called by `main.js` for
normal operation and by tests with isolated options.

Options:

| Option     | Default                        | Description                                      |
|------------|--------------------------------|--------------------------------------------------|
| `host`     | `0.0.0.0`                      | Host to bind to                                  |
| `port`     | `8080`                         | Port to listen on. Pass `0` for a random free port (used by tests) |
| `dataDir`  | `<project>/data`               | Directory where `pixels.json` is stored          |
| `dataFile` | `<dataDir>/pixels.json`        | Full path to the data file                       |

Returns a Promise that resolves to `{ server, wss, port, close() }`.
