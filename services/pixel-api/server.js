const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "pixels.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { pixels: {} };
  }

  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = safeJsonParse(raw, { pixels: {} });

  if (!parsed || typeof parsed !== "object" || !parsed.pixels || typeof parsed.pixels !== "object") {
    return { pixels: {} };
  }

  return parsed;
}

function persistData(data) {
  const tmpPath = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DATA_FILE);
}

const state = loadData();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Body too large"));
      }
    });

    req.on("end", () => {
      resolve(raw);
    });

    req.on("error", (error) => reject(error));
  });
}

function getPixelList() {
  return Object.entries(state.pixels).map(([key, colorIndex]) => {
    const [x, y] = key.split(",").map((v) => Number(v));
    return { x, y, colorIndex };
  });
}

function handleGetPixels(url, res) {
  const widthParam = url.searchParams.get("width");
  const heightParam = url.searchParams.get("height");

  const width = widthParam !== null ? Number(widthParam) : null;
  const height = heightParam !== null ? Number(heightParam) : null;

  const hasBounds = Number.isInteger(width) && width >= 0 && Number.isInteger(height) && height >= 0;
  let pixels = getPixelList();

  if (hasBounds) {
    pixels = pixels.filter((p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height);
  }

  sendJson(res, 200, { pixels });
}

function isValidCoordinate(value) {
  return Number.isInteger(value) && value >= 0;
}

async function handlePutPixel(req, res, x, y) {
  if (!isValidCoordinate(x) || !isValidCoordinate(y)) {
    sendJson(res, 400, { error: "Coordinates must be non-negative integers" });
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = safeJsonParse(raw, null);

    if (!payload || !Number.isInteger(payload.colorIndex) || payload.colorIndex < 0) {
      sendJson(res, 400, { error: "colorIndex must be a non-negative integer" });
      return;
    }

    const key = `${x},${y}`;
    state.pixels[key] = payload.colorIndex;
    persistData(state);

    sendJson(res, 200, { x, y, colorIndex: payload.colorIndex });
  } catch (error) {
    sendJson(res, 500, { error: "Failed to persist pixel", details: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/pixels") {
    handleGetPixels(url, res);
    return;
  }

  const pixelMatch = url.pathname.match(/^\/pixels\/(\d+)\/(\d+)$/);
  if (req.method === "PUT" && pixelMatch) {
    const x = Number(pixelMatch[1]);
    const y = Number(pixelMatch[2]);
    await handlePutPixel(req, res, x, y);
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Pixel API listening on http://${HOST}:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
