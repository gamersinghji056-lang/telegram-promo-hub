export const TELEGRAM_PROMOTION_WEB_APP_PATH = "/promotion/app";
export const TELEGRAM_PROMOTION_WORKSPACE_PATH = "/mini-app/dashboard";
export const TELEGRAM_PROMOTION_DOWNLOAD_PATH = "/download";

export const TELEGRAM_PROMOTION_ANDROID = {
  packageId: "com.mark8bot.telegrampromotion",
  appName: "Telegram Promotion",
  versionName: "0.1.0",
  versionCode: 1,
  minAndroid: "Android 8.0 (API 26)",
  targetSdk: 36,
  releaseDate: null as string | null,
  apkPath: "/downloads/telegram-promotion-android.apk",
  apkSizeLabel: null as string | null,
  releaseApkAvailable: false,
} as const;
