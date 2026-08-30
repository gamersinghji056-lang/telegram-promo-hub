import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route=createFileRoute("/privacy")({head:()=>publicPageHead("Privacy","A product-specific privacy baseline for MARK8BOT and its Telegram integrations.","/privacy"),component:()=> <PublicPage page="privacy"/>});
