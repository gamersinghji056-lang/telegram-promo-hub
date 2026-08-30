import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route=createFileRoute("/terms")({head:()=>publicPageHead("Terms","Baseline service terms for MARK8BOT products and Telegram integrations.","/terms"),component:()=> <PublicPage page="terms"/>});
