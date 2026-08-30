import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route = createFileRoute("/contact")({ head:()=>publicPageHead("Contact","Contact MARK8BOT about Telegram Promotion, MARK or general product questions.","/contact"), component:()=> <PublicPage page="contact"/> });
