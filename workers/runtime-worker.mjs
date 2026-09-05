import http from "node:http";

const role = process.argv[2] || process.env.MARK8BOT_RUNTIME_ROLE || "telegram-worker";
process.env.MARK8BOT_RUNTIME_ROLE = role;

console.info(JSON.stringify({ event: "mark8bot_worker_entry_start", role }));

try {
  await import("../.output/server/_ssr/ssr.mjs");
} catch (error) {
  console.error("Failed to import built server runtime for worker startup", error);
  process.exit(1);
}

const port = Number(process.env.PORT || 8080);
const server = http.createServer((request, response) => {
  const body = JSON.stringify({ ok: true, role });
  response.writeHead(request.method === "HEAD" ? 204 : 200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (request.method !== "HEAD") response.end(body);
});

server.listen(port, "0.0.0.0", () => {
  console.info(JSON.stringify({ event: "mark8bot_worker_health_server_started", role, port }));
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
