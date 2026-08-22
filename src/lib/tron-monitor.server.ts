import { classifyAndRecordPayment, isValidTronAddress, TRON_MAINNET_USDT_CONTRACT, usdtContract } from "./billing.server";
import { db, getSetting } from "./db.server";
import type { PaymentSettings } from "./billing.server";

const DEFAULT_TRONGRID = "https://api.trongrid.io";
const LOOKBACK_MS = 20 * 60_000;

type TronGridTransfer = {
  transaction_id?: string;
  from?: string;
  to?: string;
  type?: string;
  value?: string;
  token_info?: { address?: string; decimals?: number; symbol?: string };
  block_timestamp?: number;
  block?: number;
  confirmed?: boolean;
};

function monitorEnabled(settings: PaymentSettings) {
  return Boolean(settings.payment_enabled && isValidTronAddress(settings.wallet_address));
}

function endpoint(settings: PaymentSettings) {
  return (process.env["TRONGRID_API_URL"] || DEFAULT_TRONGRID).replace(/\/$/, "");
}

function checkpointId(settings: PaymentSettings) {
  return `tron-mainnet:${usdtContract(settings)}:${settings.wallet_address}`;
}

async function checkpoint(settings: PaymentSettings) {
  const id = checkpointId(settings);
  const { data } = await db().from("blockchain_scan_checkpoints").select("*").eq("id", id).maybeSingle();
  if (data) return data;
  const row = {
    id,
    network: "TRON",
    token_contract: usdtContract(settings),
    receiving_address: settings.wallet_address,
    last_scanned_at: new Date(Date.now() - LOOKBACK_MS).toISOString(),
    status: "UNKNOWN",
  };
  await db().from("blockchain_scan_checkpoints").insert(row);
  return row;
}

function decimalAmount(raw: string, decimals = 6) {
  const value = BigInt(raw || "0");
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").slice(0, decimals);
  return Number(`${whole.toString()}.${fraction}`);
}

export async function tronMonitorHealth() {
  const settings = await getSetting<PaymentSettings>("payments");
  const cp = monitorEnabled(settings) ? await checkpoint(settings) : null;
  const lastSuccessMs = cp?.last_success_at ? new Date(String(cp.last_success_at)).getTime() : 0;
  const delayed = Boolean(lastSuccessMs && Date.now() - lastSuccessMs > 15 * 60_000);
  const { count: pending } = await db()
    .from("billing_invoices")
    .select("id", { count: "exact", head: true })
    .in("status", ["PENDING", "PAYMENT_DETECTED", "CONFIRMING"])
    .gt("expires_at", new Date().toISOString());
  return {
    configured: monitorEnabled(settings),
    network: "TRON",
    tokenContract: usdtContract(settings),
    receivingAddressConfigured: isValidTronAddress(settings.wallet_address),
    apiKeyConfigured: Boolean(process.env["TRONGRID_API_KEY"]),
    status: !monitorEnabled(settings) ? "ERROR" : cp?.status === "ERROR" ? "ERROR" : delayed ? "DELAYED" : cp?.status ?? "UNKNOWN",
    lastSuccessAt: cp?.last_success_at ?? null,
    lastScannedAt: cp?.last_scanned_at ?? null,
    lastProcessedBlock: cp?.last_processed_block ?? null,
    lastError: cp?.last_error ?? null,
    pendingInvoices: pending ?? 0,
  };
}

export async function processTronUsdtPayments() {
  const settings = await getSetting<PaymentSettings>("payments");
  if (!monitorEnabled(settings)) return { scanned: 0, processed: 0, skipped: true, reason: "TRON monitor is not configured." };
  const cp = await checkpoint(settings);
  const contract = usdtContract(settings);
  const since = Math.max(0, new Date(String(cp.last_scanned_at ?? new Date(Date.now() - LOOKBACK_MS).toISOString())).getTime() - 60_000);
  const url = new URL(`${endpoint(settings)}/v1/accounts/${settings.wallet_address}/transactions/trc20`);
  url.searchParams.set("only_confirmed", "true");
  url.searchParams.set("limit", "50");
  url.searchParams.set("min_timestamp", String(since));
  url.searchParams.set("contract_address", contract);

  try {
    const headers: HeadersInit = { accept: "application/json" };
    if (process.env["TRONGRID_API_KEY"]) headers["TRON-PRO-API-KEY"] = process.env["TRONGRID_API_KEY"]!;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`TronGrid request failed: ${response.status}`);
    const payload = (await response.json()) as { data?: TronGridTransfer[] };
    let processed = 0;
    let latestBlock: number | null = cp.last_processed_block ? Number(cp.last_processed_block) : null;
    let latestTs = Date.now();
    for (const event of payload.data ?? []) {
      if (!event.transaction_id || !event.to || event.type !== "Transfer") continue;
      if ((event.token_info?.address ?? contract) !== contract) continue;
      if (event.to !== settings.wallet_address) continue;
      if (event.confirmed === false) continue;
      const timestamp = event.block_timestamp ? new Date(event.block_timestamp).toISOString() : new Date().toISOString();
      latestTs = Math.max(latestTs, event.block_timestamp ?? latestTs);
      latestBlock = event.block ? Math.max(latestBlock ?? 0, event.block) : latestBlock;
      await classifyAndRecordPayment({
        network: "TRON",
        tokenContract: contract,
        txHash: event.transaction_id,
        fromAddress: event.from ?? null,
        toAddress: event.to,
        rawTokenAmount: event.value ?? "0",
        normalizedAmount: decimalAmount(event.value ?? "0", event.token_info?.decimals ?? 6),
        blockNumber: event.block ?? null,
        transactionTimestamp: timestamp,
        rawEvent: event as Record<string, unknown>,
      });
      processed += 1;
    }
    await db().from("blockchain_scan_checkpoints").upsert(
      {
        id: checkpointId(settings),
        network: "TRON",
        token_contract: contract,
        receiving_address: settings.wallet_address,
        last_scanned_at: new Date(latestTs || Date.now()).toISOString(),
        last_processed_block: latestBlock,
        last_success_at: new Date().toISOString(),
        last_error: null,
        status: "HEALTHY",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    return { scanned: payload.data?.length ?? 0, processed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRON monitor failed.";
    await db().from("blockchain_scan_checkpoints").upsert(
      {
        id: checkpointId(settings),
        network: "TRON",
        token_contract: contract || TRON_MAINNET_USDT_CONTRACT,
        receiving_address: settings.wallet_address,
        last_error: message,
        status: "ERROR",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    throw error;
  }
}
