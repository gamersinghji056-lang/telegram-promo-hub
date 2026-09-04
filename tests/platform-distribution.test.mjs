import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => fs.existsSync(new URL(`../${path}`, import.meta.url));

test("Capacitor dependencies and config use the shared production Promotion web app", () => {
  const pkg = JSON.parse(read("package.json"));
  const platform = read("src/lib/promotion-platform.ts");
  assert.equal(pkg.dependencies["@capacitor/core"], "8.5.1");
  assert.equal(pkg.dependencies["@capacitor/cli"], "8.5.1");
  assert.equal(pkg.dependencies["@capacitor/android"], "8.5.1");
  assert(platform.includes('packageId: "com.mark8bot.telegrampromotion"'));
  if (exists("capacitor.config.ts")) {
    const cap = read("capacitor.config.ts");
    assert(cap.includes("TELEGRAM_PROMOTION_ANDROID.packageId"));
    assert(cap.includes("https://tg.mark8bot.com/promotion/app"));
    assert(cap.includes('allowNavigation: ["tg.mark8bot.com"]'));
    assert(!cap.includes("SUPABASE_SERVICE_ROLE"));
    assert(!cap.includes("TELEGRAM_BOT_TOKEN"));
  }
});

test("PWA and Android distribution avoid sensitive offline caching and broad permissions", () => {
  const root = read("src/routes/__root.tsx");
  const manifestJson = JSON.parse(read("public/manifest.webmanifest"));
  const sw = read("public/sw.js");
  assert.equal(manifestJson.start_url, "/promotion/app");
  assert.equal(manifestJson.display, "standalone");
  assert(manifestJson.icons.some((icon) => icon.src === "/pwa-icon-192.png" && icon.sizes === "192x192"));
  assert(manifestJson.icons.some((icon) => icon.src === "/pwa-icon-512.png" && icon.purpose.includes("maskable")));
  assert(root.includes('rel: "manifest"'));
  assert(root.includes("/apple-touch-icon.png"));
  assert(sw.includes('"/api/"'));
  assert(sw.includes('"/mini-app"'));
  assert(sw.includes('"/promotion/app"'));
  assert(!sw.includes("customer_sessions"));
  assert(!sw.includes("billing"));
  if (exists("android/app/src/main/AndroidManifest.xml")) {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const foreground = read("android/app/src/main/res/drawable/promotion_launcher_foreground.xml");
    assert(manifest.includes("android.permission.INTERNET"));
    assert(foreground.includes("#70E1FF"));
    for (const blocked of ["READ_CONTACTS", "SEND_SMS", "READ_SMS", "READ_CALL_LOG", "ACCESS_FINE_LOCATION", "MANAGE_EXTERNAL_STORAGE"]) {
      assert(!manifest.includes(blocked), `${blocked} permission should not be requested`);
    }
  }
});

test("Android debug APK workflow publishes a stable official download asset", () => {
  const workflow = read(".github/workflows/android-build.yml");
  const platform = read("src/lib/promotion-platform.ts");
  const downloadRoute = read("src/routes/downloads.$file.ts");
  assert(workflow.includes("workflow_dispatch"));
  assert(workflow.includes("permissions:"));
  assert(workflow.includes("contents: write"));
  assert(workflow.includes("java-version: \"21\""));
  assert(workflow.includes("telegram-promotion-latest.apk"));
  assert(workflow.includes("android-release.json"));
  assert(workflow.includes("gh release upload"));
  assert(workflow.includes("retention-days: 10"));
  assert(platform.includes("TELEGRAM_PROMOTION_ANDROID_RELEASE_TAG"));
  assert(platform.includes("TELEGRAM_PROMOTION_ANDROID_PRODUCTION_RELEASE_TAG"));
  assert(platform.includes("getTelegramPromotionAndroidReleaseSource"));
  assert(platform.includes("TELEGRAM_PROMOTION_ANDROID_APK_FILENAME"));
  assert(downloadRoute.includes('createFileRoute("/downloads/$file")'));
  assert(downloadRoute.includes("getTelegramPromotionAndroidReleaseSource"));
  assert(downloadRoute.includes("application/vnd.android.package-archive"));
  assert(!workflow.includes("SERVICE_ROLE"));
  assert(!workflow.includes("TELEGRAM_BOT_TOKEN"));
});

test("Android release signing is CI-only and produces signed APK/AAB artifacts", () => {
  const workflow = read(".github/workflows/android-build.yml");
  const buildGradle = read("android/app/build.gradle");
  const gitignore = read(".gitignore");
  assert(workflow.includes("build_release"));
  assert(workflow.includes("Build signed release APK and AAB"));
  assert(workflow.includes("secrets.ANDROID_KEYSTORE_BASE64"));
  assert(workflow.includes("secrets.ANDROID_KEYSTORE_PASSWORD"));
  assert(workflow.includes("secrets.ANDROID_KEY_ALIAS"));
  assert(workflow.includes("secrets.ANDROID_KEY_PASSWORD"));
  assert(workflow.includes("base64 --decode > android/app/mark8bot-release.jks"));
  assert(workflow.includes("./gradlew assembleRelease bundleRelease"));
  assert(workflow.includes("android/app/build/outputs/apk/release/app-release.apk"));
  assert(workflow.includes("android/app/build/outputs/bundle/release/app-release.aab"));
  assert(workflow.includes("verify --verbose android/app/build/outputs/apk/release/app-release.apk"));
  assert(workflow.includes("verify --print-certs android/app/build/outputs/apk/release/app-release.apk"));
  assert(workflow.includes("telegram-promotion-signed-release"));
  assert(workflow.includes("rm -f android/app/mark8bot-release.jks"));
  assert(buildGradle.includes("System.getenv(\"ANDROID_KEYSTORE_PATH\")"));
  assert(buildGradle.includes("System.getenv(\"ANDROID_KEYSTORE_PASSWORD\")"));
  assert(buildGradle.includes("System.getenv(\"ANDROID_KEY_ALIAS\")"));
  assert(buildGradle.includes("System.getenv(\"ANDROID_KEY_PASSWORD\")"));
  assert(buildGradle.includes("debuggable false"));
  assert(gitignore.includes("*.jks"));
  assert(gitignore.includes("android/keystores/"));
  assert(!workflow.includes("ANDROID_KEYSTORE_BASE64: \""));
  assert(!workflow.includes("ANDROID_KEYSTORE_PASSWORD: \""));
});
