import { classifyAndRecordPayment, isValidTronAddress, TRON_MAINNET_USDT_CONTRACT, usdtContract } from "./billing.server";
import { db, getSetting } from "./db.server";
import type { PaymentSettings } from "./billing.server";

const DEFAULT_TRONGRID = "https://api.trongrid.io";
const INITIAL_LOOKBACK_MS = 60 * 60_000;
const SCAN_OVERLAP_MS = 10 * 60_000;
const RECONCILIATION_WINDOW_MS = 60 * 60_000;
const MAX_SCAN_LOOKBACK_MS = 90 * 60_000;

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

type ScanDiagnostics = {
  scan_from: string;
  scan_to: string;
  overlap_ms: number;
  reconciliation_window_ms: number;
  events_found: number;
  latest_event_time: string | null;
  checkpoint_before: Record<string, unknown> | null;
  checkpoint_after: Record<string, unknown> | null;
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
    last_scanned_at: new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString(),
    status: "UNKNOWN",
  };
  await db().from("blockchain_scan_checkpoints").insert(row);
  return row;
}

async function earliestReconciliationTimestamp() {
  const floor = new Date(Date.now() - RECONCILIATION_WINDOW_MS).toISOString();
  const { data } = await db()
    .from("billing_invoices")
    .select("created_at")
    .in("status", ["PENDING", "PAYMENT_DETECTED", "CONFIRMING", "EXPIRED"])
    .gte("expires_at", floor)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.created_at ? new Date(String(data.created_at)).getTime() : null;
}

function providerHeaders() {
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env["TRONGRID_API_KEY"]) headers["TRON-PRO-API-KEY"] = process.env["TRONGRID_API_KEY"]!;
  return headers;
}

function sameAddress(a?: string | null, b?: string | null) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function eventTimestamp(event: TronGridTransfer) {
  return event.block_timestamp ? new Date(event.block_timestamp).toISOString() : null;
}

function normalizeTransferEvent(raw: Record<string, unknown>): TronGridTransfer | null {
  const result = (raw["result"] ?? raw) as Record<string, unknown>;
  const tokenInfo = (raw["token_info"] ?? {}) as Record<string, unknown>;
  const tx = String(raw["transaction_id"] ?? raw["transaction"] ?? raw["tx_id"] ?? raw["txID"] ?? "").trim();
  const to = String(result["to"] ?? raw["to"] ?? "").trim();
  const from = String(result["from"] ?? raw["from"] ?? "").trim();
  const value = String(result["value"] ?? raw["value"] ?? "0");
  const contract = String(raw["contract_address"] ?? tokenInfo["address"] ?? "").trim();
  const timestamp = Number(raw["block_timestamp"] ?? raw["timestamp"] ?? 0);
  if (!tx || !to || !value) return null;
  return {
    transaction_id: tx,
    from,
    to,
    type: String(raw["event_name"] ?? raw["type"] ?? "Transfer"),
    value,
    token_info: { address: contract, decimals: Number(tokenInfo["decimals"] ?? 6), symbol: String(tokenInfo["symbol"] ?? "USDT") },
    block_timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined,
    block: typeof raw["block_number"] === "number" ? raw["block_number"] : undefined,
    confirmed: raw["confirmed"] === false ? false : true,
  };
}

