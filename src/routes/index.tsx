import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public-site";
import { publicPageHead } from "@/lib/public-meta";
export const Route = createFileRoute("/")({ head: () => publicPageHead("Telegram-first software and automation", "MARK8BOT builds intelligent Telegram products for promotion, communication and business automation.", "/"), component: () => <PublicPage page="home" /> });
