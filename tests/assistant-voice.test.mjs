import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("assistant voice profiles route languages to open-source engines", () => {
  const voice = read("src/lib/assistant-voice.ts");
  assert(voice.includes("assistantVoiceProfiles"));
  assert(voice.includes('lara: {'));
  assert(voice.includes('mark8lara: {'));
  assert(voice.includes('"en-US": { engine: "kokoro", voice: "af_bella"'));
  assert(voice.includes('"en-US": { engine: "kokoro", voice: "af_bella", locale: "en-US", fallbackEngine: "piper"'));
  assert(voice.includes('"hi-IN": { engine: "kokoro", voice: "hf_alpha"'));
  assert(voice.includes('"zh-CN": { engine: "kokoro", voice: "zf_xiaoxiao"'));
  assert(voice.includes('"ru-RU": { engine: "piper", voice: "ru_RU-irina-medium"'));
  assert(voice.includes('"fa-IR": { engine: "piper", voice: "fa_IR-ganji-medium"'));
});

test("LARA and MARK8LARA have distinct configured voice profiles", () => {
  const voice = read("src/lib/assistant-voice.ts");
  assert(voice.includes('persona: "female, clear, modern, friendly, slightly energetic Promotion identity"'));
  assert(voice.includes('persona: "different female, mature, premium, calm MARK8BOT identity"'));
  assert(voice.includes('"en-US": { engine: "kokoro", voice: "af_heart"'));
  assert(voice.includes('"hi-IN": { engine: "kokoro", voice: "hf_beta"'));
  assert(voice.includes('"zh-CN": { engine: "kokoro", voice: "zf_xiaoyi"'));
  assert(voice.includes('"fa-IR": { engine: "piper", voice: "fa_IR-ganji_adabi-medium"'));
});

test("assistant TTS API validates input and proxies only audio", () => {
  const route = read("src/routes/api/assistant/tts.ts");
  assert(route.includes('createFileRoute("/api/assistant/tts")'));
  assert(route.includes("parseAssistantTtsRequest"));
  assert(route.includes('process.env["LARA_VOICE_URL"]'));
  assert(route.includes('process.env["LARA_VOICE_TOKEN"]'));
  assert(route.includes("ASSISTANT_TTS_TIMEOUT_MS"));
  assert(route.includes("AUDIO_TYPES"));
  assert(route.includes("Self-hosted voice service is not configured."));
  assert(route.includes('"x-assistant-tts-engine"'));
  assert(route.includes('"x-assistant-tts-voice"'));
});

test("assistant client uses self-hosted audio first and browser speech as fallback", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes('fetch("/api/assistant/tts"'));
  assert(floating.includes("new Audio(url)"));
  assert(floating.includes("audio.play()"));
  assert(floating.includes("browserSpeak(text, language, continueConversation, turn)"));
  assert(floating.includes("audioAbortRef.current?.abort()"));
  assert(floating.includes("speechTurnRef.current"));
  assert(floating.includes("if (turn === speechTurnRef.current && voiceModeRef.current) startListening(true)"));
});

test("lara-voice service config documents Kokoro/Piper and Hinglish routing", () => {
  const service = read("services/lara-voice/server.mjs");
  assert(service.includes("KOKORO_BASE_URL"));
  assert(service.includes("/v1/audio/speech"));
  assert(service.includes("PIPER_BIN"));
  assert(service.includes("ensurePiperModel"));
  assert(service.includes("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/"));
  assert(service.includes("isHindiHeavyRoman"));
  assert(service.includes('"en_US-amy-medium"'));
  assert(service.includes('"en_US-lessac-medium"'));
  assert(service.includes("MAX_CACHE_FILES"));
  assert(service.includes("spawn(PIPER_BIN"));
  assert(!service.includes("shell: true"));
});

