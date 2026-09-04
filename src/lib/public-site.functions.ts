import { createServerFn } from "@tanstack/react-start";
import { supportSettings } from "./customer-data.server";
import {
  TELEGRAM_PROMOTION_ANDROID,
  TELEGRAM_PROMOTION_DOWNLOAD_PATH,
  TELEGRAM_PROMOTION_WEB_APP_PATH,
  TELEGRAM_PROMOTION_WORKSPACE_PATH,
  getTelegramPromotionAndroidReleaseSource,
} from "./promotion-platform";
import { telegramSettings } from "./telegram.server";

type AndroidReleaseMetadata = {
  versionName?: string;
  versionCode?: number;
  channel?: string;
  apkSizeBytes?: number;
  buildSha?: string;
  buildDate?: string;
};

export const getPublicProductConfig = createServerFn({ method: "GET" }).handler(async () => {
  const [telegram, support, androidRelease] = await Promise.all([telegramSettings(), supportSettings(), getAndroidReleaseMetadata()]);
  const username = telegram.bot_username.replace(/^@/, "").trim();
  const supportUsername = support.telegramUsername || "laura_luxee";
  const androidReleaseSource = getTelegramPromotionAndroidReleaseSource();
  const android = {
    ...TELEGRAM_PROMOTION_ANDROID,
    ...androidReleaseSource,
    ...androidRelease,
    releaseDate: androidRelease.buildDate?.slice(0, 10) ?? TELEGRAM_PROMOTION_ANDROID.releaseDate,
    apkSizeLabel: androidRelease.apkSizeBytes ? formatBytes(androidRelease.apkSizeBytes) : TELEGRAM_PROMOTION_ANDROID.apkSizeLabel,
  };
  return {
    promotion: {
      status: "live" as const,
      botUrl: username ? `https://t.me/${encodeURIComponent(username)}?start=website` : null,
      webAppUrl: TELEGRAM_PROMOTION_WEB_APP_PATH,
      workspaceUrl: TELEGRAM_PROMOTION_WORKSPACE_PATH,
      downloadUrl: TELEGRAM_PROMOTION_DOWNLOAD_PATH,
      android,
    },
    mark: { status: "coming_soon" as const },
    support: {
      telegramUsername: supportUsername,
      telegramUrl: `https://t.me/${supportUsername}`,
      email: support.email || null,
    },
  };
});

async function getAndroidReleaseMetadata(): Promise<AndroidReleaseMetadata> {
  const releaseSource = getTelegramPromotionAndroidReleaseSource();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(releaseSource.metadataSourceUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return {};
    const data = await response.json().catch(() => null) as AndroidReleaseMetadata | null;
    if (!data || typeof data !== "object") return {};
    return {
      versionName: typeof data.versionName === "string" ? data.versionName : undefined,
      versionCode: Number.isInteger(data.versionCode) ? data.versionCode : undefined,
      channel: typeof data.channel === "string" ? data.channel : undefined,
      apkSizeBytes: Number.isInteger(data.apkSizeBytes) ? data.apkSizeBytes : undefined,
      buildSha: typeof data.buildSha === "string" ? data.buildSha : undefined,
      buildDate: typeof data.buildDate === "string" ? data.buildDate : undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function formatBytes(bytes: number) {
  const mib = bytes / 1024 / 1024;
  return `${mib.toFixed(1)} MiB`;
}
