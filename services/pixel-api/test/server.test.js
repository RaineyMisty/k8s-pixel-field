/**
 * server.test.js
 *
 * Run with:  npm test
 *
 * Uses Node's built-in test runner (node:test) — no extra packages needed.
 * Each test group gets its own server on a random free port (port: 0) and
 * its own temporary data directory, so tests never interfere with each other
 * or with your real pixels.json.
 */

const { test, before, after, describe } = require("node:test");
const assert  = require("node:assert/strict");
const fs      = require("node:fs");
const os      = require("node:os");
const path    = require("node:path");
const { WebSocket } = require("ws");

const { startServer } = require("../server");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a throwaway temp directory for one test group. */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pixelfield-test-"));
}

/** Delete the temp directory after a test group finishes. */
function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Simple HTTP request helper — returns { status, body }. */
async function request(port, method, pathname, bodyObj) {
  const url  = `http://127.0.0.1:${port}${pathname}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (bodyObj !== undefined) opts.body = JSON.stringify(bodyObj);

  const res  = await fetch(url, opts);
  const body = await res.json();
  return { status: res.status, body };
}

/**
 * Open a WebSocket connection and wait until it is ready.
 * Returns the WebSocket instance.
 */
function connectWs(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once("open",  () => resolve(ws));
    ws.once("error", reject);
  });
}

/**
 * Send a message over a WebSocket and wait for the next message back.
 * Returns the parsed JSON response.
 */
function sendAndReceive(ws, payload) {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => {
      try { resolve(JSON.parse(data.toString())); }
      catch (e) { reject(e); }
    });
    ws.send(JSON.stringify(payload));
  });
}

/**
 * Wait for the next message on a WebSocket without sending anything.
 * Useful for checking that a broadcast arrived.
 */
function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => {
      try { resolve(JSON.parse(data.toString())); }
      catch (e) { reject(e); }
    });
  });
}

// ── HTTP Tests ────────────────────────────────────────────────────────────────

describe("HTTP API", () => {
  let srv, tmpDir;

  before(async () => {
    tmpDir = makeTempDir();
    srv    = await startServer({ port: 0, dataDir: tmpDir });
  });

  after(async () => {
    await srv.close();
    removeTempDir(tmpDir);
  });

  // ── /health ────────────────────────────────────────────────────────────────

  test("GET /health returns ok", async () => {
    const { status, body } = await request(srv.port, "GET", "/health");
    assert.equal(status, 200);
    assert.equal(body.status, "ok");
  });

  // ── /pixels ───────────────────────────────────────────────────────────────

  test("GET /pixels returns empty array on fresh start", async () => {
    const { status, body } = await request(srv.port, "GET", "/pixels");
    assert.equal(status, 200);
    assert.deepEqual(body.pixels, []);
  });

  test("PUT /pixels/:x/:y saves a pixel and returns it", async () => {
    const { status, body } = await request(srv.port, "PUT", "/pixels/3/7", { colorIndex: 2 });
    assert.equal(status, 200);
    assert.deepEqual(body, { x: 3, y: 7, colorIndex: 2 });
  });

  test("GET /pixels returns the saved pixel", async () => {
    const { body } = await request(srv.port, "GET", "/pixels");
    const pixel    = body.pixels.find((p) => p.x === 3 && p.y === 7);
    assert.ok(pixel, "saved pixel not found in GET /pixels response");
    assert.equal(pixel.colorIndex, 2);
  });

  test("GET /pixels?width=&height= filters to bounds", async () => {
    // Save a pixel outside the bounds we'll query
    await request(srv.port, "PUT", "/pixels/99/99", { colorIndex: 1 });

    const { body } = await request(srv.port, "GET", "/pixels?width=10&height=10");
    const outOfBounds = body.pixels.find((p) => p.x === 99 && p.y === 99);
    assert.equal(outOfBounds, undefined, "out-of-bounds pixel should be filtered out");
  });

  test("PUT /pixels/:x/:y overwrites an existing pixel", async () => {
    await request(srv.port, "PUT", "/pixels/1/1", { colorIndex: 1 });
    const { status, body } = await request(srv.port, "PUT", "/pixels/1/1", { colorIndex: 5 });
    assert.equal(status, 200);
    assert.equal(body.colorIndex, 5);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  test("PUT /pixels/:x/:y rejects a negative colorIndex", async () => {
    const { status } = await request(srv.port, "PUT", "/pixels/0/0", { colorIndex: -1 });
    assert.equal(status, 400);
  });

  test("PUT /pixels/:x/:y rejects a missing colorIndex", async () => {
    const { status } = await request(srv.port, "PUT", "/pixels/0/0", {});
    assert.equal(status, 400);
  });

  test("PUT /pixels/:x/:y rejects a float colorIndex", async () => {
    const { status } = await request(srv.port, "PUT", "/pixels/0/0", { colorIndex: 1.5 });
    assert.equal(status, 400);
  });

  // ── Unknown routes ─────────────────────────────────────────────────────────

  test("GET /unknown returns 404", async () => {
    const { status } = await request(srv.port, "GET", "/unknown");
    assert.equal(status, 404);
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  test("pixels.json is written to disk after a PUT", async () => {
    await request(srv.port, "PUT", "/pixels/5/5", { colorIndex: 3 });
    const dataFile = path.join(tmpDir, "pixels.json");
    assert.ok(fs.existsSync(dataFile), "pixels.json does not exist");
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(saved.pixels["5,5"], 3);
  });
});

// ── WebSocket Tests ───────────────────────────────────────────────────────────

describe("WebSocket", () => {
  let srv, tmpDir;

  before(async () => {
    tmpDir = makeTempDir();
    srv    = await startServer({ port: 0, dataDir: tmpDir });
  });

  after(async () => {
    await srv.close();
    removeTempDir(tmpDir);
  });

  test("client can connect to /ws", async () => {
    const ws = await connectWs(srv.port);
    assert.equal(ws.readyState, WebSocket.OPEN);
    ws.close();
  });

  test("painting a pixel via WS returns pixel_ack to the sender", async () => {
    const ws  = await connectWs(srv.port);
    const ack = await sendAndReceive(ws, {
      type: "pixel_update", x: 2, y: 4, colorIndex: 3,
    });

    assert.equal(ack.type, "pixel_ack");
    assert.equal(ack.x, 2);
    assert.equal(ack.y, 4);
    assert.equal(ack.colorIndex, 3);

    ws.close();
  });

  test("pixel painted via WS is saved to disk", async () => {
    const ws = await connectWs(srv.port);
    await sendAndReceive(ws, { type: "pixel_update", x: 8, y: 8, colorIndex: 1 });

    const dataFile = path.join(tmpDir, "pixels.json");
    const saved    = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(saved.pixels["8,8"], 1);

    ws.close();
  });

  test("painting via WS broadcasts pixel_update to other connected clients", async () => {
    const painter  = await connectWs(srv.port);
    const observer = await connectWs(srv.port);

    // Set up the listener BEFORE the paint so we don't miss the message.
    const broadcastPromise = nextMessage(observer);

    painter.send(JSON.stringify({ type: "pixel_update", x: 10, y: 10, colorIndex: 4 }));

    const broadcast = await broadcastPromise;
    assert.equal(broadcast.type, "pixel_update");
    assert.equal(broadcast.x, 10);
    assert.equal(broadcast.y, 10);
    assert.equal(broadcast.colorIndex, 4);

    painter.close();
    observer.close();
  });

  test("painting via WS does NOT echo back to the sender as pixel_update", async () => {
    const painter  = await connectWs(srv.port);
    const messages = [];
    painter.on("message", (data) => messages.push(JSON.parse(data.toString())));

    painter.send(JSON.stringify({ type: "pixel_update", x: 0, y: 0, colorIndex: 1 }));

    // Wait long enough for any echo to arrive.
    await new Promise((r) => setTimeout(r, 100));

    const types = messages.map((m) => m.type);
    assert.ok(!types.includes("pixel_update"), "sender should not receive its own broadcast");
    assert.ok(types.includes("pixel_ack"),     "sender should receive pixel_ack");

    painter.close();
  });

  test("WS returns error for unknown message type", async () => {
    const ws  = await connectWs(srv.port);
    const res = await sendAndReceive(ws, { type: "something_random" });

    assert.equal(res.type, "error");

    ws.close();
  });

  test("WS returns error for invalid colorIndex", async () => {
    const ws  = await connectWs(srv.port);
    const res = await sendAndReceive(ws, {
      type: "pixel_update", x: 0, y: 0, colorIndex: -5,
    });

    assert.equal(res.type, "error");

    ws.close();
  });
});
