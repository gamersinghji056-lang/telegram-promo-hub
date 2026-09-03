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
  const cleaned = cleanSpeechText(text);
  if (language === "hi-IN") return normalizeHindiSpeech(cleaned, assistant);
  if (language === "ru-RU") return normalizeRussianSpeech(cleaned, assistant);
  if (language === "zh-CN") return normalizeChineseSpeech(cleaned, assistant);
  if (language === "fa-IR") return normalizePersianSpeech(cleaned, assistant);
  return normalizeEnglishSpeech(cleaned, assistant);
}

const hindiTtsWords: Record<string, string> = {
  mujhe: "\u092e\u0941\u091d\u0947",
  muje: "\u092e\u0941\u091d\u0947",
  main: "\u092e\u0948\u0902",
  mai: "\u092e\u0948\u0902",
  me: "\u092e\u0947\u0902",
  mein: "\u092e\u0947\u0902",
  mera: "\u092e\u0947\u0930\u093e",
  meri: "\u092e\u0947\u0930\u0940",
  mere: "\u092e\u0947\u0930\u0947",
  aap: "\u0906\u092a",
  aapko: "\u0906\u092a\u0915\u094b",
  aapki: "\u0906\u092a\u0915\u0940",
  apni: "\u0905\u092a\u0928\u0940",
  apne: "\u0905\u092a\u0928\u0947",
  batao: "\u092c\u0924\u093e\u0913",
  btao: "\u092c\u0924\u093e\u0913",
  samjhao: "\u0938\u092e\u091d\u093e\u0913",
  kaise: "\u0915\u0948\u0938\u0947",
  kese: "\u0915\u0948\u0938\u0947",
  kaha: "\u0915\u0939\u093e\u0901",
  kahan: "\u0915\u0939\u093e\u0901",
  kidhar: "\u0915\u093f\u0927\u0930",
  karna: "\u0915\u0930\u0928\u093e",
  krna: "\u0915\u0930\u0928\u093e",
  karo: "\u0915\u0930\u094b",
  karu: "\u0915\u0930\u0942\u0902",
  kru: "\u0915\u0930\u0942\u0902",
  sakti: "\u0938\u0915\u0924\u0940",
  sakte: "\u0938\u0915\u0924\u0947",
  hoon: "\u0939\u0942\u0901",
  hu: "\u0939\u0942\u0901",
  hai: "\u0939\u0948",
  hain: "\u0939\u0948\u0902",
  nahi: "\u0928\u0939\u0940\u0902",
  nhi: "\u0928\u0939\u0940\u0902",
  chahiye: "\u091a\u093e\u0939\u093f\u090f",
  chaiye: "\u091a\u093e\u0939\u093f\u090f",
  banana: "\u092c\u0928\u093e\u0928\u093e",
  banane: "\u092c\u0928\u093e\u0928\u0947",
  banega: "\u092c\u0928\u0947\u0917\u093e",
  banegi: "\u092c\u0928\u0947\u0917\u0940",
  banau: "\u092c\u0928\u093e\u090a\u0901",
  banaya: "\u092c\u0928\u093e\u092f\u093e",
  kholo: "\u0916\u094b\u0932\u094b",
  milenge: "\u092e\u093f\u0932\u0947\u0902\u0917\u0947",
  milega: "\u092e\u093f\u0932\u0947\u0917\u093e",
  milegi: "\u092e\u093f\u0932\u0947\u0917\u0940",
  phir: "\u092b\u093f\u0930",
  fir: "\u092b\u093f\u0930",
  ab: "\u0905\u092c",
  aur: "\u0914\u0930",
  ya: "\u092f\u093e",
  se: "\u0938\u0947",
  par: "\u092a\u0930",
  pe: "\u092a\u0930",
  ke: "\u0915\u0947",
  ki: "\u0915\u0940",
  ko: "\u0915\u094b",
  liye: "\u0932\u093f\u090f",
  wala: "\u0935\u093e\u0932\u093e",
  wali: "\u0935\u093e\u0932\u0940",
  vali: "\u0935\u093e\u0932\u0940",
};

