import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("floating assistant drags from the avatar while preserving tap-to-voice", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const styles = read("src/styles.css");
  assert(!floating.includes('closest("button") return'));
  assert(floating.includes('target.closest(".assistant-actions button")'));
  assert(floating.includes("startedOnAvatar"));
  assert(floating.includes("Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD"));
  assert(floating.includes("if (!drag.moved && drag.startedOnAvatar) startVoiceConversation()"));
  assert(floating.includes("setPointerCapture"));
  assert(floating.includes("setDraggingDocument(true)"));
  assert(floating.includes("setDraggingDocument(false)"));
  assert(styles.includes("position:fixed"));
  assert(styles.includes("touch-action:none"));
  assert(styles.includes("user-select:none"));
});

test("avatar starts hands-free voice conversation with guarded turn transitions", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes('type VoiceState = "idle" | "assistant-speaking" | "listening" | "processing"'));
  assert(floating.includes("const [voiceMode, setVoiceMode]"));
  assert(floating.includes("voiceModeRef.current = true"));
  assert(floating.includes("speak(voiceGreeting(config.name, language), language, true)"));
  assert(floating.includes("setVoiceState(\"assistant-speaking\")"));
  assert(floating.includes("setVoiceState(\"listening\")"));
  assert(floating.includes("setVoiceState(\"processing\")"));
  assert(floating.includes("recognitionStartingRef.current"));
  assert(floating.includes("if (recognitionRef.current || recognitionStartingRef.current || listening) return"));
  assert(floating.includes("Stop conversation"));
});

test("chat icon opens a full assistant page view with isolated history", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const styles = read("src/styles.css");
  assert(floating.includes("const historyStorageKey = `${config.storageKey}-chat-history`"));
  assert(floating.includes("localStorage.setItem(historyStorageKey"));
  assert(floating.includes("setFullOpen(true)"));
  assert(floating.includes("assistant-full-view"));
  assert(floating.includes("assistant-full-messages"));
  assert(floating.includes("assistant-full-input"));
  assert(styles.includes(".assistant-full-view{position:fixed"));
  assert(styles.includes("height:min(43rem,calc(100dvh - 2rem))"));
});

test("assistant position and chat panel stay bounded inside the viewport", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes("window.visualViewport?.width"));
  assert(floating.includes("window.visualViewport?.height"));
  assert(floating.includes("viewport?.offsetTop"));
  assert(floating.includes("viewport?.offsetLeft"));
  assert(floating.includes("localStorage.setItem(config.storageKey"));
  assert(floating.includes("panelPlacement(position)"));
  assert(floating.includes("panel-up"));
  assert(floating.includes("panel-left"));
});

test("assistant languages are selectable and persisted separately per assistant", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const knowledge = read("src/lib/assistant-knowledge.ts");
  assert(knowledge.includes("ASSISTANT_LANGUAGES"));
  assert(knowledge.includes('"hi-IN"'));
  assert(knowledge.includes('"ru-RU"'));
  assert(knowledge.includes('"zh-CN"'));
  assert(knowledge.includes('"fa-IR"'));
  assert(floating.includes("const languageStorageKey = `${config.storageKey}-language`"));
  assert(floating.includes("localStorage.setItem(languageStorageKey, language)"));
  assert(floating.includes('className="assistant-language"'));
  assert(floating.includes("recognition.lang = language"));
});

test("language inference gives obvious text/script priority over a stale UI hint", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  assert(knowledge.includes("const scriptLanguage = detectLanguageFromText(text)"));
  assert(knowledge.includes("if (scriptLanguage) return scriptLanguage"));
  assert(knowledge.includes("[\\u0600-\\u06ff]"));
  assert(knowledge.includes("[\\u0400-\\u04ff]"));
  assert(knowledge.includes("[\\u4e00-\\u9fff]"));
  assert(knowledge.includes("[\\u0900-\\u097f]"));
  assert(knowledge.includes("campaign kaise"));
  assert(knowledge.includes("group promotion kaise"));
  assert(knowledge.includes("session kaise"));
});

test("voice output uses selected language voices and fails truthfully", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes("voiceschanged"));
  assert(floating.includes("chooseVoice(language, latestVoices)"));
  assert(floating.includes("closestVoice(language, latestVoices)"));
  assert(floating.includes("No installed ${languageLabel(language)} speech voice is available"));
  assert(floating.includes("window.speechSynthesis.cancel()"));
  assert(floating.includes("setSpeaking(true)"));
  assert(floating.includes("setSpeaking(false)"));
  assert(floating.includes("Replay"));
  assert(floating.includes("Stop"));
});

test("MARK8LARA and LARA retain separate contexts and avatars", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  const mark8lara = read("public/assistants/mark8lara-avatar.svg");
  const lara = read("public/assistants/lara-avatar.svg");
  assert(knowledge.includes("MARK8LARA is the public MARK8BOT website guide"));
  assert(knowledge.includes("LARA is only the Telegram Promotion Mini App helper"));
  assert(knowledge.includes("does not answer as the public website assistant"));
  assert(knowledge.includes("this Mini App helper stays focused on Telegram Promotion"));
  assert(knowledge.includes('storageKey: "mark8lara-position"'));
  assert(knowledge.includes('storageKey: "promotion-lara-position"'));
  assert(mark8lara.includes("MARK8LARA assistant avatar"));
  assert(lara.includes("LARA promotion assistant avatar"));
  assert.notEqual(mark8lara, lara);
});

test("major supported languages have deterministic same-language responses", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  assert(knowledge.includes("intentTranslations"));
  assert(knowledge.includes('"website:promotion"'));
  assert(knowledge.includes('"promotion-mini-app:campaigns"'));
  assert(knowledge.includes('"promotion-mini-app:sessions"'));
  assert(knowledge.includes('"ru-RU"'));
  assert(knowledge.includes('"zh-CN"'));
  assert(knowledge.includes('"fa-IR"'));
  assert(knowledge.includes('"hi-IN"'));
});
