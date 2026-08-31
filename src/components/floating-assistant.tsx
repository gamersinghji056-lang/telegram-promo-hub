import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, Mic, PauseCircle, Send, Volume2, X } from "lucide-react";
import {
  answerAssistantQuestion,
  inferAssistantLanguage,
  normalizeLanguage,
  type AssistantContext,
  type AssistantLanguage,
} from "@/lib/assistant-knowledge";

type Position = { x: number; y: number };
type ChatMessage = { role: "assistant" | "user"; text: string; voice?: boolean };

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

export function FloatingAssistant({ config, pageContext }: { config: AssistantContext; pageContext?: string }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [lastVoiceAnswer, setLastVoiceAnswer] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ role: "assistant", text: config.greeting }]);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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
  }, []);

  const speak = useCallback((text: string, language: AssistantLanguage) => {
    setLastVoiceAnswer(text);
    if (!canSpeak) {
      setVoiceNotice("Voice output is unavailable in this browser, so I showed the answer as text.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.voice = chooseVoice(language);
    utterance.rate = language === "zh-CN" ? 0.92 : 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [canSpeak]);

  const ask = useCallback((text: string, voice = false) => {
    const value = text.trim();
    if (!value) return;
    const language = inferAssistantLanguage(value, selectedLanguage());
    const answer = answerAssistantQuestion(config, value, pageContext, language);
    setMessages((current) => [
      ...current,
      { role: "user", text: value, voice },
      { role: "assistant", text: answer, voice },
    ]);
    setInput("");
    if (voice) speak(answer, language);
  }, [config, pageContext, speak]);

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input, false);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setListening(false);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function startVoice(event?: ReactPointerEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    setOpen(true);
    setVoiceNotice("");
    if (listening) {
      stopVoice();
      return;
    }
    if (!canListen) {
      const notice = "Voice input is not available in this browser. Use chat instead.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      return;
    }
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    const language = inferAssistantLanguage("", selectedLanguage());
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.onresult = (eventResult) => {
      const transcript = eventResult.results[0]?.[0]?.transcript ?? "";
      ask(transcript, true);
    };
    recognition.onerror = (eventError) => {
      const notice = eventError?.error === "not-allowed" ? "Microphone permission was blocked. You can still type your question." : "Voice input stopped. You can continue in chat.";
      setVoiceNotice(notice);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function replayLast() {
    if (lastVoiceAnswer) speak(lastVoiceAnswer, inferAssistantLanguage(lastVoiceAnswer, selectedLanguage()));
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!position) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = clamp({ x: event.clientX - drag.dx, y: event.clientY - drag.dy });
    if (Math.abs(next.x - position!.x) > 3 || Math.abs(next.y - position!.y) > 3) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    setPosition(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      event.preventDefault();
      dragRef.current = null;
      window.setTimeout(() => { suppressClickRef.current = false; }, 80);
    }
  }

  function toggleOpen(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (suppressClickRef.current) return;
    setOpen((value) => !value);
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
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="Close assistant"><X /></button>
          </div>
          <div className="assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <p key={`${message.role}-${index}`} className={message.role === "user" ? "from-user" : "from-assistant"}>{message.text}</p>
            ))}
          </div>
          {voiceNotice || listening || speaking ? (
            <div className="assistant-voice-state">
              {listening ? "Listening..." : speaking ? "Speaking..." : voiceNotice}
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
        <button type="button" className="assistant-avatar" onPointerUp={toggleOpen} aria-label={`Open ${config.name}`}>
          <img src={config.avatarSrc} alt={config.avatarAlt} draggable={false} />
        </button>
        <span className="assistant-name">{config.name}</span>
        <div className="assistant-actions">
          <button type="button" onPointerDown={startVoice} aria-label={`${config.name} voice input`} title={canListen ? "Voice input" : "Voice unavailable, opens chat"} className={listening ? "listening" : ""}>{listening ? <PauseCircle /> : <Mic />}</button>
          <button type="button" onPointerDown={(event) => { event.stopPropagation(); setOpen(true); }} aria-label={`${config.name} chat`} title="Chat"><MessageCircle /></button>
        </div>
      </div>
    </div>
  );
}

function viewportSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function safeInset() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
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

function chooseVoice(language: AssistantLanguage) {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => normalizeLanguage(voice.lang) === language && /female|woman|zira|samantha|google/i.test(voice.name)) ||
    voices.find((voice) => normalizeLanguage(voice.lang) === language) ||
    voices.find((voice) => normalizeLanguage(voice.lang) === "en-US") ||
    null
  );
}
