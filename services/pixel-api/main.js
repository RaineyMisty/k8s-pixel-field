const path = require("path");
const { startServer } = require("./server");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");

startServer({
  host:     process.env.HOST || "0.0.0.0",
  port:     Number(process.env.PORT || 8080),
  dataDir,
  dataFile: process.env.DATA_FILE || path.join(dataDir, "pixels.json"),
}).then(({ port }) => {
  console.log(`Pixel API  →  http://0.0.0.0:${port}`);
  console.log(`WebSocket  →  ws://0.0.0.0:${port}/ws`);
});
