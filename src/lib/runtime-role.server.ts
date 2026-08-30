export type RuntimeRole = "combined" | "web" | "telegram-promotion-worker";

export function runtimeRole(): RuntimeRole {
  const configured = process.env["MARK8BOT_RUNTIME_ROLE"]?.trim();
  if (!configured || configured === "combined") return "combined";
  if (configured === "web" || configured === "telegram-promotion-worker") return configured;
  throw new Error(`Unsupported MARK8BOT_RUNTIME_ROLE: ${configured}`);
}

export function shouldRunPromotionWorkers(role = runtimeRole()) {
  return role === "combined" || role === "telegram-promotion-worker";
}
