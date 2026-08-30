import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route=createFileRoute("/mark/app")({head:()=>publicPageHead("MARK Workspace — Coming Soon","The MARK Intelligence workspace is currently in development.","/mark/app"),component:()=> <PublicPage page="mark-app"/>});
