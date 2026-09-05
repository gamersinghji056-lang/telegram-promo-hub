import { spawn } from "node:child_process";

const port = process.env.PORT || "4173";
const command = "vite";
const args = ["preview", "--host", "0.0.0.0", "--port", String(port)];

const preview = spawn(command, args, { stdio: "inherit" });

preview.on("exit", (code) => {
  process.exit(code ?? 0);
});

preview.on("error", (error) => {
  console.error("Failed to start WhatsApp web preview server", error);
  process.exit(1);
});
