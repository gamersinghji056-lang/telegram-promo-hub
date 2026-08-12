import { createHash, createHmac, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 120_000;
const KEYLEN = 32;
const DIGEST = "sha256";

/** Hash a password with PBKDF2-SHA256. Plaintext passwords are never stored. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEYLEN, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2] ?? "", "base64");
  const expected = Buffer.from(parts[3] ?? "", "base64");
  const derived = Buffer.from(await pbkdf2Async(password, salt, iterations, expected.length, DIGEST));
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Validates Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data).
 * Returns the authenticated Telegram user, or null when the signature is invalid/expired.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): { id: number; username?: string; first_name?: string; last_name?: string } | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqual(computed, hash)) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as { id: number; username?: string; first_name?: string };
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

export function deriveWebhookSecret(botToken: string): string {
  return createHash("sha256").update(`telegram-webhook:${botToken}`).digest("base64url");
}
