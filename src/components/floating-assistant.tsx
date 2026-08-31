import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, Mic, PauseCircle, Send, Volume2, X } from "lucide-react";
import {
  ASSISTANT_LANGUAGES,
  answerAssistantQuestion,
  inferAssistantLanguage,
  normalizeLanguage,
  type AssistantContext,
  type AssistantLanguage,
} from "@/lib/assistant-knowledge";

type Position = { x: number; y: number };
type ChatMessage = { role: "assistant" | "user"; text: string; voice?: boolean };
type VoiceState = "idle" | "assistant-speaking" | "listening" | "processing";

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

const DOCK_WIDTH = 78;
const DOCK_HEIGHT = 105;
const PANEL_WIDTH = 336;
const PANEL_HEIGHT = 430;
const DRAG_THRESHOLD = 6;

export function FloatingAssistant({ config, pageContext }: { config: AssistantContext; pageContext?: string }) {
  const languageStorageKey = `${config.storageKey}-language`;
  const historyStorageKey = `${config.storageKey}-chat-history`;
  const [position, setPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [lastVoiceAnswer, setLastVoiceAnswer] = useState("");
  const [language, setLanguage] = useState<AssistantLanguage>("en-US");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ role: "assistant", text: config.greeting }]);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; startedOnAvatar: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionStartingRef = useRef(false);
  const voiceModeRef = useRef(false);
  const canListen = useMemo(() => typeof window !== "undefined" && Boolean((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition), []);
  const canSpeak = useMemo(() => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window, []);

  const clamp = useCallback((next: Position) => {
    const viewport = viewportSize();
    const inset = safeInset();
    const margin = 12;
    return {
      x: Math.min(Math.max(margin + inset.left, next.x), Math.max(margin + inset.left, viewport.width - DOCK_WIDTH - margin - inset.right)),
      y: Math.min(Math.max(70 + inset.top, next.y), Math.max(70 + inset.top, viewport.height - DOCK_HEIGHT - margin - inset.bottom)),
    };
  }, []);

  const defaultPosition = useCallback(() => {
    const viewport = viewportSize();
    const compact = viewport.width < 720;
    return clamp({
      x: viewport.width - DOCK_WIDTH - 18,
      y: compact ? viewport.height - DOCK_HEIGHT - 96 : Math.round(viewport.height * 0.56),
    });
  }, [clamp]);

  useEffect(() => {
    const savedLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey));
    setLanguage(savedLanguage ?? inferAssistantLanguage("", selectedLanguage()));
  }, [languageStorageKey]);

  useEffect(() => {
    if (!canSpeak) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    const refreshId = window.setTimeout(loadVoices, 250);
    return () => {
      window.clearTimeout(refreshId);
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, [canSpeak]);

  useEffect(() => {
    localStorage.setItem(languageStorageKey, language);
  }, [language, languageStorageKey]);

  useEffect(() => {
    const savedMessages = localStorage.getItem(historyStorageKey);
    if (!savedMessages) return;
    try {
      const parsed = JSON.parse(savedMessages) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed.slice(-40));
    } catch {
      localStorage.removeItem(historyStorageKey);
    }
  }, [historyStorageKey]);

  useEffect(() => {
    localStorage.setItem(historyStorageKey, JSON.stringify(messages.slice(-40)));
  }, [historyStorageKey, messages]);

  useEffect(() => {
    const saved = localStorage.getItem(config.storageKey);
    if (saved) {
      try {
        setPosition(clamp(JSON.parse(saved) as Position));
        return;
      } catch {
        localStorage.removeItem(config.storageKey);
      }
    }
    setPosition(defaultPosition());
  }, [clamp, config.storageKey, defaultPosition]);

  useEffect(() => {
    const onResize = () => setPosition((current) => clamp(current ?? defaultPosition()));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, [clamp, defaultPosition]);

  useEffect(() => {
    if (position) localStorage.setItem(config.storageKey, JSON.stringify(position));
  }, [config.storageKey, position]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    voiceModeRef.current = false;
    setDraggingDocument(false);
  }, []);

  function speak(text: string, language: AssistantLanguage, continueConversation = false) {
    setLastVoiceAnswer(text);
    setVoiceNotice("");
    if (!canSpeak) {
      setVoiceNotice("Voice output is unavailable in this browser, so I showed the answer as text.");
      setVoiceState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    setVoiceState("assistant-speaking");
    const latestVoices = voices.length ? voices : window.speechSynthesis.getVoices();
    const voice = chooseVoice(language, latestVoices);
    const matchedVoice = voice ?? closestVoice(language, latestVoices);
    if (!matchedVoice && latestVoices.length > 0) {
      const notice = `No installed ${languageLabel(language)} speech voice is available on this device. I showed the answer as text.`;
      setVoiceNotice(notice);
      setSpeaking(false);
      setVoiceState("idle");
      return;
    }
    if (!voice && matchedVoice) setVoiceNotice(`Using the closest installed voice for ${languageLabel(language)}.`);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = matchedVoice?.lang || language;
    utterance.voice = matchedVoice ?? null;
    utterance.rate = language === "zh-CN" ? 0.92 : 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      if (continueConversation && voiceModeRef.current) {
        window.setTimeout(() => startListening(true), 120);
      } else {
        setVoiceState("idle");
      }
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setVoiceState("idle");
      if (continueConversation && voiceModeRef.current) startListening(true);
    };
    window.speechSynthesis.speak(utterance);
  }

  function ask(text: string, voice = false, continueConversation = false) {
    const value = text.trim();
    if (!value) return;
    if (voice) setVoiceState("processing");
    const responseLanguage = inferAssistantLanguage(value, language);
    if (responseLanguage !== language) setLanguage(responseLanguage);
    const answer = answerAssistantQuestion(config, value, pageContext, responseLanguage);
    setMessages((current) => [
      ...current,
      { role: "user", text: value, voice },
      { role: "assistant", text: answer, voice },
    ]);
    setInput("");
    if (voice) speak(answer, responseLanguage, continueConversation);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input, false);
  }

  function stopVoice() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    recognitionRef.current?.stop();
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    recognitionStartingRef.current = false;
    setListening(false);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setVoiceState("idle");
  }

  function startVoice(event?: ReactPointerEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    setOpen(true);
    setVoiceNotice("");
    if (listening) {
      stopVoice();
      return;
    }
    startListening(false);
  }

  function startVoiceConversation() {
    setOpen(true);
    setVoiceNotice("");
    if (!canListen) {
      const notice = "Hands-free voice input is not available in this browser or WebView. Use the full chat view instead.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      return;
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
    if (!canSpeak) {
      const notice = "Voice output is not available in this browser, so I will listen and show answers as text.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      startListening(true);
      return;
    }
    speak(voiceGreeting(config.name, language), language, true);
  }

  function startListening(continueConversation: boolean) {
    if (recognitionRef.current || recognitionStartingRef.current || listening) return;
    if (!canListen) {
      const notice = "Voice input is not available in this browser. Use chat instead.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      setVoiceState("idle");
      return;
    }
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    let receivedResult = false;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.onresult = (eventResult) => {
      receivedResult = true;
      const transcript = eventResult.results[0]?.[0]?.transcript ?? "";
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      setListening(false);
      ask(transcript, true, continueConversation);
    };
    recognition.onerror = (eventError) => {
      const notice = eventError?.error === "not-allowed" ? "Microphone permission was blocked. You can still type your question." : "Voice input stopped. You can continue in chat.";
      setVoiceNotice(notice);
      setListening(false);
      setVoiceState("idle");
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      if (!receivedResult) {
        if (voiceModeRef.current) {
          setVoiceState("listening");
          window.setTimeout(() => startListening(true), 160);
        } else {
          setVoiceState("idle");
        }
      }
    };
    recognitionRef.current = recognition;
    recognitionStartingRef.current = true;
    setListening(true);
    setVoiceState("listening");
    try {
      recognition.start();
      recognitionStartingRef.current = false;
    } catch {
      const notice = `${languageLabel(language)} voice input could not start in this browser. Use chat or choose another language.`;
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      setListening(false);
      setVoiceState("idle");
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
    }
  }

  function replayLast() {
    if (lastVoiceAnswer) speak(lastVoiceAnswer, inferAssistantLanguage(lastVoiceAnswer, language));
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!position) return;
    const target = event.target as HTMLElement;
    if (target.closest(".assistant-actions button") || target.closest(".assistant-panel")) return;
    event.preventDefault();
    setDraggingDocument(true);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
      startedOnAvatar: Boolean(target.closest(".assistant-avatar")),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    const next = clamp({ x: drag.originX + deltaX, y: drag.originY + deltaY });
    setPosition(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      event.preventDefault();
      if (!drag.moved && drag.startedOnAvatar) startVoiceConversation();
      dragRef.current = null;
      setDraggingDocument(false);
      window.setTimeout(() => { suppressClickRef.current = false; }, 80);
    }
  }

  function openChat(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (suppressClickRef.current) return;
    setOpen(false);
    setFullOpen(true);
  }

  function updateLanguage(nextLanguage: AssistantLanguage) {
    setLanguage(nextLanguage);
    setVoiceNotice("");
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }

  if (!position) return null;
  const placement = panelPlacement(position);

  return (
    <div
      className={`floating-assistant floating-assistant-${config.theme} ${open ? "is-open" : ""}`}
      style={{ left: position.x, top: position.y } as CSSProperties}
    >
      {open ? (
        <section className={`assistant-panel ${placement}`} aria-label={`${config.name} chat`}>
          <div className="assistant-panel-head">
            <img src={config.avatarSrc} alt="" aria-hidden="true" />
            <div><strong>{config.name}</strong><span>{config.scope === "website" ? "Website guide" : "Promotion helper"}</span></div>
            <select
              className="assistant-language"
              value={language}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => updateLanguage(event.target.value as AssistantLanguage)}
              aria-label={`${config.name} language`}
              title="Assistant language"
            >
              {ASSISTANT_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.short}</option>)}
            </select>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="Close assistant"><X /></button>
          </div>
          <div className="assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <p key={`${message.role}-${index}`} className={message.role === "user" ? "from-user" : "from-assistant"}>{message.text}</p>
            ))}
          </div>
          {voiceNotice || voiceMode || listening || speaking ? (
            <div className="assistant-voice-state">
              {voiceStatusLabel(voiceState, voiceMode) || (listening ? "Listening..." : speaking ? "Speaking..." : voiceNotice)}
              {voiceMode ? <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={stopVoice}><PauseCircle /> Stop conversation</button> : null}
              {speaking ? <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={stopVoice}><PauseCircle /> Stop</button> : null}
              {lastVoiceAnswer ? <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={replayLast}><Volume2 /> Replay</button> : null}
            </div>
          ) : null}
          <div className="assistant-suggestions">
            {config.suggestions.map((suggestion) => <button key={suggestion} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => ask(suggestion)}>{suggestion}</button>)}
          </div>
          <form onSubmit={submit} className="assistant-input">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${config.name}`} />
            <button type="submit" onPointerDown={(event) => event.stopPropagation()} aria-label="Send message"><Send /></button>
          </form>
        </section>
      ) : null}
      <div className="assistant-dock" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <button type="button" className="assistant-avatar" onClick={(event) => event.preventDefault()} aria-label={`Start ${config.name} voice conversation`}>
          <img src={config.avatarSrc} alt={config.avatarAlt} draggable={false} />
        </button>
        <span className="assistant-name">{config.name}</span>
        <div className="assistant-actions">
          <button type="button" onPointerDown={startVoice} aria-label={`${config.name} voice input`} title={canListen ? "Voice input" : "Voice unavailable, opens chat"} className={listening ? "listening" : ""}>{listening ? <PauseCircle /> : <Mic />}</button>
          <button type="button" onPointerDown={openChat} aria-label={`${config.name} chat`} title="Chat"><MessageCircle /></button>
        </div>
      </div>
      {fullOpen ? (
        <section className={`assistant-full-view assistant-full-${config.theme}`} aria-label={`${config.name} full chat`}>
          <div className="assistant-full-card">
            <header className="assistant-full-head">
              <img src={config.avatarSrc} alt="" aria-hidden="true" />
              <div>
                <strong>{config.name}</strong>
                <span>{config.scope === "website" ? "MARK8BOT website assistant" : "Telegram Promotion assistant"}</span>
              </div>
              <select className="assistant-language" value={language} onChange={(event) => updateLanguage(event.target.value as AssistantLanguage)} aria-label={`${config.name} language`}>
                {ASSISTANT_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.short}</option>)}
              </select>
              <button type="button" onClick={() => setMessages([{ role: "assistant", text: config.greeting }])}>New</button>
              <button type="button" onClick={() => setFullOpen(false)} aria-label={`Close ${config.name} chat`}><X /></button>
            </header>
            <div className="assistant-full-messages" aria-live="polite">
              {messages.map((message, index) => (
                <p key={`full-${message.role}-${index}`} className={message.role === "user" ? "from-user" : "from-assistant"}>{message.text}</p>
              ))}
            </div>
            {voiceNotice || voiceMode || listening || speaking ? (
              <div className="assistant-voice-state assistant-full-voice">
                {voiceStatusLabel(voiceState, voiceMode) || voiceNotice}
                {voiceMode ? <button type="button" onClick={stopVoice}><PauseCircle /> Stop conversation</button> : null}
                {speaking ? <button type="button" onClick={stopVoice}><PauseCircle /> Stop speech</button> : null}
                {lastVoiceAnswer ? <button type="button" onClick={replayLast}><Volume2 /> Replay</button> : null}
              </div>
            ) : null}
            <div className="assistant-suggestions assistant-full-suggestions">
              {config.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => ask(suggestion)}>{suggestion}</button>)}
            </div>
            <form onSubmit={submit} className="assistant-full-input">
              <button type="button" onClick={() => startVoiceConversation()} aria-label={`${config.name} voice conversation`}><Mic /></button>
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${config.name}`} />
              <button type="submit" aria-label="Send message"><Send /></button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function viewportSize() {
  if (typeof window === "undefined") return { width: 1024, height: 768 };
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function safeInset() {
  if (typeof window === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 };
  const viewport = window.visualViewport;
  return {
    top: viewport?.offsetTop ?? 0,
    right: 0,
    bottom: 0,
    left: viewport?.offsetLeft ?? 0,
  };
}

function selectedLanguage() {
  if (typeof window === "undefined") return "en-US";
  return (
    localStorage.getItem("wpay-language") ||
    localStorage.getItem("mini-app-language") ||
    document.documentElement.lang ||
    navigator.language ||
    "en-US"
  );
}

function panelPlacement(position: Position) {
  const viewport = viewportSize();
  const opensUp = position.y + DOCK_HEIGHT + PANEL_HEIGHT + 18 > viewport.height;
  const opensLeft = position.x + PANEL_WIDTH + 18 > viewport.width;
  return `${opensUp ? "panel-up" : "panel-down"} ${opensLeft ? "panel-left" : "panel-right"}`;
}

function setDraggingDocument(active: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (active) {
    root.dataset.assistantDragging = "true";
    root.style.userSelect = "none";
    root.style.touchAction = "none";
    return;
  }
  delete root.dataset.assistantDragging;
  root.style.userSelect = "";
  root.style.touchAction = "";
}

function languageLabel(language: AssistantLanguage) {
  return ASSISTANT_LANGUAGES.find((item) => item.code === language)?.label ?? "selected-language";
}

function voiceGreeting(name: string, language: AssistantLanguage) {
  if (language === "hi-IN") return `Hi, main ${name} hoon. Main aapki kaise madad kar sakti hoon?`;
  if (language === "ru-RU") return `Здравствуйте, я ${name}. Чем я могу помочь?`;
  if (language === "zh-CN") return `你好，我是 ${name}。我可以怎样帮助你？`;
  if (language === "fa-IR") return `سلام، من ${name} هستم. چطور می توانم کمک کنم؟`;
  return `Hi, I am ${name}. How can I help you?`;
}

function voiceStatusLabel(state: VoiceState, active: boolean) {
  if (!active && state === "idle") return "";
  if (state === "assistant-speaking") return "Speaking...";
  if (state === "listening") return "Listening...";
  if (state === "processing") return "Processing...";
  return active ? "Voice conversation ready." : "";
}

function chooseVoice(language: AssistantLanguage, voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => normalizeLanguage(voice.lang) === language && /female|woman|zira|samantha|google|natural|premium|aria|sonia|heera|huihui|yalda/i.test(voice.name)) ||
    voices.find((voice) => normalizeLanguage(voice.lang) === language) ||
    null
  );
}

function closestVoice(language: AssistantLanguage, voices: SpeechSynthesisVoice[]) {
  const family = language.slice(0, 2).toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(family)) || voices.find((voice) => normalizeLanguage(voice.lang) === "en-US") || null;
}
