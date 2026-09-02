import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, MessageCircle, PauseCircle, Send, Volume2 } from "lucide-react";
import {
  ASSISTANT_LANGUAGES,
  ASSISTANT_LANGUAGE_OPTIONS,
  answerAssistantQuestion,
  inferAssistantLanguage,
  normalizeLanguagePreference,
  normalizeLanguage,
  resolveAssistantTurnLanguage,
  type AssistantContext,
  type AssistantLanguage,
  type AssistantLanguagePreference,
} from "@/lib/assistant-knowledge";
import { ASSISTANT_TTS_TIMEOUT_MS, assistantIdFromName, prepareTextForSpeech } from "@/lib/assistant-voice";
import { canUseClientKokoro, cancelClientKokoroSynthesis, synthesizeClientKokoro } from "@/lib/client-kokoro-tts";

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
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: {
    length?: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: { transcript: string };
    };
  };
};

const DOCK_WIDTH = 78;
const DOCK_HEIGHT = 105;
const DRAG_THRESHOLD = 6;
const VOICE_REFRESH_DELAYS = [80, 250, 700, 1400];
const SPEECH_SILENCE_DELAY_MS = 1250;
const NO_SPEECH_TIMEOUT_MS = 11000;
const MAX_UTTERANCE_MS = 45000;

