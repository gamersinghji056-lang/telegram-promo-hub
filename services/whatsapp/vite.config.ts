import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { healthPayload } from "./src/lib/health";

type HealthPluginHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void
) => void;

function createHealthHandler() {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (!req.url || req.url.split("?")[0] !== "/health") {
      next();
      return;
    }

    const payload = healthPayload();
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  };
}

const healthRoutePlugin = {
  name: "whatsapp-health-route",
  configureServer(server: { middlewares: { use: (middleware: HealthPluginHandler) => void } }) {
    server.middlewares.use(createHealthHandler());
  },
  configurePreviewServer(server: { middlewares: { use: (middleware: HealthPluginHandler) => void } }) {
    server.middlewares.use(createHealthHandler());
  },
};

export default defineConfig({
  plugins: [react(), healthRoutePlugin],
});
