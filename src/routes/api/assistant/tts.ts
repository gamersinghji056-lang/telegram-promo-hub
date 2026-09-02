import { createFileRoute } from "@tanstack/react-router";
import {
  ASSISTANT_TTS_TIMEOUT_MS,
  parseAssistantTtsRequest,
  prepareTextForSpeech,
  routeAssistantVoice,
} from "@/lib/assistant-voice";

const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/opus"]);

export const Route = createFileRoute("/api/assistant/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const parsed = parseAssistantTtsRequest(await request.json().catch(() => null));
        if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

        const voiceServiceUrl = process.env["LARA_VOICE_URL"]?.trim();
        if (!voiceServiceUrl) {
          return Response.json({ ok: false, fallback: "browser", error: "Self-hosted voice service is not configured." }, { status: 503 });
        }

        const speechRequest = {
          ...parsed.value,
          text: prepareTextForSpeech(parsed.value.text, parsed.value.language, parsed.value.assistant),
        };
        const route = routeAssistantVoice(speechRequest);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ASSISTANT_TTS_TIMEOUT_MS);
        try {
          const response = await fetch(new URL("/synthesize", voiceServiceUrl), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(process.env["LARA_VOICE_TOKEN"] ? { authorization: `Bearer ${process.env["LARA_VOICE_TOKEN"]}` } : {}),
            },
            body: JSON.stringify({ ...speechRequest, route }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const error = await response.text().catch(() => "Voice service failed.");
            return Response.json({ ok: false, fallback: route.fallbackEngine ?? "browser", error }, { status: 502 });
          }
          const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
          if (!AUDIO_TYPES.has(contentType)) {
            return Response.json({ ok: false, fallback: route.fallbackEngine ?? "browser", error: "Voice service returned a non-audio response." }, { status: 502 });
          }
          return new Response(await response.arrayBuffer(), {
            headers: {
              "content-type": contentType,
              "cache-control": "private, max-age=86400",
              "x-assistant-tts-engine": response.headers.get("x-assistant-tts-engine") ?? route.engine,
              "x-assistant-tts-voice": response.headers.get("x-assistant-tts-voice") ?? route.voice,
            },
          });
        } catch (error) {
          const message = error instanceof DOMException && error.name === "AbortError" ? "Voice service timed out." : "Voice service is unavailable.";
          return Response.json({ ok: false, fallback: route.fallbackEngine ?? "browser", error: message }, { status: 504 });
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