test("lara-voice mock mode generates audio and distinct assistant voice headers", async () => {
  const port = 8897;
  const service = await startMockVoiceService(port);
  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        return response.ok;
      } catch {
        return false;
      }
    });
    const lara = await synthesize(port, "lara", "hi-IN", "Namaste, main aapko campaign banane aur audience manage karne me help kar sakti hoon.");
    const mark8lara = await synthesize(port, "mark8lara", "hi-IN", "Namaste, main aapko campaign banane aur audience manage karne me help kar sakti hoon.");
    assert.equal(lara.contentType, "audio/wav");
    assert.equal(mark8lara.contentType, "audio/wav");
    assert(lara.bytes > 44);
    assert(mark8lara.bytes > 44);
    assert.equal(lara.voice, "hf_alpha");
    assert.equal(mark8lara.voice, "hf_beta");
    assert.notEqual(lara.voice, mark8lara.voice);
  } finally {
    await service.cleanup();
  }
});

test("lara-voice mock mode rejects invalid requests", async () => {
  const port = 8898;
  const service = await startMockVoiceService(port);
  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        return response.ok;
      } catch {
        return false;
      }
    });
    const response = await fetch(`http://127.0.0.1:${port}/synthesize`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-token" },
      body: JSON.stringify({ assistant: "unknown", language: "hi-IN", text: "hello" }),
    });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /Unsupported assistant/);
  } finally {
    await service.cleanup();
  }
});

test("lara-voice mock mode generates requested multilingual sample phrases", async () => {
  const port = 8899;
  const service = await startMockVoiceService(port);
  const samples = [
    ["en-US", "Hello, I can help you manage your Telegram Promotion workspace.", "af_bella", "af_heart"],
    ["hi-IN", "नमस्ते, मैं आपके टेलीग्राम प्रमोशन वर्कस्पेस में आपकी मदद कर सकती हूँ।", "hf_alpha", "hf_beta"],
    ["hi-IN", "Namaste, main aapko campaign banane aur audience manage karne me help kar sakti hoon.", "hf_alpha", "hf_beta"],
    ["ru-RU", "Здравствуйте, я могу помочь вам с Telegram Promotion.", "ru_RU-irina-medium", "ru_RU-irina-medium"],
    ["zh-CN", "你好，我可以帮助你管理 Telegram Promotion。", "zf_xiaoxiao", "zf_xiaoyi"],
    ["fa-IR", "سلام، من می‌توانم در مدیریت Telegram Promotion به شما کمک کنم.", "fa_IR-ganji-medium", "fa_IR-ganji_adabi-medium"],
  ];
  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        return response.ok;
      } catch {
        return false;
      }
    });
    for (const [language, text, laraVoice, mark8laraVoice] of samples) {
      const lara = await synthesize(port, "lara", language, text);
      const mark8lara = await synthesize(port, "mark8lara", language, text);
      assert.equal(lara.contentType, "audio/wav");
      assert.equal(mark8lara.contentType, "audio/wav");
      assert(lara.bytes > 44);
      assert(mark8lara.bytes > 44);
      assert.equal(lara.voice, laraVoice);
      assert.equal(mark8lara.voice, mark8laraVoice);
    }
  } finally {
    await service.cleanup();
  }
});

async function synthesize(port, assistant, language, text) {
  const response = await fetch(`http://127.0.0.1:${port}/synthesize`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify({ assistant, language, text }),
  });
  const audio = await response.arrayBuffer();
  return {
    contentType: response.headers.get("content-type"),
    voice: response.headers.get("x-assistant-tts-voice"),
    bytes: audio.byteLength,
  };
}

async function startMockVoiceService(port) {
  const cacheDir = await mkdtemp(join(tmpdir(), "lara-voice-test-"));
  const child = spawn(process.execPath, ["services/lara-voice/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      LARA_VOICE_MOCK: "1",
      LARA_VOICE_TOKEN: "test-token",
      LARA_VOICE_CACHE_DIR: cacheDir,
      LARA_VOICE_MODEL_DIR: join(cacheDir, "models"),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  return {
    cleanup: async () => {
      child.kill();
      await rm(cacheDir, { recursive: true, force: true });
    },
  };
}

async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for lara-voice test server");
}
