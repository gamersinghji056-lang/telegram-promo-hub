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
  assert(publicSite.includes("MARK is coming soon"));
  assert(publicSite.includes("The MARK Intelligence workspace is currently in development."));
  assert(!config.includes("MARK_BOT_USERNAME"));
  assert(!publicSite.includes("Open MARK Bot"));
  assert(!publicSite.includes("Try MARK"));
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
  const markWorker = read("workers/mark-intelligence-worker.mjs");
  const pkg = JSON.parse(read("package.json"));
  assert(role.includes('return "combined"'));
  assert(server.includes("shouldRunPromotionWorkers(role)"));
  assert(pkg.scripts["start:promotion-worker"].includes("telegram-promotion-worker"));
  assert(pkg.scripts["start:mark-worker"].includes("mark-intelligence-worker"));
  assert(markWorker.includes('request.url === "/health"'));
  assert(markWorker.includes('status: "coming_soon"'));
  assert(!markWorker.includes("TELEGRAM_BOT_TOKEN"));
  assert(!markWorker.toLowerCase().includes("openai"));
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
