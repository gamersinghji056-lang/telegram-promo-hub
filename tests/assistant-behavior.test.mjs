import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readBuffer = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url));

test("floating assistant drags from the avatar while preserving tap-to-voice", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const styles = read("src/styles.css");
  assert(!floating.includes('closest("button") return'));
  assert(floating.includes('target.closest(".assistant-actions button")'));
  assert(floating.includes("startedOnAvatar"));
  assert(floating.includes("Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD"));
  assert(floating.includes("if (!drag.moved && drag.startedOnAvatar) startVoiceConversation()"));
  assert(floating.includes("setPointerCapture"));
  assert(floating.includes("active pointer capture target"));
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
  assert(floating.includes("speak(voiceGreeting(config.name, languageRef.current), languageRef.current, true)"));
  assert(floating.includes("setVoiceState(\"assistant-speaking\")"));
  assert(floating.includes("setVoiceState(\"listening\")"));
  assert(floating.includes("setVoiceState(\"processing\")"));
  assert(floating.includes("recognitionStartingRef.current"));
  assert(floating.includes("if (recognitionRef.current || recognitionStartingRef.current || listeningRef.current) return"));
  assert(floating.includes("recognition.interimResults = true"));
  assert(floating.includes("recognition.continuous = true"));
  assert(floating.includes("SPEECH_SILENCE_DELAY_MS"));
  assert(floating.includes("NO_SPEECH_TIMEOUT_MS"));
  assert(floating.includes("MAX_UTTERANCE_MS"));
  assert(floating.includes("finalTranscript"));
  assert(floating.includes("interimTranscript"));
  assert(floating.includes("scheduleSpeechComplete"));
  assert(floating.includes("submittedUtteranceRef"));
  assert(floating.includes("listeningRef.current"));
  assert(floating.includes("recognition.onend = null"));
  assert(floating.includes("if (!receivedSpeech)"));
  assert(floating.includes("stopVoice();"));
  assert(floating.includes("Stop conversation"));
  assert(!floating.includes("<Mic"));
  assert(!floating.includes("startVoice(event"));
});

test("chat icon opens a full assistant page view with isolated history", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const styles = read("src/styles.css");
  assert(floating.includes("const historyStorageKey = `${config.storageKey}-chat-history`"));
  assert(floating.includes("localStorage.setItem(historyStorageKey"));
  assert(floating.includes("setFullOpen(true)"));
  assert(floating.includes("createPortal("));
  assert(floating.includes("document.body"));
  assert(floating.includes("{!fullOpen ? ("));
  assert(floating.includes("assistant-full-view"));
  assert(floating.includes("assistant-full-messages"));
  assert(floating.includes("assistant-full-input"));
  assert(styles.includes(".assistant-full-view{position:fixed"));
  assert(styles.includes("z-index:2147483000"));
  assert(styles.includes("height:100dvh"));
  assert(styles.includes(".assistant-full-card{display:grid"));
  assert(styles.includes("width:100%;height:100%"));
  assert(styles.includes("assistant-back"));
  assert(!floating.includes("assistant-panel"));
});

test("assistant position and full chat stay bounded inside the viewport", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes("window.visualViewport?.width"));
  assert(floating.includes("window.visualViewport?.height"));
  assert(floating.includes("viewport?.offsetTop"));
  assert(floating.includes("viewport?.offsetLeft"));
  assert(floating.includes("localStorage.setItem(config.storageKey"));
  assert(floating.includes("setAssistantFullOpenDocument(fullOpen)"));
  assert(floating.includes('root.dataset.assistantFullOpen = "true"'));
  assert(!floating.includes("panelPlacement"));
  assert(!floating.includes("PANEL_WIDTH"));
  assert(!floating.includes("PANEL_HEIGHT"));
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
  assert(floating.includes("localStorage.setItem(languageStorageKey, responseLanguage)"));
  assert(floating.includes('className="assistant-language"'));
  assert(floating.includes("const languageRef = useRef<AssistantLanguage>"));
  assert(floating.includes("recognition.lang = ASSISTANT_LANGUAGES.find"));
});

