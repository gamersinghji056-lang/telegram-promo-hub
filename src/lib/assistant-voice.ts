import { normalizeLanguage, type AssistantLanguage } from "./assistant-knowledge";

export type AssistantVoiceId = "lara" | "mark8lara";
export type TtsEngine = "client-kokoro" | "kokoro" | "piper" | "browser";

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
export const CLIENT_KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const CLIENT_KOKORO_DTYPE = "q4";
export const CLIENT_KOKORO_MODEL_SIZE = "about 80-100 MB for q4 ONNX plus voice files; browser cache stores the model after first load";
export const CLIENT_KOKORO_INIT_TIMEOUT_MS = 12000;
export const CLIENT_KOKORO_SYNTH_TIMEOUT_MS = 10000;

export const assistantVoiceProfiles: Record<AssistantVoiceId, {
  label: string;
  persona: string;
  voices: Record<AssistantLanguage, AssistantVoiceRoute>;
}> = {
  lara: {
    label: "LARA",
    persona: "female, clear, modern, friendly, slightly energetic Promotion identity",
    voices: {
      "en-US": { engine: "client-kokoro", voice: "af_bella", locale: "en-US", fallbackEngine: "piper" },
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
      "en-US": { engine: "client-kokoro", voice: "af_heart", locale: "en-US", fallbackEngine: "piper" },
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

export function clientKokoroRoute(request: AssistantTtsRequest): AssistantVoiceRoute | null {
  const route = routeAssistantVoice(request);
  if (request.language !== "en-US") return null;
  if (route.engine !== "client-kokoro") return null;
  return route;
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

export function prepareTextForSpeech(text: string, language: AssistantLanguage, assistant: AssistantVoiceId): string {
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, " link ")
    .replace(/[`*_#>~[\]()]/g, " ")
    .replace(/[\u{1f300}-\u{1faff}]/gu, " ")
    .replace(/\bDM\b/g, "D M")
    .replace(/\bUPI\b/g, "U P I")
    .replace(/\bMARK8BOT\b/g, "MARK eight bot")
    .replace(/\bMARK8LARA\b/g, "MARK eight LARA")
    .replace(/\bLARA\b/g, assistant === "mark8lara" ? "LARA" : "Laara")
    .replace(/\bMini App\b/gi, "Mini app")
    .replace(/\bTelegram\b/g, "Telegram")
    .replace(/[!?]{2,}/g, ".")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (language !== "hi-IN") return cleaned;
  return normalizeHinglishForHindiTts(cleaned);
}

const hindiTtsWords: Record<string, string> = {
  mujhe: "मुझे",
  muje: "मुझे",
  main: "मैं",
  mai: "मैं",
  me: "में",
  mein: "में",
  mera: "मेरा",
  meri: "मेरी",
  mere: "मेरे",
  aapko: "आपको",
  aapki: "आपकी",
  batao: "बताओ",
  btao: "बताओ",
  samjhao: "समझाओ",
  kaise: "कैसे",
  kese: "कैसे",
  kaha: "कहाँ",
  kahan: "कहाँ",
  kidhar: "किधर",
  karna: "करना",
  krna: "करना",
  karo: "करो",
  karu: "करूं",
  kru: "करूं",
  sakti: "सकती",
  sakte: "सकते",
  hoon: "हूँ",
  hu: "हूँ",
  hai: "है",
  hain: "हैं",
  nahi: "नहीं",
  nhi: "नहीं",
  chahiye: "चाहिए",
  chaiye: "चाहिए",
  banana: "बनाना",
  banane: "बनाने",
  banau: "बनाऊँ",
  banaya: "बनाया",
  kholo: "खोलो",
  milenge: "मिलेंगे",
  milegi: "मिलेगी",
  choose: "choose",
  select: "select",
  check: "check",
  create: "create",
  connect: "connect",
  add: "add",
  phir: "फिर",
  fir: "फिर",
  ab: "अब",
  aur: "और",
  ya: "या",
  se: "से",
  par: "पर",
  pe: "पर",
  ke: "के",
  ki: "की",
  ko: "को",
  liye: "लिए",
  wala: "वाला",
  wali: "वाली",
  vali: "वाली",
};

const speechProductTerms: Record<string, string> = {
  campaigns: "Campaigns",
  campaign: "Campaign",
  audience: "Audience",
  "approved groups": "Approved Groups",
  "joined groups": "Joined Groups",
  groups: "groups",
  group: "group",
  sessions: "Sessions",
  session: "session",
  analytics: "Analytics",
  "growth intelligence": "Growth Intelligence",
  billing: "Billing",
  settings: "Settings",
  telegram: "Telegram",
};

function normalizeHinglishForHindiTts(text: string) {
  const protectedText = Object.entries(speechProductTerms).reduce((value, [term, replacement]) => {
    return value.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"), ` ${replacement} `);
  }, text);
  return protectedText
    .split(/(\s+|[,.])/)
    .map((part) => {
      const key = part.toLowerCase();
      return hindiTtsWords[key] ?? part;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