async function recordTransfer(settings: PaymentSettings, contract: string, event: TronGridTransfer) {
  if (!event.transaction_id || !event.to || event.type !== "Transfer") return null;
  if ((event.token_info?.address ?? contract) !== contract) return null;
  if (!sameAddress(event.to, settings.wallet_address)) return null;
  if (event.confirmed === false) return null;
  return classifyAndRecordPayment({
    network: "TRON",
    tokenContract: contract,
    txHash: event.transaction_id,
    fromAddress: event.from ?? null,
    toAddress: event.to,
    rawTokenAmount: event.value ?? "0",
    normalizedAmount: decimalAmount(event.value ?? "0", event.token_info?.decimals ?? 6),
    blockNumber: event.block ?? null,
    transactionTimestamp: eventTimestamp(event),
    rawEvent: event as Record<string, unknown>,
  });
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
  const now = Date.now();
  const cpTime = new Date(String(cp.last_scanned_at ?? new Date(now - INITIAL_LOOKBACK_MS).toISOString())).getTime();
  const reconciliationTime = await earliestReconciliationTimestamp();
  const scanFloor = now - MAX_SCAN_LOOKBACK_MS;
  const since = Math.max(
    0,
    scanFloor,
    Math.min(
      Number.isFinite(cpTime) ? cpTime - SCAN_OVERLAP_MS : now - INITIAL_LOOKBACK_MS,
      reconciliationTime ?? now,
    ),
  );
  const scanTo = now;
  const url = new URL(`${endpoint(settings)}/v1/accounts/${settings.wallet_address}/transactions/trc20`);
  url.searchParams.set("only_confirmed", "true");
  url.searchParams.set("limit", "50");
  url.searchParams.set("min_timestamp", String(since));
  url.searchParams.set("contract_address", contract);
  const diagnostics: ScanDiagnostics = {
    scan_from: new Date(since).toISOString(),
    scan_to: new Date(scanTo).toISOString(),
    overlap_ms: SCAN_OVERLAP_MS,
    reconciliation_window_ms: RECONCILIATION_WINDOW_MS,
    events_found: 0,
    latest_event_time: null,
    checkpoint_before: {
      last_scanned_at: cp.last_scanned_at ?? null,
      last_processed_block: cp.last_processed_block ?? null,
      status: cp.status ?? null,
    },
    checkpoint_after: null,
  };

  try {
    const response = await fetch(url, { headers: providerHeaders() });
    if (!response.ok) throw new Error(`TronGrid request failed: ${response.status}`);
    const payload = (await response.json()) as { data?: TronGridTransfer[] };
    let processed = 0;
    let latestBlock: number | null = cp.last_processed_block ? Number(cp.last_processed_block) : null;
    let latestTs = Number.isFinite(cpTime) ? cpTime : since;
    for (const event of payload.data ?? []) {
      const result = await recordTransfer(settings, contract, event);
      if (!result) continue;
      latestTs = Math.max(latestTs, event.block_timestamp ?? latestTs);
      latestBlock = event.block ? Math.max(latestBlock ?? 0, event.block) : latestBlock;
      processed += 1;
    }
    diagnostics.events_found = payload.data?.length ?? 0;
    diagnostics.latest_event_time = latestTs > 0 ? new Date(latestTs).toISOString() : null;
    const checkpointAfter = {
      last_scanned_at: latestTs > cpTime ? new Date(latestTs).toISOString() : cp.last_scanned_at,
      last_processed_block: latestBlock,
      status: "HEALTHY",
    };
    diagnostics.checkpoint_after = checkpointAfter;
    await db().from("blockchain_scan_checkpoints").upsert(
      {
        id: checkpointId(settings),
        network: "TRON",
        token_contract: contract,
        receiving_address: settings.wallet_address,
        last_scanned_at: checkpointAfter.last_scanned_at,
        last_processed_block: latestBlock,
        last_success_at: new Date().toISOString(),
        last_error: null,
        status: "HEALTHY",
        cursor_data: diagnostics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    console.info("TRON_MONITOR_SCAN", diagnostics);
    return { scanned: payload.data?.length ?? 0, processed, diagnostics };
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
        cursor_data: { ...diagnostics, error: message },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    throw error;
  }
}

export async function traceInvoiceTransaction(invoiceId: string, txHash: string) {
  const settings = await getSetting<PaymentSettings>("payments");
  if (!monitorEnabled(settings)) throw new Error("TRON monitor is not configured.");
  const contract = usdtContract(settings);
  const { data: invoice } = await db().from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");
  const endpointUrl = new URL(`${endpoint(settings)}/v1/transactions/${txHash.trim()}/events`);
  endpointUrl.searchParams.set("only_confirmed", "true");
  const response = await fetch(endpointUrl, { headers: providerHeaders() });
  if (!response.ok) throw new Error(`TronGrid trace failed: ${response.status}`);
  const payload = (await response.json()) as { data?: Record<string, unknown>[] };
  const transfers = (payload.data ?? []).map(normalizeTransferEvent).filter(Boolean) as TronGridTransfer[];
  const event = transfers.find((item) => item.transaction_id === txHash.trim() && item.type === "Transfer");
  if (!event) {
    return { ok: false, status: "MISMATCH", reason: "No confirmed TRC20 Transfer event was found for this transaction hash." };
  }
  const mismatches: string[] = [];
  if ((event.token_info?.address ?? "") !== String(invoice.token_contract)) mismatches.push("token contract does not match invoice");
  if (!sameAddress(event.to, String(invoice.receiving_address))) mismatches.push("recipient address does not match invoice");
  const amount = decimalAmount(event.value ?? "0", event.token_info?.decimals ?? 6).toFixed(6);
  if (amount !== Number(invoice.payable_amount).toFixed(6)) mismatches.push("amount does not match invoice");
  if (event.confirmed === false) mismatches.push("transaction is not confirmed");
  if (mismatches.length) {
    return { ok: false, status: "MISMATCH", reason: mismatches.join("; "), event: { to: event.to, amount, contract: event.token_info?.address ?? null, timestamp: eventTimestamp(event) } };
  }
  const result = await recordTransfer(settings, contract, event);
  return { ok: true, status: "PROCESSED", result };
}
