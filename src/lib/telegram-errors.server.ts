export type TelegramErrorScope = "GROUP" | "SESSION" | "AUTH" | "RATE_LIMIT" | "TRANSIENT" | "UNKNOWN";

export type TelegramErrorClassification = {
  code: string;
  raw: string;
  scope: TelegramErrorScope;
  human: string;
  retryable: boolean;
  groupLevel: boolean;
  sessionLevel: boolean;
};

export function telegramErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "errorMessage" in error) {
    return String((error as { errorMessage?: string }).errorMessage);
  }
  return String(error || "Telegram operation failed.");
}

export function telegramErrorCode(error: unknown) {
  const raw = telegramErrorMessage(error);
  const fromObject =
    typeof error === "object" && error && "errorMessage" in error
      ? String((error as { errorMessage?: string }).errorMessage)
      : raw;
  const upper = fromObject.toUpperCase();
  const match = upper.match(/[A-Z_]+(?:_\d+)?/);
  return match?.[0] ?? upper;
}

export function classifyTelegramError(error: unknown): TelegramErrorClassification {
  const raw = telegramErrorMessage(error);
  const code = telegramErrorCode(error);
  const upper = `${code} ${raw}`.toUpperCase();

  if (
    upper.includes("AUTH_KEY_UNREGISTERED") ||
    upper.includes("SESSION_REVOKED") ||
    upper.includes("SESSION_EXPIRED") ||
    upper.includes("USER_DEACTIVATED")
  ) {
    return {
      code,
      raw,
      scope: "AUTH",
      human: "This Telegram session is invalid or expired.",
      retryable: false,
      groupLevel: false,
      sessionLevel: true,
    };
  }

  if (upper.includes("FLOOD_WAIT") || upper.includes("SLOWMODE_WAIT") || upper.includes("TOO MANY REQUESTS")) {
    return {
      code,
      raw,
      scope: "RATE_LIMIT",
      human: "Telegram rate limit is active.",
      retryable: true,
      groupLevel: false,
      sessionLevel: true,
    };
  }

  if (upper.includes("USER_NOT_PARTICIPANT")) {
    return {
      code,
      raw,
      scope: "GROUP",
      human: "This session has not joined the group.",
      retryable: false,
      groupLevel: false,
      sessionLevel: false,
    };
  }

  if (upper.includes("CHAT_ADMIN_REQUIRED")) {
    return {
      code,
      raw,
      scope: "GROUP",
      human: "Only admins may post in this group.",
      retryable: false,
      groupLevel: true,
      sessionLevel: false,
    };
  }

  if (
    upper.includes("CHAT_WRITE_FORBIDDEN") ||
    upper.includes("CHAT_GUEST_SEND_FORBIDDEN") ||
    upper.includes("USER_BANNED_IN_CHANNEL") ||
    upper.includes("WRITE_FORBIDDEN") ||
    upper.includes("CHAT_SEND") ||
    upper.includes("NOT ENOUGH RIGHTS")
  ) {
    return {
      code,
      raw,
      scope: "GROUP",
      human: "Posting is disabled for this session.",
      retryable: false,
      groupLevel: true,
      sessionLevel: false,
    };
  }

  if (
    upper.includes("CHANNEL_PRIVATE") ||
    upper.includes("CHAT_FORBIDDEN") ||
    upper.includes("USERNAME_NOT_OCCUPIED") ||
    upper.includes("PEER_ID_INVALID") ||
    upper.includes("ACCESS_HASH") ||
    upper.includes("ENTITY_UNAVAILABLE") ||
    upper.includes("NOT FOUND")
  ) {
    return {
      code,
      raw,
      scope: "GROUP",
      human: "The group/channel is inaccessible.",
      retryable: false,
      groupLevel: true,
      sessionLevel: false,
    };
  }

  if (upper.includes("STARS") || upper.includes("PAYMENT") || upper.includes("PAID")) {
    return {
      code,
      raw,
      scope: "GROUP",
      human: "Posting requires Telegram Stars/payment.",
      retryable: false,
      groupLevel: true,
      sessionLevel: false,
    };
  }

  if (upper.includes("USER_RESTRICTED") || upper.includes("ACCOUNT_RESTRICTED")) {
    return {
      code,
      raw,
      scope: "SESSION",
      human: "This session is restricted.",
      retryable: false,
      groupLevel: false,
      sessionLevel: true,
    };
  }

  if (upper.includes("TIMEOUT") || upper.includes("NETWORK") || upper.includes("ECONN")) {
    return {
      code,
      raw,
      scope: "TRANSIENT",
      human: "Telegram operation failed temporarily.",
      retryable: true,
      groupLevel: false,
      sessionLevel: false,
    };
  }

  return {
    code,
    raw,
    scope: "UNKNOWN",
    human: raw || "Telegram operation failed.",
    retryable: true,
    groupLevel: false,
    sessionLevel: false,
  };
}
