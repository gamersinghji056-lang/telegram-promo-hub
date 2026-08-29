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
  assert(route.includes("Back to ${parentSections[section].label}"));
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
