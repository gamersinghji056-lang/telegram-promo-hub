import {
  CLIENT_KOKORO_INIT_TIMEOUT_MS,
  CLIENT_KOKORO_SYNTH_TIMEOUT_MS,
  clientKokoroRoute,
  type AssistantTtsRequest,
} from "./assistant-voice";

type ClientKokoroStatus = "idle" | "initializing" | "ready" | "unavailable" | "failed";

type WorkerSuccess = {
  ok: true;
  id: number;
  audio: ArrayBuffer;
  contentType: string;
  engine: "client-kokoro";
  voice: string;
  backend: "webgpu";
  timings: { initMs: number; synthMs: number; cached: boolean };
};

type WorkerFailure = {
  ok: false;
  id: number;
  error: string;
  fallback: "piper";
  status?: ClientKokoroStatus;
  backend?: "webgpu";
};

type WorkerMessage = WorkerSuccess | WorkerFailure;

type PendingRequest = {
  resolve: (value: ClientKokoroAudio) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

export type ClientKokoroAudio = {
  blob: Blob;
  engine: "client-kokoro";
  voice: string;
  backend: "webgpu";
  timings: { initMs: number; synthMs: number; cached: boolean };
};

export type ClientKokoroCapability = {
  supported: boolean;
  reason: string;
  backend: "webgpu" | "piper";
  wasmPolicy: "skip-interactive";
};

let worker: Worker | null = null;
let nextRequestId = 1;
let capability: ClientKokoroCapability | null = null;
const pending = new Map<number, PendingRequest>();

export function getClientKokoroCapability(): ClientKokoroCapability {
  if (capability) return capability;
  if (typeof window === "undefined") {
    capability = { supported: false, reason: "Server render cannot run client Kokoro.", backend: "piper", wasmPolicy: "skip-interactive" };
    return capability;
  }
  if (typeof Worker === "undefined") {
    capability = { supported: false, reason: "This browser does not support Web Workers.", backend: "piper", wasmPolicy: "skip-interactive" };
    return capability;
  }
  if (!("gpu" in navigator)) {
    capability = { supported: false, reason: "WebGPU is unavailable; WASM is skipped for interactive voice latency.", backend: "piper", wasmPolicy: "skip-interactive" };
    return capability;
  }
  capability = { supported: true, reason: "WebGPU is available.", backend: "webgpu", wasmPolicy: "skip-interactive" };
  return capability;
}

export function canUseClientKokoro(request: AssistantTtsRequest) {
  return Boolean(clientKokoroRoute(request)) && getClientKokoroCapability().supported;
}

export async function synthesizeClientKokoro(request: AssistantTtsRequest): Promise<ClientKokoroAudio> {
  const route = clientKokoroRoute(request);
  if (!route) throw new Error("Client Kokoro does not support this language.");
  const detected = getClientKokoroCapability();
  if (!detected.supported) throw new Error(detected.reason);
  const activeWorker = ensureWorker();
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("Client Kokoro timed out."));
    }, CLIENT_KOKORO_INIT_TIMEOUT_MS + CLIENT_KOKORO_SYNTH_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timeoutId });
    activeWorker.postMessage({ type: "synthesize", id, request, voice: route.voice });
  });
}

export function cancelClientKokoroSynthesis() {
  for (const [id, item] of pending) {
    window.clearTimeout(item.timeoutId);
    item.reject(new Error("Client Kokoro synthesis cancelled."));
    pending.delete(id);
  }
  worker?.postMessage({ type: "cancel" });
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./client-kokoro-tts.worker.ts", import.meta.url), { type: "module", name: "lara-client-kokoro" });
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    window.clearTimeout(item.timeoutId);
    if (!message.ok) {
      item.reject(new Error(message.error));
      return;
    }
    item.resolve({
      blob: new Blob([message.audio], { type: message.contentType }),
      engine: message.engine,
      voice: message.voice,
      backend: message.backend,
      timings: message.timings,
    });
  };
  worker.onerror = () => {
    for (const [id, item] of pending) {
      window.clearTimeout(item.timeoutId);
      item.reject(new Error("Client Kokoro worker failed."));
      pending.delete(id);
    }
  };
  return worker;
}
