export const TELEGRAM_PROMOTION_WEB_APP_PATH = "/promotion/app";
export const TELEGRAM_PROMOTION_WORKSPACE_PATH = "/mini-app/dashboard";
export const TELEGRAM_PROMOTION_DOWNLOAD_PATH = "/download";
export const TELEGRAM_PROMOTION_APK_PATH = "/downloads/telegram-promotion-latest.apk";

export const TELEGRAM_PROMOTION_ANDROID_RELEASE_TAG = "telegram-promotion-android-beta";
export const TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_TAG = "telegram-promotion-android-production";
export const TELEGRAM_PROMOTION_ANDROID_APK_FILENAME = "telegram-promotion-latest.apk";
export const TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME = "android-release.json";
export const TELEGRAM_PROMOTION_ANDROID_RELEASE_BASE =
  `https://github.com/gamersinghji056-lang/telegram-promo-hub/releases/download/${TELEGRAM_PROMOTION_ANDROID_RELEASE_TAG}`;
export const TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_BASE =
  `https://github.com/gamersinghji056-lang/telegram-promo-hub/releases/download/${TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_TAG}`;

export const TELEGRAM_PROMOTION_ANDROID_RELEASE_CHANNELS = {
  beta: {
    channel: "Android Beta / Debug Test Build",
    apkSourceUrl: `${TELEGRAM_PROMOTION_ANDROID_RELEASE_BASE}/${TELEGRAM_PROMOTION_ANDROID_APK_FILENAME}`,
    metadataSourceUrl: `${TELEGRAM_PROMOTION_ANDROID_RELEASE_BASE}/${TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME}`,
  },
  production: {
    channel: "Production Release",
    apkSourceUrl: `${TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_BASE}/${TELEGRAM_PROMOTION_ANDROID_APK_FILENAME}`,
    metadataSourceUrl: `${TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_BASE}/${TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME}`,
  },
} as const;

export type TelegramPromotionAndroidReleaseChannel = keyof typeof TELEGRAM_PROMOTION_ANDROID_RELEASE_CHANNELS;

export function getTelegramPromotionAndroidReleaseChannel(
  value = typeof process !== "undefined" ? process.env.MARK8BOT_ANDROID_RELEASE_CHANNEL : undefined,
): TelegramPromotionAndroidReleaseChannel {
  return value === "production" ? "production" : "beta";
}

export function getTelegramPromotionAndroidReleaseSource(value?: string) {
  return TELEGRAM_PROMOTION_ANDROID_RELEASE_CHANNELS[getTelegramPromotionAndroidReleaseChannel(value)];
}

export const TELEGRAM_PROMOTION_ANDROID = {
  packageId: "com.mark8bot.telegrampromotion",
  appName: "Telegram Promotion",
  versionName: "0.1.0",
  versionCode: 1,
  channel: "Android Beta / Debug Test Build",
  minAndroid: "Android 8.0 (API 26)",
  targetSdk: 36,
  releaseDate: "2026-09-04",
  apkPath: TELEGRAM_PROMOTION_APK_PATH,
  apkFileName: TELEGRAM_PROMOTION_ANDROID_APK_FILENAME,
  apkSourceUrl: TELEGRAM_PROMOTION_ANDROID_RELEASE_CHANNELS.beta.apkSourceUrl,
  metadataSourceUrl: TELEGRAM_PROMOTION_ANDROID_RELEASE_CHANNELS.beta.metadataSourceUrl,
  apkSizeLabel: "12.1 MiB",
  apkSizeBytes: 12664240,
  buildSha: "3dcee854b5e63bc41431e34b49b2d1550e96ef9a",
  releaseApkAvailable: true,
} as const;
