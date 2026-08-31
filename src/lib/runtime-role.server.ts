export type RuntimeRole =
  | "combined"
  | "web"
  | "telegram-promotion-worker"
  | "telegram-worker"
  | "blockchain-worker"
  | "order-worker"
  | "promotion-bot"
  | "mark-ai";

export function runtimeRole(): RuntimeRole {
  const configured = process.env["MARK8BOT_RUNTIME_ROLE"]?.trim();
  if (!configured || configured === "combined") return "combined";
  if (
    configured === "web" ||
    configured === "telegram-promotion-worker" ||
    configured === "telegram-worker" ||
    configured === "blockchain-worker" ||
    configured === "order-worker" ||
    configured === "promotion-bot" ||
    configured === "mark-ai"
  ) return configured;
  throw new Error(`Unsupported MARK8BOT_RUNTIME_ROLE: ${configured}`);
}

export function shouldRunOrderWorkers(role = runtimeRole()) {
  return role === "combined" || role === "telegram-promotion-worker" || role === "order-worker";
}

export function shouldRunBlockchainWorkers(role = runtimeRole()) {
  return role === "combined" || role === "telegram-promotion-worker" || role === "blockchain-worker";
}

export function shouldRunTelegramWorkers(role = runtimeRole()) {
  return role === "combined" || role === "telegram-promotion-worker" || role === "telegram-worker";
}

export function shouldRunPromotionWorkers(role = runtimeRole()) {
  return shouldRunOrderWorkers(role) || shouldRunBlockchainWorkers(role) || shouldRunTelegramWorkers(role);
}
