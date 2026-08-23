export type CanonicalMessageEntity = {
  type: "custom_emoji" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_url";
  offset: number;
  length: number;
  document_id?: string;
  fallback?: string;
  url?: string;
  premium_required?: boolean;
};

export function utf16Length(value: string) {
  return value.length;
}

export function utf16Offset(value: string, jsIndex: number) {
  return value.slice(0, Math.max(0, jsIndex)).length;
}

function clampInteger(value: unknown, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.trunc(parsed));
}

function normalizeEntityType(type: string): CanonicalMessageEntity["type"] | null {
  if (type === "text_link") return "text_url";
  if (["custom_emoji", "bold", "italic", "underline", "strikethrough", "spoiler", "text_url"].includes(type)) {
    return type as CanonicalMessageEntity["type"];
  }
  return null;
}

export function normalizeMessageEntities(entities: unknown, text = ""): CanonicalMessageEntity[] {
  const textLength = utf16Length(text);
  if (!Array.isArray(entities)) return [];
  return entities
    .map((entity): CanonicalMessageEntity | null => {
      if (!entity || typeof entity !== "object") return null;
      const row = entity as Record<string, unknown>;
      const type = normalizeEntityType(String(row["type"] ?? ""));
      if (!type) return null;
      const offset = clampInteger(row["offset"]);
      const length = clampInteger(row["length"]);
      if (!length || offset >= textLength) return null;
      const safeLength = Math.min(length, textLength - offset);
      const next: CanonicalMessageEntity = {
        type: type as CanonicalMessageEntity["type"],
        offset,
        length: safeLength,
      };
      if (type === "custom_emoji") {
        if (!row["document_id"]) return null;
        next.document_id = String(row["document_id"]);
        next.fallback = typeof row["fallback"] === "string" ? row["fallback"] : undefined;
        next.premium_required = row["premium_required"] === true;
      }
      if (type === "text_url") {
        if (!row["url"]) return null;
        next.url = String(row["url"]);
      }
      return next;
    })
    .filter((entity): entity is CanonicalMessageEntity => Boolean(entity))
    .sort((a, b) => a.offset - b.offset || b.length - a.length);
}

export function replaceTextAndShiftEntities(input: {
  text: string;
  entities: CanonicalMessageEntity[];
  start: number;
  end: number;
  insertText: string;
}) {
  const startOffset = utf16Offset(input.text, input.start);
  const endOffset = utf16Offset(input.text, input.end);
  const replacedLength = Math.max(0, endOffset - startOffset);
  const insertedLength = utf16Length(input.insertText);
  const delta = insertedLength - replacedLength;
  const nextText = `${input.text.slice(0, input.start)}${input.insertText}${input.text.slice(input.end)}`;
  const editEnd = startOffset + replacedLength;
  const shifted = normalizeMessageEntities(input.entities, input.text)
    .filter((entity) => entity.offset + entity.length <= startOffset || entity.offset >= editEnd)
    .map((entity) => (entity.offset >= editEnd ? { ...entity, offset: entity.offset + delta } : entity));
  return { text: nextText, entities: normalizeMessageEntities(shifted, nextText), insertedLength, startOffset };
}

export function reconcileEntitiesAfterTextChange(previousText: string, nextText: string, entities: CanonicalMessageEntity[]) {
  if (previousText === nextText) return normalizeMessageEntities(entities, nextText);
  let prefix = 0;
  const maxPrefix = Math.min(previousText.length, nextText.length);
  while (prefix < maxPrefix && previousText[prefix] === nextText[prefix]) prefix += 1;
  let previousSuffix = previousText.length;
  let nextSuffix = nextText.length;
  while (previousSuffix > prefix && nextSuffix > prefix && previousText[previousSuffix - 1] === nextText[nextSuffix - 1]) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }
  const result = replaceTextAndShiftEntities({
    text: previousText,
    entities,
    start: prefix,
    end: previousSuffix,
    insertText: nextText.slice(prefix, nextSuffix),
  });
  return result.entities;
}

export function entityDiagnostics(entities: CanonicalMessageEntity[]) {
  return entities.map((entity) => ({
    type: entity.type,
    offset: entity.offset,
    length: entity.length,
    ...(entity.document_id ? { document_id: entity.document_id } : {}),
    ...(entity.url ? { has_url: true } : {}),
  }));
}