export function FloatingAssistant({ config, pageContext }: { config: AssistantContext; pageContext?: string }) {
  const languageStorageKey = `${config.storageKey}-language-preference`;
  const historyStorageKey = `${config.storageKey}-chat-history`;
  const [position, setPosition] = useState<Position | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [lastVoiceAnswer, setLastVoiceAnswer] = useState("");
  const [language, setLanguage] = useState<AssistantLanguagePreference>("auto");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ role: "assistant", text: config.greeting }]);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; startedOnAvatar: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const voiceModeRef = useRef(false);
  const languageRef = useRef<AssistantLanguage>("en-US");
  const languagePreferenceRef = useRef<AssistantLanguagePreference>("auto");
  const speechSilenceTimerRef = useRef<number | null>(null);
  const speechNoInputTimerRef = useRef<number | null>(null);
  const speechMaxTimerRef = useRef<number | null>(null);
  const submittedUtteranceRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);
  const speechTurnRef = useRef(0);
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
    const savedPreference = normalizeLanguagePreference(localStorage.getItem(languageStorageKey)) ?? "auto";
    languagePreferenceRef.current = savedPreference;
    languageRef.current = savedPreference === "auto" ? (inferAssistantLanguage("", selectedLanguage()) ?? "en-US") : savedPreference;
    setLanguage(savedPreference);
  }, [languageStorageKey]);

  useEffect(() => {
    if (!canSpeak) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    const refreshIds = VOICE_REFRESH_DELAYS.map((delay) => window.setTimeout(loadVoices, delay));
    return () => {
      refreshIds.forEach((refreshId) => window.clearTimeout(refreshId));
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, [canSpeak]);

  useEffect(() => {
    localStorage.setItem(languageStorageKey, language);
    languagePreferenceRef.current = language;
    if (language !== "auto") languageRef.current = language;
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

  useEffect(() => setAssistantFullOpenDocument(fullOpen), [fullOpen]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    stopCurrentAudio();
    window.speechSynthesis?.cancel();
    voiceModeRef.current = false;
    clearSpeechTimers();
    setDraggingDocument(false);
    setAssistantFullOpenDocument(false);
  }, []);

  async function speak(text: string, language: AssistantLanguage, continueConversation = false) {
    setLastVoiceAnswer(text);
    setVoiceNotice("");
    setVoiceState("processing");
    const turn = ++speechTurnRef.current;
    stopCurrentAudio(false);
    window.speechSynthesis?.cancel();
    const assistant = assistantIdFromName(config.name);
    const spokenText = prepareTextForSpeech(text, language, assistant);
    const request = { assistant, language, text: spokenText };
    let triedClientKokoro = false;
    try {
      if (canUseClientKokoro(request)) {
        triedClientKokoro = true;
        setVoiceNotice("Preparing natural voice...");
        const localAudio = await synthesizeClientKokoro(request);
        if (turn !== speechTurnRef.current || (continueConversation && !voiceModeRef.current)) return;
        setVoiceNotice("");
        await playAudioBlob(localAudio.blob, continueConversation, turn);
        return;
      }
      await speakSelfHosted(request, continueConversation, turn);
      return;
    } catch {
      if (turn !== speechTurnRef.current) return;
      setVoiceNotice("");
      if (triedClientKokoro) {
        try {
          await speakSelfHosted(request, continueConversation, turn);
          return;
        } catch {
          if (turn !== speechTurnRef.current) return;
        }
      }
      browserSpeak(spokenText, language, continueConversation, turn);
    }
  }

  async function speakSelfHosted(request: { assistant: "lara" | "mark8lara"; language: AssistantLanguage; text: string }, continueConversation: boolean, turn: number) {
    const controller = new AbortController();
    audioAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), ASSISTANT_TTS_TIMEOUT_MS + 2000);
    try {
      const response = await fetch("/api/assistant/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Self-hosted TTS failed.");
      const blob = await response.blob();
      if (!blob.type.startsWith("audio/")) throw new Error("Self-hosted TTS returned non-audio data.");
      if (turn !== speechTurnRef.current || (continueConversation && !voiceModeRef.current)) return;
      await playAudioBlob(blob, continueConversation, turn);
    } finally {
      window.clearTimeout(timeout);
      if (audioAbortRef.current === controller) audioAbortRef.current = null;
    }
  }

  function playAudioBlob(blob: Blob, continueConversation: boolean, turn: number) {
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setVoiceState("assistant-speaking");
      setSpeaking(true);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onended = () => {
        cleanup();
        if (turn !== speechTurnRef.current) return resolve();
        setSpeaking(false);
        if (continueConversation && voiceModeRef.current) {
          window.setTimeout(() => {
            if (turn === speechTurnRef.current && voiceModeRef.current) startListening(true);
          }, 120);
        } else {
          setVoiceState("idle");
        }
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        setSpeaking(false);
        reject(new Error("Audio playback failed."));
      };
      audio.play().catch((error) => {
        cleanup();
        setSpeaking(false);
        reject(error);
      });
    });
  }

  function browserSpeak(text: string, language: AssistantLanguage, continueConversation = false, turn = ++speechTurnRef.current) {
    if (!canSpeak) {
      setVoiceNotice("Voice output is unavailable in this browser, so I showed the answer as text.");
      if (continueConversation) stopVoice();
      setVoiceState("idle");
      return;
    }
    setVoiceState("assistant-speaking");
    const latestVoices = voices.length ? voices : window.speechSynthesis.getVoices();
    const voice = chooseVoice(language, latestVoices);
    const matchedVoice = voice ?? closestVoice(language, latestVoices);
    if (!matchedVoice && latestVoices.length > 0) {
      const notice = `No installed ${languageLabel(language)} speech voice is available on this device. I showed the answer as text.`;
      setVoiceNotice(notice);
      setSpeaking(false);
      if (continueConversation) stopVoice();
      setVoiceState("idle");
      return;
    }
    if (!voice && matchedVoice) setVoiceNotice(`Using the closest installed voice for ${languageLabel(language)}.`);
    const utterance = new SpeechSynthesisUtterance(text);
    const settings = voiceSettings(language);
    utterance.lang = matchedVoice?.lang || language;
    utterance.voice = matchedVoice ?? null;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.onstart = () => {
      if (turn === speechTurnRef.current) setSpeaking(true);
    };
    utterance.onend = () => {
      if (turn !== speechTurnRef.current) return;
      setSpeaking(false);
      if (continueConversation && voiceModeRef.current) {
        window.setTimeout(() => {
          if (turn === speechTurnRef.current && voiceModeRef.current) startListening(true);
        }, 120);
      } else {
        setVoiceState("idle");
      }
    };
    utterance.onerror = () => {
      if (turn !== speechTurnRef.current) return;
      setSpeaking(false);
      setVoiceState("idle");
      if (continueConversation && voiceModeRef.current) stopVoice();
    };
    window.speechSynthesis.speak(utterance);
  }

  function ask(text: string, voice = false, continueConversation = false) {
    const value = text.trim();
    if (!value) return;
    if (voice) setVoiceState("processing");
    const turnLanguage = resolveAssistantTurnLanguage(value, languagePreferenceRef.current, languageRef.current);
    const responseLanguage = turnLanguage.responseLanguage;
    languageRef.current = responseLanguage;
    if (turnLanguage.explicitLanguage && languagePreferenceRef.current !== turnLanguage.explicitLanguage) {
      languagePreferenceRef.current = turnLanguage.explicitLanguage;
      localStorage.setItem(languageStorageKey, turnLanguage.explicitLanguage);
      setLanguage(turnLanguage.explicitLanguage);
    }
    const answer = answerAssistantQuestion(config, value, pageContext, responseLanguage);
    setMessages((current) => [
      ...current,
      { role: "user", text: value, voice },
      { role: "assistant", text: answer, voice },
    ]);
    setInput("");
    if (voice) void speak(answer, responseLanguage, continueConversation);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input, false);
  }

  function stopVoice() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    speechTurnRef.current += 1;
    clearSpeechTimers();
    stopCurrentAudio();
    recognitionRef.current?.stop();
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    recognitionStartingRef.current = false;
    setListening(false);
    listeningRef.current = false;
    setVoiceNotice("");
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setVoiceState("idle");
  }

  function stopCurrentAudio(cancelSpeech = true) {
    cancelClientKokoroSynthesis();
    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (cancelSpeech) window.speechSynthesis?.cancel();
  }

  function startVoiceConversation() {
    setFullOpen(false);
    setVoiceNotice("");
    if (voiceModeRef.current) {
      stopVoice();
      return;
    }
    if (!canListen) {
      const notice = "Hands-free voice input is not available in this browser or WebView. Use the full chat view instead.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      setVoiceMode(false);
      voiceModeRef.current = false;
      return;
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
    void speak(voiceGreeting(config.name, languageRef.current), languageRef.current, true);
  }

  function startListening(continueConversation: boolean) {
    if (recognitionRef.current || recognitionStartingRef.current || listeningRef.current) return;
    if (!canListen) {
      const notice = "Voice input is not available in this browser. Use chat instead.";
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      setVoiceMode(false);
      voiceModeRef.current = false;
      setVoiceState("idle");
      return;
    }
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    let receivedSpeech = false;
    let finalTranscript = "";
    let interimTranscript = "";
    let submitted = false;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = recognitionLanguageHint(languagePreferenceRef.current, config.scope);
    submittedUtteranceRef.current = "";
    clearSpeechTimers();
    const currentTranscript = () => normalizeTranscript(`${finalTranscript} ${interimTranscript}`);
    const scheduleNoSpeechStop = () => {
      speechNoInputTimerRef.current = window.setTimeout(() => {
        if (!receivedSpeech) stopVoice();
      }, NO_SPEECH_TIMEOUT_MS);
    };
    const submitUtterance = () => {
      if (submitted) return;
      const transcript = currentTranscript();
      if (!transcript) {
        stopVoice();
        return;
      }
      const duplicateKey = transcript.toLowerCase();
      if (submittedUtteranceRef.current === duplicateKey) return;
      submitted = true;
      submittedUtteranceRef.current = duplicateKey;
      clearSpeechTimers();
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      setListening(false);
      listeningRef.current = false;
      if (continueConversation) {
        voiceModeRef.current = true;
        setVoiceMode(true);
      }
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        recognition.abort?.();
      }
      ask(transcript, true, continueConversation);
    };
    const scheduleSpeechComplete = () => {
      if (speechSilenceTimerRef.current) window.clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = window.setTimeout(submitUtterance, SPEECH_SILENCE_DELAY_MS);
    };
    recognition.onresult = (eventResult) => {
      receivedSpeech = true;
      if (speechNoInputTimerRef.current) {
        window.clearTimeout(speechNoInputTimerRef.current);
        speechNoInputTimerRef.current = null;
      }
      interimTranscript = "";
      const start = eventResult.resultIndex ?? 0;
      const length = typeof eventResult.results.length === "number" ? eventResult.results.length : Object.keys(eventResult.results).length;
      for (let index = start; index < length; index += 1) {
        const result = eventResult.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript.trim()) continue;
        if (result?.isFinal) {
          finalTranscript = normalizeTranscript(`${finalTranscript} ${transcript}`);
        } else {
          interimTranscript = normalizeTranscript(`${interimTranscript} ${transcript}`);
        }
      }
      if (currentTranscript()) scheduleSpeechComplete();
    };
    recognition.onerror = (eventError) => {
      const notice = eventError?.error === "not-allowed" ? "Microphone permission was blocked. You can still type your question." : "Voice input stopped. You can continue in chat.";
      setVoiceNotice(notice);
      setListening(false);
      listeningRef.current = false;
      setVoiceState("idle");
      voiceModeRef.current = false;
      setVoiceMode(false);
      clearSpeechTimers();
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
    };
    recognition.onend = () => {
      setListening(false);
      listeningRef.current = false;
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      if (submitted) return;
      if (!receivedSpeech) {
        stopVoice();
        return;
      }
      scheduleSpeechComplete();
    };
    recognitionRef.current = recognition;
    recognitionStartingRef.current = true;
    setListening(true);
    listeningRef.current = true;
    setVoiceState("listening");
    scheduleNoSpeechStop();
    speechMaxTimerRef.current = window.setTimeout(() => {
      if (currentTranscript()) {
        submitUtterance();
      } else {
        stopVoice();
      }
    }, MAX_UTTERANCE_MS);
    try {
      recognition.start();
      recognitionStartingRef.current = false;
    } catch {
      const notice = `${languageLabel(languageRef.current)} voice input could not start in this browser. Use chat or choose another language.`;
      setVoiceNotice(notice);
      setMessages((current) => [...current, { role: "assistant", text: notice }]);
      setListening(false);
      listeningRef.current = false;
      setVoiceState("idle");
      setVoiceMode(false);
      voiceModeRef.current = false;
      clearSpeechTimers();
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
    }
  }

  function clearSpeechTimers() {
    if (speechSilenceTimerRef.current) window.clearTimeout(speechSilenceTimerRef.current);
    if (speechNoInputTimerRef.current) window.clearTimeout(speechNoInputTimerRef.current);
    if (speechMaxTimerRef.current) window.clearTimeout(speechMaxTimerRef.current);
    speechSilenceTimerRef.current = null;
    speechNoInputTimerRef.current = null;
    speechMaxTimerRef.current = null;
  }

  function replayLast() {
    if (lastVoiceAnswer) void speak(lastVoiceAnswer, inferAssistantLanguage(lastVoiceAnswer, language));
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!position) return;
    const target = event.target as HTMLElement;
    if (target.closest(".assistant-actions button") || target.closest(".assistant-full-view")) return;
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
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some embedded WebViews and synthetic test events do not expose an active pointer capture target.
    }
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
    stopVoice();
    setFullOpen(true);
  }

  function updateLanguage(nextLanguage: AssistantLanguagePreference) {
    languagePreferenceRef.current = nextLanguage;
    localStorage.setItem(languageStorageKey, nextLanguage);
    setLanguage(nextLanguage);
    if (nextLanguage !== "auto") languageRef.current = nextLanguage;
    setVoiceNotice("");
    if (speaking) {
      window.speechSynthesis?.cancel();
      stopCurrentAudio();
      setSpeaking(false);
    }
  }

  if (!position) return null;

  const fullChat = fullOpen && typeof document !== "undefined" ? createPortal(
    <section className={`assistant-full-view assistant-full-${config.theme}`} aria-label={`${config.name} full chat`}>
      <div className="assistant-full-card">
        <header className="assistant-full-head">
          <button type="button" className="assistant-back" onClick={() => setFullOpen(false)} aria-label={`Back from ${config.name} chat`}><ArrowLeft /> Back</button>
          <img src={config.avatarSrc} alt="" aria-hidden="true" />
          <div>
            <strong>{config.name}</strong>
            <span>{config.scope === "website" ? "MARK8BOT website assistant" : "Telegram Promotion assistant"}</span>
          </div>
          <select className="assistant-language" value={language} onChange={(event) => updateLanguage(event.target.value as AssistantLanguagePreference)} aria-label={`${config.name} language`}>
            {ASSISTANT_LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.short}</option>)}
          </select>
          <button type="button" onClick={() => setMessages([{ role: "assistant", text: config.greeting }])}>New</button>
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
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${config.name}`} />
          <button type="submit" aria-label="Send message"><Send /></button>
        </form>
      </div>
    </section>,
    document.body,
  ) : null;

  return (
    <>
      {!fullOpen ? (
        <div
          className={`floating-assistant floating-assistant-${config.theme} voice-${voiceState}`}
          style={{ left: position.x, top: position.y } as CSSProperties}
        >
          <div className="assistant-dock" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <button type="button" className="assistant-avatar" onClick={(event) => event.preventDefault()} aria-label={`Start ${config.name} voice conversation`}>
              <img src={config.avatarSrc} alt={config.avatarAlt} draggable={false} />
            </button>
            <span className="assistant-name">{config.name}</span>
            {voiceMode || voiceNotice ? <span className="assistant-voice-pill">{voiceStatusLabel(voiceState, voiceMode) || voiceNotice}</span> : null}
            <div className="assistant-actions">
              <button type="button" onPointerDown={openChat} aria-label={`${config.name} chat`} title="Chat"><MessageCircle /></button>
            </div>
          </div>
        </div>
      ) : null}
      {fullChat}
    </>
  );
}

function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
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

function setAssistantFullOpenDocument(active: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (active) {
    root.dataset.assistantFullOpen = "true";
    body.dataset.assistantFullOpen = "true";
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return;
  }
  delete root.dataset.assistantFullOpen;
  delete body.dataset.assistantFullOpen;
  root.style.overflow = "";
  body.style.overflow = "";
}

function languageLabel(language: AssistantLanguage) {
  return ASSISTANT_LANGUAGES.find((item) => item.code === language)?.label ?? "selected-language";
}

function recognitionLanguageHint(preference: AssistantLanguagePreference, scope: AssistantContext["scope"]) {
  if (preference === "auto") return scope === "promotion-mini-app" ? "en-IN" : "en-US";
  return ASSISTANT_LANGUAGES.find((item) => item.code === preference)?.recognitionLang ?? preference;
}

function voiceGreeting(name: string, language: AssistantLanguage) {
  if (language === "hi-IN") return `Hi, main ${name} hoon. Main aapki kaise madad kar sakti hoon?`;
  if (language === "ru-RU") return `\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, \u044f ${name}. \u0427\u0435\u043c \u044f \u043c\u043e\u0433\u0443 \u043f\u043e\u043c\u043e\u0447\u044c?`;
  if (language === "zh-CN") return `\u4f60\u597d\uff0c\u6211\u662f ${name}\u3002\u6211\u53ef\u4ee5\u600e\u6837\u5e2e\u52a9\u4f60\uff1f`;
  if (language === "fa-IR") return `\u0633\u0644\u0627\u0645\u060c \u0645\u0646 ${name} \u0647\u0633\u062a\u0645. \u0686\u0637\u0648\u0631 \u0645\u06cc \u062a\u0648\u0627\u0646\u0645 \u06a9\u0645\u06a9 \u06a9\u0646\u0645\u061f`;
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
  return rankedVoices(language, voices, true)[0]?.voice ?? null;
}

function closestVoice(language: AssistantLanguage, voices: SpeechSynthesisVoice[]) {
  return rankedVoices(language, voices, false)[0]?.voice ?? rankedVoices("en-US", voices, true)[0]?.voice ?? null;
}

function rankedVoices(language: AssistantLanguage, voices: SpeechSynthesisVoice[], exactOnly: boolean) {
  return voices
    .map((voice) => ({ voice, score: voiceScore(language, voice, exactOnly) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function voiceScore(language: AssistantLanguage, voice: SpeechSynthesisVoice, exactOnly: boolean) {
  const normalized = normalizeLanguage(voice.lang);
  const family = language.slice(0, 2).toLowerCase();
  const voiceLang = voice.lang.toLowerCase();
  if (normalized !== language && (exactOnly || !voiceLang.startsWith(family))) return 0;
  const name = voice.name.toLowerCase();
  let score = normalized === language ? 1000 : 420;
  if (voiceLang === language.toLowerCase()) score += 120;
  if (voice.localService) score += 35;
  if (/premium|enhanced|neural|natural|online|google|microsoft|apple|siri|compact|eloquence/i.test(name)) score += 120;
  if (/female|woman|zira|samantha|aria|sonia|jenny|natasha|heera|lekha|huihui|xiaoxiao|xiaoyi|yalda|dilara|monica|veena/i.test(name)) score += 95;
  if (/default|generic|basic/i.test(name)) score -= 35;
  if (/male|man|david|mark|alex|paul/i.test(name)) score -= 60;
  return score;
}

function voiceSettings(language: AssistantLanguage) {
  if (language === "hi-IN") return { rate: 0.94, pitch: 1.04 };
  if (language === "ru-RU") return { rate: 0.92, pitch: 1 };
  if (language === "zh-CN") return { rate: 0.9, pitch: 1.02 };
  if (language === "fa-IR") return { rate: 0.92, pitch: 1 };
  return { rate: 0.96, pitch: 1.02 };
}
