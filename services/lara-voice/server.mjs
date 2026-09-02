import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.LARA_VOICE_TOKEN || "";
const KOKORO_BASE_URL = process.env.KOKORO_BASE_URL || "http://127.0.0.1:8000";
const PIPER_BIN = process.env.PIPER_BIN || "piper";
const CACHE_DIR = process.env.LARA_VOICE_CACHE_DIR || join(__dirname, ".cache");
const MODEL_DIR = process.env.LARA_VOICE_MODEL_DIR || join(CACHE_DIR, "models");
const AUDIO_DIR = join(CACHE_DIR, "audio");
const MAX_TEXT_CHARS = 900;
const MAX_CACHE_FILES = Number(process.env.LARA_VOICE_MAX_CACHE_FILES || 200);
const ENGINE_TIMEOUT_MS = Number(process.env.LARA_VOICE_ENGINE_TIMEOUT_MS || 20000);
const MOCK_AUDIO = process.env.LARA_VOICE_MOCK === "1";

const languageRoutes = {
  "en-US": { engine: "kokoro", kokoroLang: "a", piperLocale: "en_US" },
  "hi-IN": { engine: "kokoro", kokoroLang: "h", piperLocale: "hi_IN" },
  "ru-RU": { engine: "piper", piperLocale: "ru_RU" },
  "zh-CN": { engine: "kokoro", kokoroLang: "z", piperLocale: "zh_CN" },
  "fa-IR": { engine: "piper", piperLocale: "fa_IR" },
};

const voiceProfiles = {
  lara: {
    "en-US": { engine: "kokoro", voice: "af_bella", piperVoice: "en_US-amy-medium" },
    "hi-IN": { engine: "kokoro", voice: "hf_alpha", piperVoice: "hi_IN-priyamvada-medium" },
    "ru-RU": { engine: "piper", voice: "ru_RU-irina-medium" },
    "zh-CN": { engine: "kokoro", voice: "zf_xiaoxiao", piperVoice: "zh_CN-huayan-medium" },
    "fa-IR": { engine: "piper", voice: "fa_IR-ganji-medium" },
  },
  mark8lara: {
    "en-US": { engine: "kokoro", voice: "af_heart", piperVoice: "en_US-lessac-medium" },
    "hi-IN": { engine: "kokoro", voice: "hf_beta", piperVoice: "hi_IN-pratham-medium" },
    "ru-RU": { engine: "piper", voice: "ru_RU-irina-medium" },
    "zh-CN": { engine: "kokoro", voice: "zf_xiaoyi", piperVoice: "zh_CN-huayan-medium" },
    "fa-IR": { engine: "piper", voice: "fa_IR-ganji_adabi-medium" },
  },
};

const piperModels = {
  "en_US-amy-medium": ["en/en_US/amy/medium/en_US-amy-medium.onnx", "en/en_US/amy/medium/en_US-amy-medium.onnx.json"],
  "en_US-lessac-medium": ["en/en_US/lessac/medium/en_US-lessac-medium.onnx", "en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"],
  "hi_IN-priyamvada-medium": ["hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx", "hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx.json"],
  "hi_IN-pratham-medium": ["hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx", "hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json"],
  "ru_RU-irina-medium": ["ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx", "ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json"],
  "zh_CN-huayan-medium": ["zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx", "zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json"],
  "fa_IR-ganji-medium": ["fa/fa_IR/ganji/medium/fa_IR-ganji-medium.onnx", "fa/fa_IR/ganji/medium/fa_IR-ganji-medium.onnx.json"],
  "fa_IR-ganji_adabi-medium": ["fa/fa_IR/ganji_adabi/medium/fa_IR-ganji_adabi-medium.onnx", "fa/fa_IR/ganji_adabi/medium/fa_IR-ganji_adabi-medium.onnx.json"],
};

createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/healthz") {
      return json(response, 200, {
        ok: true,
        service: "lara-voice",
        engines: {
          kokoro: { url: KOKORO_BASE_URL, primaryFor: ["en-US", "hi-IN", "zh-CN"] },
          piper: { binary: PIPER_BIN, primaryFor: ["ru-RU", "fa-IR"], fallbackFor: ["en-US", "hi-IN", "zh-CN"] },
        },
      });
    }
    if (request.method !== "POST" || request.url !== "/synthesize") {
      return json(response, 404, { ok: false, error: "Not found." });
    }
    if (TOKEN && request.headers.authorization !== `Bearer ${TOKEN}`) {
      return json(response, 401, { ok: false, error: "Unauthorized." });
    }
    const parsed = validateBody(await readJson(request));
    if (!parsed.ok) return json(response, 400, { ok: false, error: parsed.error });

    const cached = await cachedAudioPath(parsed.value);
    if (cached) return audio(response, cached.path, cached.contentType, cached.engine, cached.voice, true);

    const route = selectRoute(parsed.value);
    const result = await synthesize(parsed.value, route);
    await rememberAudio(parsed.value, result);
    return audio(response, result.path, result.contentType, result.engine, result.voice, false);
  } catch (error) {
    return json(response, 500, { ok: false, error: error instanceof Error ? error.message : "Voice synthesis failed." });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.info(JSON.stringify({ event: "lara_voice_started", port: PORT }));
});

