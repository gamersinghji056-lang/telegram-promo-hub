import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readBuffer = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url));

test("MARK8BOT public website exposes every required route without public admin navigation", () => {
  const publicSite = read("src/components/public-site.tsx");
  const required = [
    "promotion.tsx", "mark.tsx", "guides.tsx", "guides.promotion.tsx", "guides.mark.tsx",
    "about.tsx", "faq.tsx", "contact.tsx", "privacy.tsx", "terms.tsx",
    "acceptable-use.tsx", "security.tsx", "download.tsx", "promotion.app.tsx", "mark.app.tsx",
  ];
  for (const route of required) assert(fs.existsSync(new URL(`../src/routes/${route}`, import.meta.url)), route);
  assert(!publicSite.includes('href="/admin'));
  assert(!publicSite.includes("Admin Login"));
  assert(read("src/routes/admin.index.tsx").includes('redirect({to:"/admin/login"})'));
});

test("product availability is centralized and MARK never exposes a fake launch destination", () => {
  const publicSite = read("src/components/public-site.tsx");
  const config = read("src/lib/public-site.functions.ts");
  assert(publicSite.includes('promotion: "live"'));
  assert(publicSite.includes('mark: "coming_soon"'));
  assert(publicSite.includes("The MARK Intelligence workspace is currently in development."));
  assert(publicSite.includes("MARK - Intelligence built around your business."));
  assert(!read("src/routes/mark.tsx").includes("Coming Soon"));
  assert(!config.includes("MARK_BOT_USERNAME"));
  assert(!publicSite.includes("Open MARK Bot"));
  assert(!publicSite.includes("https://t.me/mark"));
});

test("public website has MARK8LARA only and keeps assistant knowledge separate", () => {
  const shell = read("src/components/public-site.tsx");
  const assistant = read("src/lib/assistant-knowledge.ts");
  const miniShell = read("src/components/mini-app-shell.tsx");
  const floating = read("src/components/floating-assistant.tsx");
  assert(shell.includes("websiteAssistant"));
  assert(shell.includes("<FloatingAssistant config={websiteAssistant}"));
  assert(assistant.includes('name: "MARK8LARA"'));
  assert(assistant.includes('name: "LARA"'));
  assert(assistant.includes('avatarSrc: "/assistants/mark8lara-avatar.png"'));
  assert(assistant.includes('avatarSrc: "/assistants/lara-avatar.png"'));
  assert(assistant.includes("MARK8LARA is the public MARK8BOT website guide"));
  assert(assistant.includes("LARA is only the Telegram Promotion Mini App helper"));
  assert(floating.includes("SpeechRecognition"));
  assert(floating.includes("speechSynthesis"));
  assert(floating.includes("assistant-full-view"));
  assert(floating.includes("voice-${voiceState}"));
  assert(!floating.includes("panelPlacement"));
  assert(floating.includes("setPointerCapture"));
  assert(miniShell.includes("promotionAssistant"));
  assert(!miniShell.includes("websiteAssistant"));
});

test("Promotion bot destination comes from current Telegram settings without a username fallback", () => {
  const config = read("src/lib/public-site.functions.ts");
  assert(config.includes("telegramSettings()"));
  assert(config.includes("telegram.bot_username"));
  assert(config.includes("username ? `https://t.me/"));
  assert(config.includes(": null"));
  assert(!config.toLowerCase().includes("wpaypromotionbot"));
});

test("Promotion web app route reuses shared Mini App core and preserves session fragment", () => {
  const alias = read("src/routes/promotion.app.tsx");
  const telegram = read("src/lib/telegram.server.ts");
  assert(alias.includes("TELEGRAM_PROMOTION_WORKSPACE_PATH"));
  assert(alias.includes("beforeLoad"));
  assert(alias.includes("location.searchStr"));
  assert(alias.includes("location.hash"));
  assert(alias.includes("Telegram Promotion Web App"));
  assert(telegram.includes('new URL("/mini-app"'));
  assert(fs.existsSync(new URL("../src/routes/mini-app.tsx", import.meta.url)));
});

test("PWA shell is installable without caching private workspace data", () => {
  const root = read("src/routes/__root.tsx");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  const sw = read("public/sw.js");
  assert.equal(manifest.start_url, "/promotion/app");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert(root.includes('rel: "manifest"'));
  assert(root.includes("serviceWorker"));
  assert(sw.includes('"/api/"'));
  assert(sw.includes('"/mini-app"'));
  assert(sw.includes('"/promotion/app"'));
  assert(!sw.includes("customer-session"));
  assert(!sw.includes("Authorization"));
});

