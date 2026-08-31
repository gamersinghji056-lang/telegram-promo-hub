import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, Mic, Send, X } from "lucide-react";
import { answerAssistantQuestion, type AssistantContext } from "@/lib/assistant-knowledge";

type Position = { x: number; y: number };

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
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function FloatingAssistant({ config, pageContext }: { config: AssistantContext; pageContext?: string }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState(() => [{ role: "assistant", text: config.greeting }]);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number; moved: boolean } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const canListen = useMemo(() => typeof window !== "undefined" && Boolean((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition), []);

  const clamp = useCallback((next: Position) => {
    const margin = 10;
    const width = 76;
    const height = open ? 384 : 104;
    return {
      x: Math.min(Math.max(margin, next.x), Math.max(margin, window.innerWidth - width - margin)),
      y: Math.min(Math.max(72, next.y), Math.max(72, window.innerHeight - height - margin)),
    };
  }, [open]);

  const defaultPosition = useCallback(() => {
    const compact = window.innerWidth < 720;
    return clamp({
      x: window.innerWidth - 86,
      y: compact ? Math.max(88, window.innerHeight - 210) : Math.max(96, Math.round(window.innerHeight * 0.58)),
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
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [clamp, defaultPosition, open]);

  useEffect(() => {
    if (position) localStorage.setItem(config.storageKey, JSON.stringify(position));
  }, [config.storageKey, position]);

  function ask(text: string) {
    const value = text.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: value },
      { role: "assistant", text: answerAssistantQuestion(config, value, pageContext) },
    ]);
    setInput("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  function startVoice() {
    setOpen(true);
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMessages((current) => [...current, { role: "assistant", text: "Voice input is not available in this browser. Use chat instead." }]);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      ask(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!position) return;
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    setPosition(clamp({ x: event.clientX - drag.dx, y: event.clientY - drag.dy }));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  if (!position) return null;

  return (
    <div className={`floating-assistant ${open ? "is-open" : ""}`} style={{ left: position.x, top: position.y }}>
      {open ? (
        <section className="assistant-panel" aria-label={`${config.name} chat`}>
          <div className="assistant-panel-head">
            <div><strong>{config.name}</strong><span>{config.scope === "website" ? "Website guide" : "Promotion helper"}</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X /></button>
          </div>
          <div className="assistant-messages">
            {messages.map((message, index) => (
              <p key={`${message.role}-${index}`} className={message.role === "user" ? "from-user" : "from-assistant"}>{message.text}</p>
            ))}
          </div>
          <div className="assistant-suggestions">
            {config.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => ask(suggestion)}>{suggestion}</button>)}
          </div>
          <form onSubmit={submit} className="assistant-input">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${config.name}`} />
            <button type="submit" aria-label="Send message"><Send /></button>
          </form>
        </section>
      ) : null}
      <div className="assistant-dock" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <button type="button" className="assistant-avatar" onClick={() => setOpen((value) => !value)} aria-label={`Open ${config.name}`}>
          <span className="assistant-face"><i /><b /></span>
        </button>
        <span className="assistant-name">{config.name}</span>
        <div className="assistant-actions">
          <button type="button" onClick={startVoice} aria-label={`${config.name} voice input`} title={canListen ? "Voice input" : "Voice unavailable, opens chat"} className={listening ? "listening" : ""}><Mic /></button>
          <button type="button" onClick={() => setOpen(true)} aria-label={`${config.name} chat`} title="Chat"><MessageCircle /></button>
        </div>
      </div>
    </div>
  );
}
