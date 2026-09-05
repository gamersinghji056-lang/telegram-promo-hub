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
const TELEGRAM_DISCOVERY_INTERVAL_MS = 5_000;

type WorkerOptions = {
  orders?: boolean;
  blockchain?: boolean;
  telegram?: boolean;
};

type WorkerTask = {
  name: string;
  interval: number;
  run: () => Promise<unknown>;
  timer?: NodeJS.Timeout;
  running: boolean;
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

  const tasks: WorkerTask[] = [];
  const addTask = (task: Omit<WorkerTask, "timer" | "running">) => {
    tasks.push({ ...task, running: false });
  };

  const runTask = async (task: WorkerTask) => {
    if (task.running) return;
    task.running = true;
    try {
      await task.run();
    } catch (error) {
      const label = task.name === "Payment" ? "Payment worker failed" : `${task.name} worker failed`;
      console.error(label, error instanceof Error ? error.message : error);
    } finally {
      task.running = false;
    }
  };

  if (runOrders) {
    addTask({
      name: "Campaign",
      interval: intervalMs(),
      run: () => processCampaignJobs(Number(process.env["CAMPAIGN_WORKER_BATCH_LIMIT"] ?? 10)),
    });
  }
  if (runBlockchain) {
    addTask({
      name: "Payment",
      interval: intervalMs(),
      run: async () => {
        await expireInvoices();
        await processTronUsdtPayments();
      },
    });
  }
  if (runTelegram) {
    addTask({
      name: "Group discovery",
      interval: Number(process.env["GROUP_DISCOVERY_WORKER_INTERVAL_MS"] ?? TELEGRAM_DISCOVERY_INTERVAL_MS),
      run: () => processGroupDiscoveryJobs(Number(process.env["GROUP_DISCOVERY_BATCH_LIMIT"] ?? 5)),
    });
    addTask({
      name: "Audience discovery",
      interval: Number(process.env["AUDIENCE_DISCOVERY_WORKER_INTERVAL_MS"] ?? TELEGRAM_DISCOVERY_INTERVAL_MS),
      run: () => processAudienceDiscoveryJobs(Number(process.env["AUDIENCE_DISCOVERY_BATCH_LIMIT"] ?? 2)),
    });
    addTask({
      name: "Bulk join",
      interval: intervalMs(),
      run: () => processBulkJoinJobs(Number(process.env["BULK_JOIN_BATCH_LIMIT"] ?? 2)),
    });
    addTask({
      name: "Add Users",
      interval: intervalMs(),
      run: () => processAddUsersJobs(Number(process.env["ADD_USERS_BATCH_LIMIT"] ?? 1)),
    });
    addTask({
      name: "Growth collection",
      interval: intervalMs(),
      run: () => processGrowthCollection(Number(process.env["GROWTH_COLLECTION_BATCH_LIMIT"] ?? 2)),
    });
  }

  for (const task of tasks) {
    setTimeout(() => runTask(task), 3_000).unref?.();
    task.timer = setInterval(() => runTask(task), Math.max(5_000, task.interval)).unref?.();
  }
}
