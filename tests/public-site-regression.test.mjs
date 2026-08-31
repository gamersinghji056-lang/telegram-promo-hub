import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("MARK8BOT public website exposes every required route without public admin navigation", () => {
  const publicSite = read("src/components/public-site.tsx");
  const required = [
    "promotion.tsx", "mark.tsx", "guides.tsx", "guides.promotion.tsx", "guides.mark.tsx",
    "about.tsx", "faq.tsx", "contact.tsx", "privacy.tsx", "terms.tsx",
    "acceptable-use.tsx", "security.tsx", "promotion.app.tsx", "mark.app.tsx",
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
  assert(shell.includes("websiteAssistant"));
  assert(shell.includes("<FloatingAssistant config={websiteAssistant}"));
  assert(assistant.includes('name: "MARK8LARA"'));
  assert(assistant.includes('name: "LARA"'));
  assert(assistant.includes("MARK8LARA is the public MARK8BOT website guide"));
  assert(assistant.includes("LARA is only the Telegram Promotion Mini App helper"));
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

test("Promotion route compatibility preserves the live Mini App query and session fragment", () => {
  const alias = read("src/routes/promotion.app.tsx");
  const telegram = read("src/lib/telegram.server.ts");
  assert(alias.includes("/mini-app${window.location.search}${window.location.hash}"));
  assert(telegram.includes('new URL("/mini-app"'));
  assert(fs.existsSync(new URL("../src/routes/mini-app.tsx", import.meta.url)));
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
  assert(pkg.scripts["start:order-worker"].includes("order-worker"));
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
  assert(publicSite.includes("Connect sessions, discover audiences, organize groups, prepare campaigns"));
  assert(publicSite.includes("HOW TO USE TELEGRAM PROMOTION"));
  assert(publicSite.includes("Audience / Groups / Categories"));
  assert(publicSite.includes("Sessions and health"));
  assert(publicSite.includes("Meet LARA - your in-workspace Promotion assistant."));
  assert(publicSite.includes("Voice-driven workflow control is planned for the future."));
  assert(publicSite.includes("@laura_luxee"));
  assert(config.includes('"laura_luxee"'));
  assert(!publicSite.includes("99.9%"));
  assert(!publicSite.includes("testimonial"));
});

test("sitemap indexes only public marketing routes and robots protects operational paths", () => {
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");
  assert(sitemap.includes("https://tg.mark8bot.com/promotion"));
  assert(sitemap.includes("https://tg.mark8bot.com/mark"));
  assert(!sitemap.includes("/admin"));
  assert(!sitemap.includes("/mini-app"));
  assert(robots.includes("Disallow: /admin"));
  assert(robots.includes("Disallow: /mini-app"));
});
