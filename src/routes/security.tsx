import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route=createFileRoute("/security")({head:()=>publicPageHead("Security","Security boundaries and operational safeguards for MARK8BOT products.","/security"),component:()=> <PublicPage page="security"/>});
