import { createFileRoute } from "@tanstack/react-router";
import { sendViaUserSession } from "@/lib/telegram-user-session.server";
import { utf16Length, utf16Offset, type CanonicalMessageEntity } from "@/lib/message-entities";

function authorized(request: Request) {
  const key = process.env["CAMPAIGN_WORKER_KEY"];
  if (!key || key.length < 16) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return provided === key;
}

function entity(type: CanonicalMessageEntity["type"], text: string, needle: string, extra: Partial<CanonicalMessageEntity> = {}): CanonicalMessageEntity {
  const start = text.indexOf(needle);
  if (start < 0) throw new Error(`Missing test token: ${needle}`);
  return {
    type,
    offset: utf16Offset(text, start),
    length: utf16Length(needle),
    ...extra,
  };
}

export const Route = createFileRoute("/api/internal/entity-send-test")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({})) as {
          tenantId?: string;
          connectionId?: string;
          documentId?: string;
          fallback?: string;
        };
        if (!body.tenantId || !body.connectionId || !body.documentId) {
          return Response.json({ ok: false, error: "tenantId, connectionId and documentId are required." }, { status: 400 });
        }
        const fallback = body.fallback || "*";
        const text = `WPAY entity test: BOLD ITALIC UNDERLINE STRIKE SPOILER LINK ${fallback} 中文 Русский فارسی 😀`;
        const entities: CanonicalMessageEntity[] = [
          entity("bold", text, "BOLD"),
          entity("italic", text, "ITALIC"),
          entity("underline", text, "UNDERLINE"),
          entity("strikethrough", text, "STRIKE"),
          entity("spoiler", text, "SPOILER"),
          entity("text_link", text, "LINK", { url: "https://t.me/" }),
          entity("custom_emoji", text, fallback, {
            document_id: String(body.documentId),
            fallback,
            premium_required: true,
          }),
        ];
        await sendViaUserSession(body.tenantId, body.connectionId, "me", { text, entities });
        return Response.json({
          ok: true,
          sent_to: "self_saved_messages",
          entities: entities.map((row) => ({
            type: row.type,
            offset: row.offset,
            length: row.length,
            ...(row.document_id ? { document_id: row.document_id } : {}),
          })),
        });
      },
    },
  },
});