const pronunciationLexicon: Record<AssistantLanguage, Record<string, string>> = {
  "en-US": {
    DM: "D M",
    UPI: "U P I",
    MARK8BOT: "MARK eight bot",
    MARK8LARA: "MARK eight LARA",
    LARA: "Laara",
    "Mini App": "Mini app",
  },
  "hi-IN": {
    "Telegram Promotion": "\u091f\u0947\u0932\u0940\u0917\u094d\u0930\u093e\u092e \u092a\u094d\u0930\u092e\u094b\u0936\u0928",
    Telegram: "\u091f\u0947\u0932\u0940\u0917\u094d\u0930\u093e\u092e",
    MARK8BOT: "\u092e\u093e\u0930\u094d\u0915 \u090f\u091f \u092c\u0949\u091f",
    MARK8LARA: "\u092e\u093e\u0930\u094d\u0915 \u090f\u091f \u0932\u093e\u0930\u093e",
    LARA: "\u0932\u093e\u0930\u093e",
    "Group Campaign": "\u0917\u094d\u0930\u0941\u092a \u0915\u0948\u0902\u092a\u0947\u0928",
    "DM Promotion": "\u0921\u0940 \u090f\u092e \u092a\u094d\u0930\u092e\u094b\u0936\u0928",
    "Approved Groups": "\u0905\u092a\u094d\u0930\u0942\u0935\u094d\u0921 \u0917\u094d\u0930\u0941\u092a\u094d\u0938",
    "Joined Groups": "\u091c\u0949\u0907\u0928\u094d\u0921 \u0917\u094d\u0930\u0941\u092a\u094d\u0938",
    "Growth Intelligence": "\u0917\u094d\u0930\u094b\u0925 \u0907\u0902\u091f\u0947\u0932\u093f\u091c\u0947\u0902\u0938",
    "Add Users": "\u0910\u0921 \u092f\u0942\u091c\u0930\u094d\u0938",
    "Mini App": "\u092e\u093f\u0928\u0940 \u0910\u092a",
    Campaigns: "\u0915\u0948\u0902\u092a\u0947\u0928\u094d\u0938",
    Campaign: "\u0915\u0948\u0902\u092a\u0947\u0928",
    Audience: "\u0911\u0921\u093f\u092f\u0902\u0938",
    Groups: "\u0917\u094d\u0930\u0941\u092a\u094d\u0938",
    groups: "\u0917\u094d\u0930\u0941\u092a\u094d\u0938",
    Session: "\u0938\u0947\u0936\u0928",
    Sessions: "\u0938\u0947\u0936\u0928\u094d\u0938",
    Analytics: "\u090f\u0928\u093e\u0932\u093f\u091f\u093f\u0915\u094d\u0938",
    Billing: "\u092c\u093f\u0932\u093f\u0902\u0917",
    Settings: "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938",
    DM: "\u0921\u0940 \u090f\u092e",
    UPI: "\u092f\u0942 \u092a\u0940 \u0906\u0908",
  },
  "ru-RU": {
    Telegram: "\u0422\u0435\u043b\u0435\u0433\u0440\u0430\u043c",
    MARK8BOT: "\u041c\u0430\u0440\u043a \u044d\u0439\u0442 \u0431\u043e\u0442",
    MARK8LARA: "\u041c\u0430\u0440\u043a \u044d\u0439\u0442 \u041b\u0430\u0440\u0430",
    LARA: "\u041b\u0430\u0440\u0430",
    DM: "\u0434\u0438 \u044d\u043c",
    "Mini App": "\u043c\u0438\u043d\u0438-\u0430\u043f\u043f",
    Campaigns: "\u043a\u0430\u043c\u043f\u0435\u0439\u043d\u0441",
    Campaign: "\u043a\u0430\u043c\u043f\u0435\u0439\u043d",
    Audience: "\u0430\u0443\u0434\u0438\u0435\u043d\u0441",
  },
  "zh-CN": {
    Telegram: "\u7535\u62a5",
    MARK8BOT: "\u9a6c\u514b\u516b\u673a\u5668\u4eba",
    MARK8LARA: "\u9a6c\u514b\u516b\u62c9\u62c9",
    LARA: "\u62c9\u62c9",
    DM: "D M",
    "Mini App": "\u5c0f\u7a0b\u5e8f",
    Campaigns: "\u6d3b\u52a8",
    Campaign: "\u6d3b\u52a8",
    Audience: "\u53d7\u4f17",
  },
  "fa-IR": {
    Telegram: "\u062a\u0644\u06af\u0631\u0627\u0645",
    MARK8BOT: "\u0645\u0627\u0631\u06a9 \u0627\u06cc\u062a \u0628\u0627\u062a",
    MARK8LARA: "\u0645\u0627\u0631\u06a9 \u0627\u06cc\u062a \u0644\u0627\u0631\u0627",
    LARA: "\u0644\u0627\u0631\u0627",
    DM: "\u062f\u06cc \u0627\u0645",
    "Mini App": "\u0645\u06cc\u0646\u06cc \u0627\u067e",
    Campaigns: "\u06a9\u0645\u067e\u06cc\u0646\u200c\u0647\u0627",
    Campaign: "\u06a9\u0645\u067e\u06cc\u0646",
    Audience: "\u0645\u062e\u0627\u0637\u0628\u0627\u0646",
  },
};

function cleanSpeechText(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, " link ")
    .replace(/[`*_#>~[\]()]/g, " ")
    .replace(/[\u{1f300}-\u{1faff}]/gu, " ")
    .replace(/[!?]{2,}/g, ".")
    .replace(/[-\u2013\u2014]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnglishSpeech(text: string, assistant: AssistantVoiceId) {
  return applyPronunciationLexicon(text, "en-US", assistant);
}

function normalizeHindiSpeech(text: string, assistant: AssistantVoiceId) {
  return applyPronunciationLexicon(text, "hi-IN", assistant)
    .split(/(\s+|[,.])/)
    .map((part) => hindiTtsWords[part.toLowerCase()] ?? part)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRussianSpeech(text: string, assistant: AssistantVoiceId) {
  return applyPronunciationLexicon(text, "ru-RU", assistant);
}

function normalizeChineseSpeech(text: string, assistant: AssistantVoiceId) {
  return applyPronunciationLexicon(text, "zh-CN", assistant);
}

function normalizePersianSpeech(text: string, assistant: AssistantVoiceId) {
  return applyPronunciationLexicon(text, "fa-IR", assistant);
}

function applyPronunciationLexicon(text: string, language: AssistantLanguage, assistant: AssistantVoiceId) {
  const lexicon = {
    ...pronunciationLexicon[language],
    ...(language === "en-US" && assistant === "mark8lara" ? { LARA: "LARA" } : {}),
  };
  return Object.entries(lexicon)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((value, [term, replacement]) => {
      return value.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"), ` ${replacement} `);
    }, text)
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
