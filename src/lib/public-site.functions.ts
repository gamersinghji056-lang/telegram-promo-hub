import { createServerFn } from "@tanstack/react-start";
import { supportSettings } from "./customer-data.server";
import { telegramSettings } from "./telegram.server";

export const getPublicProductConfig = createServerFn({ method: "GET" }).handler(async () => {
  const [telegram, support] = await Promise.all([telegramSettings(), supportSettings()]);
  const username = telegram.bot_username.replace(/^@/, "").trim();
  const supportUsername = support.telegramUsername || "laura_luxee";
  return {
    promotion: {
      status: "live" as const,
      botUrl: username ? `https://t.me/${encodeURIComponent(username)}?start=website` : null,
    },
    mark: { status: "coming_soon" as const },
    support: {
      telegramUsername: supportUsername,
      telegramUrl: `https://t.me/${supportUsername}`,
      email: support.email || null,
    },
  };
});