test("language switch phrases update deterministic assistant language", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  assert(knowledge.includes("detectRequestedLanguage"));
  assert(knowledge.includes("languageSwitchAnswer"));
  assert(knowledge.includes("hindi mein baat"));
  assert(knowledge.includes("can you speak hindi"));
  assert(knowledge.includes("hindi mai baat karo"));
  assert(knowledge.includes("roman hindi"));
  assert(knowledge.includes("speak russian"));
  assert(knowledge.includes("simplified chinese"));
  assert(knowledge.includes("\\u4e2d\\u6587"));
  assert(knowledge.includes("\\u0641\\u0627\\u0631\\u0633"));
  assert(knowledge.includes("Theek hai, ab main Hindi/Hinglish me baat karungi"));
});

test("language inference gives obvious text/script priority over a stale UI hint", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  assert(knowledge.includes("const requestedLanguage = detectRequestedLanguage(text)"));
  assert(knowledge.includes("if (requestedLanguage) return requestedLanguage"));
  assert(knowledge.includes("const scriptLanguage = detectLanguageFromText(text)"));
  assert(knowledge.includes("if (scriptLanguage) return scriptLanguage"));
  assert(knowledge.includes("[\\u0600-\\u06ff]"));
  assert(knowledge.includes("[\\u0400-\\u04ff]"));
  assert(knowledge.includes("[\\u4e00-\\u9fff]"));
  assert(knowledge.includes("[\\u0900-\\u097f]"));
  assert(knowledge.includes("campaign kaise"));
  assert(knowledge.includes("mujhe campaign kaise banana hai"));
  assert(knowledge.includes("campaign banana"));
  assert(knowledge.includes("account connect"));
  assert(knowledge.includes("group promotion kaise"));
  assert(knowledge.includes("session kaise"));
});

test("voice output uses selected language voices and fails truthfully", () => {
  const floating = read("src/components/floating-assistant.tsx");
  assert(floating.includes("voiceschanged"));
  assert(floating.includes("chooseVoice(language, latestVoices)"));
  assert(floating.includes("closestVoice(language, latestVoices)"));
  assert(floating.includes("rankedVoices(language, voices, true)"));
  assert(floating.includes("voiceSettings(language)"));
  assert(floating.includes("premium|enhanced|neural|natural"));
  assert(floating.includes("No installed ${languageLabel(language)} speech voice is available"));
  assert(floating.includes("window.speechSynthesis.cancel()"));
  assert(floating.includes("setSpeaking(true)"));
  assert(floating.includes("setSpeaking(false)"));
  assert(floating.includes("utterance.onerror"));
  assert(floating.includes("Replay"));
  assert(floating.includes("Stop"));
});

test("voice mode uses avatar-only red listening and blue speaking waves", () => {
  const floating = read("src/components/floating-assistant.tsx");
  const styles = read("src/styles.css");
  assert(floating.includes("voice-${voiceState}"));
  assert(styles.includes(".voice-listening .assistant-avatar::before"));
  assert(styles.includes(".voice-listening .assistant-avatar::after"));
  assert(styles.includes("rgb(244 63 94 / 72%)"));
  assert(styles.includes(".voice-assistant-speaking .assistant-avatar::before"));
  assert(styles.includes(".voice-assistant-speaking .assistant-avatar::after"));
  assert(styles.includes("rgb(34 211 238 / 72%)"));
  assert(styles.includes(".voice-processing .assistant-avatar::after"));
  assert(styles.includes("@keyframes assistantListenWave"));
  assert(styles.includes("@keyframes assistantSpeakWave"));
});

test("MARK8LARA and LARA retain separate contexts and avatars", () => {
  const knowledge = read("src/lib/assistant-knowledge.ts");
  const mark8lara = readBuffer("public/assistants/mark8lara-avatar.png");
  const lara = readBuffer("public/assistants/lara-avatar.png");
  assert(knowledge.includes("MARK8LARA is the public MARK8BOT website guide"));
  assert(knowledge.includes("LARA is only the Telegram Promotion Mini App helper"));
  assert(knowledge.includes("does not answer as the public website assistant"));
  assert(knowledge.includes("this Mini App helper stays focused on Telegram Promotion"));
  assert(knowledge.includes('storageKey: "mark8lara-position"'));
  assert(knowledge.includes('storageKey: "promotion-lara-position"'));
  assert(knowledge.includes('avatarSrc: "/assistants/mark8lara-avatar.png"'));
  assert(knowledge.includes('avatarSrc: "/assistants/lara-avatar.png"'));
  assert(mark8lara.length > 10000);
  assert(lara.length > 10000);
  assert.notDeepEqual(mark8lara, lara);
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
