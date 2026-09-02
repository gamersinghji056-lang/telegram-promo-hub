import { normalizeLanguage, type AssistantLanguage } from "./assistant-knowledge";

export type AssistantVoiceId = "lara" | "mark8lara";
export type TtsEngine = "kokoro" | "piper" | "browser";

export type AssistantTtsRequest = {
  assistant: AssistantVoiceId;
  language: AssistantLanguage;
  text: string;
};

export type AssistantVoiceRoute = {
  engine: TtsEngine;
  voice: string;
  locale: string;
  fallbackEngine?: TtsEngine;
};

export const ASSISTANT_TTS_MAX_CHARS = 900;
export const ASSISTANT_TTS_TIMEOUT_MS = 22000;

export const assistantVoiceProfiles: Record<AssistantVoiceId, {
  label: string;
  persona: string;
  voices: Record<AssistantLanguage, AssistantVoiceRoute>;
}> = {
  lara: {
    label: "LARA",
    persona: "female, clear, modern, friendly, slightly energetic Promotion identity",
    voices: {
      "en-US": { engine: "kokoro", voice: "af_bella", locale: "en-US", fallbackEngine: "piper" },
      "hi-IN": { engine: "kokoro", voice: "hf_alpha", locale: "hi-IN", fallbackEngine: "piper" },
      "ru-RU": { engine: "piper", voice: "ru_RU-irina-medium", locale: "ru-RU", fallbackEngine: "browser" },
      "zh-CN": { engine: "kokoro", voice: "zf_xiaoxiao", locale: "zh-CN", fallbackEngine: "piper" },
      "fa-IR": { engine: "piper", voice: "fa_IR-ganji-medium", locale: "fa-IR", fallbackEngine: "browser" },
    },
  },
  mark8lara: {
    label: "MARK8LARA",
    persona: "different female, mature, premium, calm MARK8BOT identity",
    voices: {
      "en-US": { engine: "kokoro", voice: "af_heart", locale: "en-US", fallbackEngine: "piper" },
      "hi-IN": { engine: "kokoro", voice: "hf_beta", locale: "hi-IN", fallbackEngine: "piper" },
      "ru-RU": { engine: "piper", voice: "ru_RU-irina-medium", locale: "ru-RU", fallbackEngine: "browser" },
      "zh-CN": { engine: "kokoro", voice: "zf_xiaoyi", locale: "zh-CN", fallbackEngine: "piper" },
      "fa-IR": { engine: "piper", voice: "fa_IR-ganji_adabi-medium", locale: "fa-IR", fallbackEngine: "browser" },
    },
  },
};

export function assistantIdFromName(name: string): AssistantVoiceId {
  return name.toLowerCase() === "mark8lara" ? "mark8lara" : "lara";
}

export function routeAssistantVoice(request: AssistantTtsRequest): AssistantVoiceRoute {
  return assistantVoiceProfiles[request.assistant].voices[request.language];
}

export function parseAssistantTtsRequest(payload: unknown): { ok: true; value: AssistantTtsRequest } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") return { ok: false, error: "JSON body is required." };
  const body = payload as Record<string, unknown>;
  const assistant = body["assistant"];
  const language = normalizeLanguage(String(body["language"] ?? ""));
  const text = String(body["text"] ?? "").replace(/\s+/g, " ").trim();
  if (assistant !== "lara" && assistant !== "mark8lara") return { ok: false, error: "Unsupported assistant." };
  if (!language) return { ok: false, error: "Unsupported language." };
  if (!text) return { ok: false, error: "Text is required." };
  if (text.length > ASSISTANT_TTS_MAX_CHARS) return { ok: false, error: `Text must be ${ASSISTANT_TTS_MAX_CHARS} characters or less.` };
  return { ok: true, value: { assistant, language, text } };
}

export function ttsCacheKey(request: AssistantTtsRequest) {
  return `${request.assistant}:${request.language}:${request.text}`;
}