function validateBody(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "JSON body is required." };
  const assistant = body.assistant;
  const language = body.language;
  const text = String(body.text || "").replace(/\s+/g, " ").trim();
  if (!["lara", "mark8lara"].includes(assistant)) return { ok: false, error: "Unsupported assistant." };
  if (!languageRoutes[language]) return { ok: false, error: "Unsupported language." };
  if (!text) return { ok: false, error: "Text is required." };
  if (text.length > MAX_TEXT_CHARS) return { ok: false, error: `Text must be ${MAX_TEXT_CHARS} characters or less.` };
  return { ok: true, value: { assistant, language, text } };
}

function selectRoute({ assistant, language, text }) {
  const profile = voiceProfiles[assistant][language];
  if (language === "hi-IN" && isHindiHeavyRoman(text)) {
    return { engine: "kokoro", voice: profile.voice, language };
  }
  return { engine: profile.engine, voice: profile.voice, language };
}

async function synthesize(request, route) {
  if (MOCK_AUDIO) {
    const path = await writeMockWav(request, route);
    return { path, contentType: "audio/wav", engine: "mock-open-source", voice: route.voice };
  }
  if (route.engine === "kokoro") {
    try {
      return await synthesizeKokoro(request, route);
    } catch (error) {
      const fallbackVoice = voiceProfiles[request.assistant][request.language].piperVoice;
      if (!fallbackVoice) throw error;
      return synthesizePiper(request, { ...route, engine: "piper", voice: fallbackVoice });
    }
  }
  return synthesizePiper(request, route);
}

async function synthesizeKokoro(_request, route) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/v1/audio/speech", KOKORO_BASE_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "kokoro", voice: route.voice, input: _request.text, response_format: "wav" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Kokoro failed with HTTP ${response.status}`);
    const path = audioPath(_request, route, "wav");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    return { path, contentType: normalizeAudioType(response.headers.get("content-type")) || "audio/wav", engine: "kokoro", voice: route.voice };
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizePiper(request, route) {
  const files = piperModels[route.voice];
  if (!files) throw new Error(`No Piper model is configured for ${route.voice}.`);
  const [modelPath, configPath] = await ensurePiperModel(route.voice, files);
  const path = audioPath(request, route, "wav");
  await mkdir(dirname(path), { recursive: true });
  await runPiper(modelPath, configPath, path, request.text);
  return { path, contentType: "audio/wav", engine: "piper", voice: route.voice };
}

async function ensurePiperModel(voice, files) {
  const paths = files.map((file) => join(MODEL_DIR, file));
  await Promise.all(files.map(async (file, index) => {
    const path = paths[index];
    try {
      if ((await stat(path)).size > 0) return;
    } catch {}
    await mkdir(dirname(path), { recursive: true });
    const url = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${file}?download=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not download Piper model file for ${voice}.`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }));
  return paths;
}

function runPiper(modelPath, configPath, outputPath, text) {
  return new Promise((resolve, reject) => {
    const child = spawn(PIPER_BIN, ["--model", modelPath, "--config", configPath, "--output_file", outputPath], {
      shell: false,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Piper timed out."));
    }, ENGINE_TIMEOUT_MS);
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error(stderr || `Piper exited with ${code}.`));
    });
    child.stdin.end(text);
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function audio(response, path, contentType, engine, voice, cached) {
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "private, max-age=86400",
    "x-assistant-tts-engine": engine,
    "x-assistant-tts-voice": voice,
    "x-assistant-tts-cache": cached ? "hit" : "miss",
  });
  createReadStream(path).pipe(response);
}

function normalizeAudioType(value) {
  const type = value?.split(";")[0]?.toLowerCase();
  if (["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/opus"].includes(type)) return type;
  return "";
}

function audioPath(request, route, ext) {
  return join(AUDIO_DIR, `${cacheHash(request, route)}.${ext}`);
}

function cacheHash(request, route) {
  return createHash("sha256").update(JSON.stringify({ request, route })).digest("hex");
}

async function cachedAudioPath(request) {
  const route = selectRoute(request);
  for (const ext of ["wav", "mp3", "ogg", "opus"]) {
    const path = audioPath(request, route, ext);
    try {
      if ((await stat(path)).size > 44) {
        return { path, contentType: ext === "wav" ? "audio/wav" : `audio/${ext}`, engine: route.engine, voice: route.voice };
      }
    } catch {}
  }
  return null;
}

async function rememberAudio(_request, _result) {
  await trimAudioCache();
}

async function trimAudioCache() {
  await mkdir(AUDIO_DIR, { recursive: true });
  const entries = await readdir(AUDIO_DIR, { withFileTypes: true });
  const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const path = join(AUDIO_DIR, entry.name);
    const info = await stat(path);
    return { path, mtimeMs: info.mtimeMs };
  }));
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  await Promise.all(files.slice(MAX_CACHE_FILES).map((file) => rm(file.path, { force: true })));
}

function isHindiHeavyRoman(text) {
  return /\b(kya|kaise|mujhe|aapko|banana|banane|karu|karti|hoon|hain|nahi|batao|samjhao|madad|audience|campaign)\b/i.test(text);
}

async function writeMockWav(request, route) {
  const path = audioPath(request, route, "wav");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, mockWavBuffer(route.voice));
  return path;
}

function mockWavBuffer(seed) {
  const sampleRate = 16000;
  const seconds = 0.24;
  const samples = Math.floor(sampleRate * seconds);
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  const base = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const freq = 360 + (base % 180);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((2 * Math.PI * freq * index) / sampleRate) * 0.18;
    buffer.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 32767, 44 + index * 2);
  }
  return buffer;
}
