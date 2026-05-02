const http = require("http");
const fs   = require("fs");
const path = require("path");
const { WebSocketServer, OPEN } = require("ws");

// ── Persistence ───────────────────────────────────────────────────────────────

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function loadData(dataFile) {
  if (!fs.existsSync(dataFile)) return { pixels: {} };

  const raw    = fs.readFileSync(dataFile, "utf8");
  const parsed = safeJsonParse(raw, { pixels: {} });

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.pixels ||
    typeof parsed.pixels !== "object"
  ) {
    return { pixels: {} };
  }

  return parsed;
}

function persistData(dataFile, data) {
  const tmpPath = `${dataFile}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, dataFile);
}

// ── WebSocket broadcast ───────────────────────────────────────────────────────

function broadcast(wss, senderWs, pixel) {
  const message = JSON.stringify({ type: "pixel_update", ...pixel });
  for (const client of wss.clients) {
    if (client === senderWs) continue;
    if (client.readyState !== OPEN) continue;
    client.send(message);
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end",   () => resolve(raw));
    req.on("error", (err) => reject(err));
  });
}

// ── Pixel logic ───────────────────────────────────────────────────────────────

function isValidCoordinate(value) {
  return Number.isInteger(value) && value >= 0;
}

function applyPixelUpdate(state, dataFile, x, y, colorIndex) {
  if (!isValidCoordinate(x) || !isValidCoordinate(y)) {
    const err = new Error("Coordinates must be non-negative integers");
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(colorIndex) || colorIndex < 0) {
    const err = new Error("colorIndex must be a non-negative integer");
    err.statusCode = 400;
    throw err;
  }

  state.pixels[`${x},${y}`] = colorIndex;
  persistData(dataFile, state);
  return { x, y, colorIndex };
}

function getPixelList(state) {
  return Object.entries(state.pixels).map(([key, colorIndex]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, colorIndex };
  });
}

function handleGetPixels(state, url, res) {
  const widthParam  = url.searchParams.get("width");
  const heightParam = url.searchParams.get("height");
  const width       = widthParam  !== null ? Number(widthParam)  : null;
  const height      = heightParam !== null ? Number(heightParam) : null;
  const hasBounds   =
    Number.isInteger(width)  && width  >= 0 &&
    Number.isInteger(height) && height >= 0;

  let pixels = getPixelList(state);
  if (hasBounds) {
    pixels = pixels.filter(
      (p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height
    );
  }
  sendJson(res, 200, { pixels });
}

async function handlePutPixel(state, dataFile, wss, req, res, x, y) {
  try {
    const raw     = await readBody(req);
    const payload = safeJsonParse(raw, null);

    if (!payload) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const pixel = applyPixelUpdate(state, dataFile, x, y, payload.colorIndex);
    broadcast(wss, null, pixel);
    sendJson(res, 200, pixel);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

function handleWsMessage(state, dataFile, wss, ws, raw) {
  const msg = safeJsonParse(raw, null);

  if (!msg || msg.type !== "pixel_update") {
    ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
    return;
  }

  try {
    const pixel = applyPixelUpdate(
      state, dataFile,
      Number(msg.x), Number(msg.y), Number(msg.colorIndex)
    );
    broadcast(wss, ws, pixel);
    ws.send(JSON.stringify({ type: "pixel_ack", ...pixel }));
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}

// ── startServer ───────────────────────────────────────────────────────────────
//
// Creates and starts a fully self-contained server instance.
// Accepts an options object so tests can supply a temp data directory
// and port 0 (meaning "pick any free port").
//
// Returns { server, wss, port, close() }

function startServer(options = {}) {
  const dataDir  = options.dataDir  || path.join(__dirname, "data");
  const dataFile = options.dataFile || path.join(dataDir, "pixels.json");
  const host     = options.host     || process.env.HOST || "0.0.0.0";
  const port     = options.port     !== undefined ? options.port
                                                  : Number(process.env.PORT || 8080);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const state = loadData(dataFile);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", clients: wss.clients.size });
      return;
    }

    if (req.method === "GET" && url.pathname === "/pixels") {
      handleGetPixels(state, url, res);
      return;
    }

    const pixelMatch = url.pathname.match(/^\/pixels\/(\d+)\/(\d+)$/);
    if (req.method === "PUT" && pixelMatch) {
      await handlePutPixel(
        state, dataFile, wss, req, res,
        Number(pixelMatch[1]), Number(pixelMatch[2])
      );
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    ws.on("message", (data) => handleWsMessage(state, dataFile, wss, ws, data.toString()));
    ws.on("error",   (err)  => console.error("WS error:", err.message));
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const actualPort = server.address().port; // resolves 0 → real port
      resolve({
        server,
        wss,
        port: actualPort,
        close: () => new Promise((res) => {
          wss.close(() => server.close(res));
        }),
      });
    });
  });
}

module.exports = { startServer };
