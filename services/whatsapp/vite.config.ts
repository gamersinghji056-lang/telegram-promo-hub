import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Connect } from "vite";
import { healthPayload } from "./src/lib/health";

function createHealthHandler() {
  return (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
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
  configureServer(server: { middlewares: { use: (middleware: Connect.NextHandleFunction) => void } }) {
    server.middlewares.use(createHealthHandler());
  },
  configurePreviewServer(server: { middlewares: { use: (middleware: Connect.NextHandleFunction) => void } }) {
    server.middlewares.use(createHealthHandler());
  },
};

export default defineConfig({
  plugins: [react(), healthRoutePlugin],
});
