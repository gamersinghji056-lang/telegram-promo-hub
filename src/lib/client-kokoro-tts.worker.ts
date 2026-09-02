import { KokoroTTS } from "kokoro-js";
import {
  CLIENT_KOKORO_DTYPE,
  CLIENT_KOKORO_MODEL_ID,
  CLIENT_KOKORO_SYNTH_TIMEOUT_MS,
  type AssistantTtsRequest,
} from "./assistant-voice";

type KokoroAudio = { toBlob: () => Blob };
type KokoroSession = {
  voices: Record<string, unknown>;
  generate: (text: string, options: { voice: string; speed?: number }) => Promise<KokoroAudio>;
};

type RequestMessage = {
  type: "synthesize";
  id: number;
  request: AssistantTtsRequest;
  voice: string;
};

type CancelMessage = { type: "cancel" };
type WorkerScope = {
  onmessage: ((event: MessageEvent<RequestMessage | CancelMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let sessionPromise: Promise<{ tts: KokoroSession; initMs: number; cached: boolean }> | null = null;
let initializedOnce = false;
let generationToken = 0;
const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event: MessageEvent<RequestMessage | CancelMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    generationToken += 1;
    return;
  }
  void synthesize(message);
};

async function synthesize(message: RequestMessage) {
  const started = performance.now();
  const token = generationToken;
  try {
    if (message.request.language !== "en-US") throw new Error("Client Kokoro is enabled only for English in this runtime.");
    const { tts, initMs, cached } = await getSession();
    if (token !== generationToken) throw new Error("Client Kokoro synthesis cancelled.");
    if (!Object.prototype.hasOwnProperty.call(tts.voices, message.voice)) throw new Error(`Client Kokoro voice ${message.voice} is unavailable.`);
    const audio = await withTimeout(
      tts.generate(message.request.text, { voice: message.voice, speed: 1 }),
      CLIENT_KOKORO_SYNTH_TIMEOUT_MS,
      "Client Kokoro synthesis timed out.",
    );
    if (token !== generationToken) throw new Error("Client Kokoro synthesis cancelled.");
    const blob = audio.toBlob();
    const buffer = await blob.arrayBuffer();
    workerScope.postMessage({
      ok: true,
      id: message.id,
      audio: buffer,
      contentType: blob.type || "audio/wav",
      engine: "client-kokoro",
      voice: message.voice,
      backend: "webgpu",
      timings: { initMs: Math.round(initMs), synthMs: Math.round(performance.now() - started - initMs), cached },
    }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      id: message.id,
      error: error instanceof Error ? error.message : "Client Kokoro failed.",
      fallback: "piper",
      backend: "webgpu",
    });
  }
}

async function getSession() {
  if (!sessionPromise) {
    const started = performance.now();
    const cached = initializedOnce;
    sessionPromise = KokoroTTS.from_pretrained(CLIENT_KOKORO_MODEL_ID, {
      dtype: CLIENT_KOKORO_DTYPE,
      device: "webgpu",
    }).then((tts) => {
      initializedOnce = true;
      return { tts: tts as unknown as KokoroSession, initMs: performance.now() - started, cached };
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => {
      clearTimeout(timeoutId);
      resolve(value);
    }, (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}
