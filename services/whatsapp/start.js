import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createReadStream, statSync as statFs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT) || 4173;
const host = "0.0.0.0";
const indexHtml = path.join(distDir, "index.html");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendJson(res, data, status = 200) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(payload);
}

function servePath(filePath) {
  const ext = path.extname(filePath);
  const mime = mimeTypes[ext] || "application/octet-stream";
  return { filePath, mime };
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const cleanPath = decodeURIComponent(url.pathname);

    if (cleanPath === "/health") {
      sendJson(res, { status: "ok", service: "whatsapp-web" });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    if (!existsSync(distDir) || !existsSync(indexHtml)) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Build output not found. Run npm run build first.");
      return;
    }

    const requested = cleanPath === "/" ? "/index.html" : cleanPath;
    const candidate = path.join(distDir, requested.split("/").filter(Boolean).join(path.sep));
    const target = candidate.startsWith(distDir) && existsSync(candidate) ? candidate : indexHtml;

    if (existsSync(target) && statSync(target).isFile()) {
      if (path.extname(target) === ".html" && !requested.endsWith(".html")) {
        const html = readFileSync(target, "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      const { filePath, mime } = servePath(target);
      if (req.method === "HEAD") {
        const size = statFs(filePath).size;
        res.writeHead(200, {
          "content-type": mime,
          "content-length": size,
        });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": mime });
      createReadStream(filePath).pipe(res);
      return;
    }

    const indexContents = readFileSync(indexHtml);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(indexContents);
  } catch (error) {
    console.error("Failed to handle WhatsApp service request", error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`MARK WhatsApp service listening on http://${host}:${port}`);
});
