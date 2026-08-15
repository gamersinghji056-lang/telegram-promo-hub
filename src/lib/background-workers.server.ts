import { processCampaignJobs } from "./campaign-worker.server";
import {
  processAudienceDiscoveryJobs,
  processBulkJoinJobs,
  processGroupDiscoveryJobs,
} from "./customer-data.server";

declare global {
  // eslint-disable-next-line no-var
  var __wpayBackgroundWorkersStarted: boolean | undefined;
}

const DEFAULT_INTERVAL_MS = 15_000;

function intervalMs() {
  const value = Number(process.env["CAMPAIGN_WORKER_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS);
  return Number.isFinite(value) && value >= 5_000 ? value : DEFAULT_INTERVAL_MS;
}

export function startBackgroundWorkers() {
  if (globalThis.__wpayBackgroundWorkersStarted) return;
  globalThis.__wpayBackgroundWorkersStarted = true;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processCampaignJobs(Number(process.env["CAMPAIGN_WORKER_BATCH_LIMIT"] ?? 10));
      await processGroupDiscoveryJobs(Number(process.env["GROUP_DISCOVERY_BATCH_LIMIT"] ?? 5));
      await processAudienceDiscoveryJobs(Number(process.env["AUDIENCE_DISCOVERY_BATCH_LIMIT"] ?? 2));
      await processBulkJoinJobs(Number(process.env["BULK_JOIN_BATCH_LIMIT"] ?? 2));
    } catch (error) {
      console.error("Background worker failed", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  setTimeout(tick, 3_000).unref?.();
  setInterval(tick, intervalMs()).unref?.();
}
