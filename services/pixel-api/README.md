# Pixel API Service

This service was initially implemented by Gaby.

## How to Run
```bash
# Build docker
cd ./services/pixel-api
docker build -t pixel-api .

# Run docker
docker run --rm -p 8080:8080 pixel-api

# For persistent local data, run the backend with a bind mount
docker run --rm -p 8080:8080 -v "$PWD/data:/app/data" pixel-api
```

Now we can see backend throw `http://localhost:8080`.

```bash
# Test
curl http://localhost:8080/health
```

Expect `{"status":"ok"}` when success.

```bash
# In seperate terminal 
cd ./services/web
python3 -m http.server 5500
```

Now we can play PixelField on browser throw `http://localhost:5500`.

## API Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Check whether the API server is running |
| `GET` | `/pixels` | Get all stored pixels |
| `GET` | `/pixels?width=&height=` | Get pixels within a bounded area |
| `PUT` | `/pixels/:x/:y` | Update one pixel |
| `OPTIONS` | `*` | Handle CORS preflight requests |

## Function Overview

### `safeJsonParse(raw, fallback)`

Safely parses a JSON string. If parsing fails, it returns the fallback value instead of crashing the server.

### `loadData()`

Loads pixel data from `DATA_FILE`.

If the file does not exist, or if the file content is invalid, it returns an empty pixel state:

```json
{
  "pixels": {}
}
```

### `persistData(data)`

Writes the current pixel state back to disk.

It first writes to a temporary file and then renames it to the real data file. This makes file writing safer than directly overwriting `pixels.json`.

### `sendJson(res, statusCode, payload)`

Sends a JSON HTTP response.

It also sets CORS headers so the frontend can call this API from another port or origin.

### `readBody(req)`

Reads the request body from an incoming HTTP request.

This is used by the `PUT /pixels/:x/:y` endpoint to read the JSON payload from the frontend.

### `getPixelList()`

Converts the internal pixel storage format into a frontend-friendly list.

Internal format:

```json
{
  "pixels": {
    "16,9": 1
  }
}
```

API response format:

```json
{
  "pixels": [
    {
      "x": 16,
      "y": 9,
      "colorIndex": 1
    }
  ]
}
```

### `handleGetPixels(url, res)`

Handles:

```http
GET /pixels
```

It returns all stored pixels.

It also supports optional bounds:

```http
GET /pixels?width=40&height=30
```

When `width` and `height` are provided, only pixels inside that area are returned.

### `isValidCoordinate(value)`

Checks whether a coordinate is a non-negative integer.

### `handlePutPixel(req, res, x, y)`

Handles:

```http
PUT /pixels/:x/:y
```

It validates the coordinate and request body, updates the pixel color, persists the new state to disk, and returns the updated pixel.

Expected request body:

```json
{
  "colorIndex": 3
}
```