test("download page exposes platform choices with honest Android release metadata", () => {
  const publicSite = read("src/components/public-site.tsx");
  const platform = read("src/lib/promotion-platform.ts");
  const config = read("src/lib/public-site.functions.ts");
  assert(fs.existsSync(new URL("../src/routes/downloads.$file.ts", import.meta.url)));
  assert(publicSite.includes('page === "download"'));
  assert(publicSite.includes("Choose how you want to use Telegram Promotion."));
  assert(publicSite.includes("Download Android App"));
  assert(publicSite.includes("Android Beta debug test build"));
  assert(!publicSite.includes("Signed APK pending"));
  assert(publicSite.includes("Add to Home Screen"));
  assert(platform.includes('packageId: "com.mark8bot.telegrampromotion"'));
  assert(platform.includes('versionName: "0.1.0"'));
  assert(platform.includes('minAndroid: "Android 8.0 (API 26)"'));
  assert(platform.includes('channel: "Android Beta / Debug Test Build"'));
  assert(platform.includes('TELEGRAM_PROMOTION_APK_PATH = "/downloads/telegram-promotion-latest.apk"'));
  assert(platform.includes("releaseApkAvailable: true"));
  assert(config.includes("getAndroidReleaseMetadata()"));
  assert(config.includes("TELEGRAM_PROMOTION_WEB_APP_PATH"));
  assert(!publicSite.includes("Google Play"));
  assert(!publicSite.includes("App Store"));
});

test("worker roles preserve combined production behavior and keep MARK foundation inert", () => {
  const role = read("src/lib/runtime-role.server.ts");
  const server = read("src/server.ts");
  const workers = read("src/lib/background-workers.server.ts");
  const markWorker = read("workers/mark-intelligence-worker.mjs");
  const pkg = JSON.parse(read("package.json"));
  assert(role.includes('return "combined"'));
  assert(role.includes('"telegram-worker"'));
  assert(role.includes('"blockchain-worker"'));
  assert(role.includes('"order-worker"'));
  assert(role.includes('"promotion-bot"'));
  assert(role.includes('"mark-ai"'));
  assert(server.includes("shouldRunPromotionWorkers(role)"));
  assert(server.includes("shouldRunOrderWorkers(role)"));
  assert(server.includes("shouldRunBlockchainWorkers(role)"));
  assert(server.includes("shouldRunTelegramWorkers(role)"));
  assert(workers.includes("runOrders"));
  assert(workers.includes("runBlockchain"));
  assert(workers.includes("runTelegram"));
  assert(pkg.scripts["start:promotion-worker"].includes("telegram-promotion-worker"));
  assert(pkg.scripts["start:telegram-worker"].includes("telegram-worker"));
  assert(pkg.scripts["start:blockchain-worker"].includes("blockchain-worker"));
  assert.equal(pkg.scripts["start:order-worker"], "node workers/runtime-worker.mjs order-worker");
  assert(pkg.scripts["start:promotion-bot"].includes("promotion-bot"));
  assert(pkg.scripts["start:mark-worker"].includes("mark-ai"));
  assert(markWorker.includes('request.url === "/health"'));
  assert(markWorker.includes('status: "coming_soon"'));
  assert(!markWorker.includes("TELEGRAM_BOT_TOKEN"));
  assert(!markWorker.toLowerCase().includes("openai"));
});

test("homepage explains real Promotion workflows and official support without fake proof", () => {
  const publicSite = read("src/components/public-site.tsx");
  const config = read("src/lib/public-site.functions.ts");
  const styles = read("src/styles.css");
  assert(publicSite.includes("Connect sessions, discover audiences, organize groups, prepare campaigns"));
  assert(publicSite.includes("MARK8BOT <span>Promotion Command Center</span>"));
  assert(publicSite.includes("Find Groups"));
  assert(publicSite.includes("Growth Intelligence"));
  assert(publicSite.includes("HOW TO USE TELEGRAM PROMOTION"));
  assert(publicSite.includes("Audience / Groups / Categories"));
  assert(publicSite.includes("Sessions and health"));
  assert(publicSite.includes("Use Telegram Promotion anywhere"));
  assert(publicSite.includes("Open Web App"));
  assert(publicSite.includes("Open in Telegram"));
  assert(publicSite.includes("Meet LARA - your in-workspace Promotion assistant."));
  assert(publicSite.includes("Voice-driven workflow control is planned for the future."));
  assert(publicSite.includes("@laura_luxee"));
  assert(styles.includes(".preview-dashboard-grid"));
  assert(styles.includes(".hero-product-strip"));
  assert(config.includes('"laura_luxee"'));
  assert(!publicSite.includes("99.9%"));
  assert(!publicSite.includes("testimonial"));
});

test("assistant avatar assets are local and distinct", () => {
  const mark8lara = readBuffer("public/assistants/mark8lara-avatar.png");
  const lara = readBuffer("public/assistants/lara-avatar.png");
  assert(mark8lara.length > 10000);
  assert(lara.length > 10000);
  assert.notDeepEqual(mark8lara, lara);
});

test("sitemap indexes only public marketing routes and robots protects operational paths", () => {
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");
  assert(sitemap.includes("https://tg.mark8bot.com/promotion"));
  assert(sitemap.includes("https://tg.mark8bot.com/download"));
  assert(sitemap.includes("https://tg.mark8bot.com/mark"));
  assert(!sitemap.includes("/admin"));
  assert(!sitemap.includes("/mini-app"));
  assert(robots.includes("Disallow: /admin"));
  assert(robots.includes("Disallow: /mini-app"));
});
