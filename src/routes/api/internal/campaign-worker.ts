import { createFileRoute } from "@tanstack/react-router";
import { processCampaignJobs } from "@/lib/campaign-worker.server";

function authorized(request: Request) {
  const key = process.env["CAMPAIGN_WORKER_KEY"];
  if (!key || key.length < 16) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return provided === key;
}

export const Route = createFileRoute("/api/internal/campaign-worker")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? "10");
        const result = await processCampaignJobs(limit);
        return Response.json({ ok: true, result });
      },
    },
  },
});
