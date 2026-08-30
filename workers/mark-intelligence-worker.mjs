import { createServer } from "node:http";

const role = process.env.MARK8BOT_RUNTIME_ROLE?.trim();
if (role !== "mark-intelligence-worker") {
  throw new Error("MARK Intelligence worker requires MARK8BOT_RUNTIME_ROLE=mark-intelligence-worker");
}

const port = Number(process.env.PORT ?? 8080);
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, product: "MARK", status: "coming_soon", worker: "foundation_only" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.info(JSON.stringify({ event: "mark_intelligence_worker_ready", port, status: "foundation_only" }));
});
