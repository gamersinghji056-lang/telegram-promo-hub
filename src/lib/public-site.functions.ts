import { createServerFn } from "@tanstack/react-start";
import { supportSettings } from "./customer-data.server";
import { telegramSettings } from "./telegram.server";

export const getPublicProductConfig = createServerFn({ method: "GET" }).handler(async () => {
  const [telegram, support] = await Promise.all([telegramSettings(), supportSettings()]);
  const username = telegram.bot_username.replace(/^@/, "").trim();
  return {
    promotion: {
      status: "live" as const,
      botUrl: username ? `https://t.me/${encodeURIComponent(username)}?start=website` : null,
    },
    mark: { status: "coming_soon" as const },
    support: {
      telegramUrl: support.telegramUrl || null,
      email: support.email || null,
    },
  };
});
