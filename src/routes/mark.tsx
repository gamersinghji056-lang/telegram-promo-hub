import { createFileRoute } from "@tanstack/react-router"; import { PublicPage } from "@/components/public-site"; import { publicPageHead } from "@/lib/public-meta";
export const Route = createFileRoute("/mark")({ head:()=>publicPageHead("MARK","MARK - Intelligence built around your business.","/mark"), component:()=> <PublicPage page="mark"/> });
