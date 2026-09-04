import type { CapacitorConfig } from "@capacitor/cli";
import { TELEGRAM_PROMOTION_ANDROID } from "./src/lib/promotion-platform";

const config: CapacitorConfig = {
  appId: TELEGRAM_PROMOTION_ANDROID.packageId,
  appName: TELEGRAM_PROMOTION_ANDROID.appName,
  webDir: ".output/public",
  server: {
    url: "https://tg.mark8bot.com/promotion/app",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["tg.mark8bot.com"],
  },
  android: {
    path: "android",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#050813",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
    },
  },
};

export default config;
