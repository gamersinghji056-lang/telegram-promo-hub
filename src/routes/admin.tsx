import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Admin Console | Telegram Promotion Platform" },
    { name: "description", content: "Secure platform owner console for Telegram campaign operations." },
    { property: "og:title", content: "Telegram Promotion Admin Console" },
    { property: "og:description", content: "Secure platform operations and Telegram bot health." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Outlet,
});