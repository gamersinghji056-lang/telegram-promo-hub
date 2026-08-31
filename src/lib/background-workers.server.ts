import { processCampaignJobs } from "./campaign-worker.server";
import {
  processAudienceDiscoveryJobs,
  processAddUsersJobs,
  processBulkJoinJobs,
  processGroupDiscoveryJobs,
} from "./customer-data.server";
import { expireInvoices } from "./billing.server";
import { processTronUsdtPayments } from "./tron-monitor.server";
import { processGrowthCollection } from "./growth-intelligence.server";

declare global {
  var __wpayBackgroundWorkersStarted: boolean | undefined;
}

const DEFAULT_INTERVAL_MS = 15_000;

type WorkerOptions = {
  orders?: boolean;
  blockchain?: boolean;
  telegram?: boolean;
};

function intervalMs() {
  const value = Number(process.env["CAMPAIGN_WORKER_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS);
  return Number.isFinite(value) && value >= 5_000 ? value : DEFAULT_INTERVAL_MS;
}

export function startBackgroundWorkers(options: WorkerOptions = { orders: true, blockchain: true, telegram: true }) {
  if (globalThis.__wpayBackgroundWorkersStarted) return;
  globalThis.__wpayBackgroundWorkersStarted = true;
  const runOrders = options.orders !== false;
  const runBlockchain = options.blockchain !== false;
  const runTelegram = options.telegram !== false;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (runOrders) {
        await processCampaignJobs(Number(process.env["CAMPAIGN_WORKER_BATCH_LIMIT"] ?? 10));
      }
      if (runBlockchain) {
        try {
          await expireInvoices();
          await processTronUsdtPayments();
        } catch (paymentError) {
          console.error("Payment worker failed", paymentError instanceof Error ? paymentError.message : paymentError);
        }
      }
      if (runTelegram) {
        await processGroupDiscoveryJobs(Number(process.env["GROUP_DISCOVERY_BATCH_LIMIT"] ?? 5));
        await processAudienceDiscoveryJobs(Number(process.env["AUDIENCE_DISCOVERY_BATCH_LIMIT"] ?? 2));
        await processBulkJoinJobs(Number(process.env["BULK_JOIN_BATCH_LIMIT"] ?? 2));
        await processAddUsersJobs(Number(process.env["ADD_USERS_BATCH_LIMIT"] ?? 1));
        await processGrowthCollection(Number(process.env["GROWTH_COLLECTION_BATCH_LIMIT"] ?? 2));
      }
    } catch (error) {
      console.error("Background worker failed", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  setTimeout(tick, 3_000).unref?.();
  setInterval(tick, intervalMs()).unref?.();
}
