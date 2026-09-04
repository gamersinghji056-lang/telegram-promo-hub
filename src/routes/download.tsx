import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public-site";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download Telegram Promotion | MARK8BOT" },
      { name: "description", content: "Use Telegram Promotion on Android, iPhone, browser, or Telegram with the same customer account and product data." },
      { property: "og:title", content: "Download Telegram Promotion" },
      { property: "og:description", content: "Choose Android, browser, iPhone PWA, or Telegram access for Telegram Promotion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PublicPage page="download" />,
});
