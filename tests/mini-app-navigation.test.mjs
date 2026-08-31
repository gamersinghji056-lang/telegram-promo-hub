import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Mini App exposes exactly five primary destinations with safe parent-route states", () => {
  const shell = read("src/components/mini-app-shell.tsx");
  const primarySlugs = [...shell.matchAll(/\{ slug: "([^"]+)", label:/g)].map((match) => match[1]);
  assert.deepEqual(primarySlugs, ["dashboard", "campaigns", "audience", "analytics", "settings"]);
  assert(shell.includes("grid-cols-5"));
  assert(!shell.includes("overflow-x-auto"));

  const parentMappings = {
    "dm-create": "campaigns",
    "group-create": "campaigns",
    "dm-history": "campaigns",
    "group-history": "campaigns",
    "groups-find": "audience",
    "groups-found": "audience",
    "groups-approved": "audience",
    "groups-joined": "audience",
    "group-categories": "audience",
    "dm-audience": "audience",
    "add-users": "audience",
    "growth-intelligence": "audience",
    sessions: "settings",
    "refer-earn": "settings",
    billing: "settings",
  };
  for (const [route, parent] of Object.entries(parentMappings)) {
    assert(shell.includes(`"${route}": "${parent}"`), `${route} should highlight ${parent}`);
  }
});

test("Audience, Campaigns, Analytics, and Settings hubs retain every secondary route", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const destinations = [
    "dashboard", "sessions", "groups-find", "groups-found", "groups-approved", "groups-joined",
    "group-categories", "dm-audience", "add-users", "dm-create", "dm-history", "campaigns",
    "group-create", "group-history", "analytics", "growth-intelligence", "refer-earn", "billing", "settings",
  ];
  for (const destination of destinations) {
    assert(route.includes(`\"${destination}\"`), `${destination} route must remain reachable`);
  }
  assert(route.includes('section === "audience"'));
  assert(route.includes('href="/mini-app/growth-intelligence"'));
  assert(route.includes('href: "/mini-app/sessions"'));
  assert(route.includes('href: "/mini-app/billing"'));
});

test("customer branding and deterministic secondary-route back navigation are centralized", () => {
  const shell = read("src/components/mini-app-shell.tsx");
  const route = read("src/routes/mini-app.$section.tsx");
  const mark = read("src/components/telegram-promotion-mark.tsx");
  assert(shell.includes("Telegram Promotion"));
  assert(shell.includes("PROMOTION WORKSPACE"));
  assert(shell.includes("TelegramPromotionMark"));
  assert(mark.includes("viewBox=\"0 0 48 48\""));
  assert(route.includes("const parentSections"));
  for (const child of ["dm-create", "group-create", "dm-history", "group-history", "groups-find", "groups-found", "groups-approved", "groups-joined", "group-categories", "dm-audience", "add-users", "growth-intelligence", "sessions", "billing", "refer-earn"]) {
    assert(route.includes(`\"${child}\"`), `${child} needs a deterministic parent`);
  }
  assert(route.includes("Back to ${currentPage.parent.label}"));
});

test("page identity always follows the current route through rapid and direct navigation", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const expected = {
    dashboard: "Home", campaigns: "Campaigns", "dm-create": "DM Promotion", "group-create": "Group Promotion",
    sessions: "Sessions", "refer-earn": "Refer & Earn", billing: "Billing", settings: "Settings",
    "groups-find": "Find Groups", "groups-found": "Found Groups", "groups-approved": "Approved Groups",
    "groups-joined": "Joined Groups", "group-categories": "Group Categories", "dm-audience": "DM Audience",
    "add-users": "Add Users", "growth-intelligence": "Growth Intelligence", analytics: "Analytics",
  };
  for (const [section, title] of Object.entries(expected)) {
    assert(route.includes(`${section.includes("-") ? `"${section}"` : section}: "${title}"`), `${section} must map directly to ${title}`);
  }
  assert(route.includes("const currentPage = pageIdentity(section)"));
  assert(route.includes("key={section} data-page-section={section}"));
  assert(route.includes("sectionRef.current = section"));
  assert(route.includes("if (sectionRef.current !== targetSection) return"));
  assert(route.includes("currentPage.parent.section"));
});

test("Find Groups uses a neutral example without changing persisted keyword behavior", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const customer = read("src/lib/customer-data.server.ts");
  assert(route.includes('placeholder="Education, Courses, Learning"'));
  assert(!route.includes('placeholder="USDT, P2P, Gaming"'));
  assert(route.includes("data?.keywords"));
  assert(customer.includes('.from("keywords")'));
});

test("premium product icons stay local and campaign chooser stays on the hub only", () => {
  const icons = read("src/components/product-icon.tsx");
  const route = read("src/routes/mini-app.$section.tsx");
  const shell = read("src/components/mini-app-shell.tsx");
  for (const visual of ["home", "campaigns", "audience", "analytics", "settings", "direct", "groups", "growth", "billing", "referral", "sessions"]) {
    assert(icons.includes(visual), `${visual} product visual must exist`);
  }
  assert(shell.includes("<ProductIcon"));
  assert(!icons.includes("http://") && !icons.includes("https://"));
  const hubStart = route.indexOf("function CampaignsPage");
  const dmStart = route.indexOf("function DMCampaign");
  const groupStart = route.indexOf("function GroupCampaign");
  assert(route.slice(hubStart, dmStart).includes("Who do you want to promote to?"));
  assert(!route.slice(dmStart, groupStart).includes("Who do you want to promote to?"));
});

test("final Mini App density keeps compact shared cards, icons, avatar, and navigation", () => {
  const icons = read("src/components/product-icon.tsx");
  const route = read("src/routes/mini-app.$section.tsx");
  const shell = read("src/components/mini-app-shell.tsx");
  const styles = read("src/styles.css");
  assert(icons.includes('"avatar"'));
  assert(route.includes('<ProductIcon name="avatar" className="size-7"'));
  assert(route.includes('min-h-[4.75rem]'));
  assert(route.includes('className="size-14 shrink-0'));
  assert(!route.includes('className="size-20 shrink-0'));
  assert(shell.includes("--miniapp-bottom-nav-height, 4.375rem"));
  assert(shell.includes('className="size-6 shrink-0'));
  assert(styles.includes("--miniapp-bottom-nav-height: 4.375rem"));
});

test("Mini App supports direct login while preserving Telegram session handoff", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const functions = read("src/lib/customer.functions.ts");
  assert(functions.includes("directMiniAppLogin"));
  assert(functions.includes("loginCustomer({ email: i.email, password: i.password })"));
  assert(route.includes("DirectMiniAppLogin"));
  assert(route.includes('sessionStorage.setItem("customer-session", result.token)'));
  assert(route.includes("Bot sessions continue automatically."));
  assert(route.includes('return `tma ${telegram.initData}`'));
  assert(route.includes('return `sess ${session}`'));
});

test("Promotion Mini App uses LARA helper only", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const shell = read("src/components/mini-app-shell.tsx");
  const assistant = read("src/lib/assistant-knowledge.ts");
  assert(shell.includes('<FloatingAssistant config={promotionAssistant}'));
  assert(route.includes('<FloatingAssistant config={promotionAssistant} pageContext="login: Promotion Mini App access"'));
  assert(assistant.includes('scope: "promotion-mini-app"'));
  assert(assistant.includes("does not answer as the public website assistant"));
});
