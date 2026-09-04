import assert from "node:assert/strict";

const cdpBase = process.env.CDP_BASE || "http://127.0.0.1:9223";
const appBase = process.env.APP_BASE || "http://localhost:3000";

const target = await fetch(`${cdpBase}/json/new?${encodeURIComponent(`${appBase}/download`)}`, {
  method: "PUT",
}).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
});

await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await send("Runtime.enable");
await send("Page.enable");

const cases = [
  { width: 390, height: 844, path: "/download" },
  { width: 412, height: 915, path: "/download" },
  { width: 390, height: 844, path: "/promotion" },
  { width: 390, height: 844, path: "/promotion/app" },
];

const results = [];
for (const item of cases) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: item.width,
    height: item.height,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await send("Page.navigate", { url: `${appBase}${item.path}` });
  await new Promise((resolve) => setTimeout(resolve, 900));
  const data = await evaluate(`(() => {
    const text = document.body.innerText;
    const doc = document.documentElement;
    const actions = [...document.querySelectorAll("a,button")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);
    return {
      path: location.pathname,
      width: innerWidth,
      height: innerHeight,
      overflowX: doc.scrollWidth > doc.clientWidth,
      title: document.title,
      hasManifest: !!document.querySelector('link[rel="manifest"]'),
      hasPlatform: text.includes("Use Telegram Promotion anywhere") || text.includes("Choose how you want to use Telegram Promotion"),
      hasDownload: actions.some((text) => text.includes("Download Android App") || text.includes("Signed APK pending")),
      hasWeb: actions.some((text) => text.includes("Open Web App") || text.includes("Continue to the Web App")),
      hasTelegram: actions.some((text) => text.includes("Open in Telegram")),
      hasLara: !!document.querySelector(".floating-assistant"),
    };
  })()`);
  results.push({ ...item, data });
  assert.equal(data.overflowX, false, `${item.path} should not overflow horizontally at ${item.width}`);
  if (item.path === "/download") {
    assert.equal(data.hasManifest, true);
    assert.equal(data.hasPlatform, true);
    assert.equal(data.hasDownload, true);
    assert.equal(data.hasWeb, true);
    assert.equal(data.hasTelegram, true);
    assert.equal(data.hasLara, true);
  }
  if (item.path === "/promotion") {
    assert.equal(data.hasPlatform, true);
    assert.equal(data.hasWeb, true);
    assert.equal(data.hasTelegram, true);
  }
  if (item.path === "/promotion/app") {
    assert.equal(data.path, "/mini-app/dashboard");
    assert.equal(data.hasLara, true);
    assert.equal(data.hasManifest, true);
  }
}

await fetch(`${cdpBase}/json/close/${target.id}`).catch(() => undefined);
socket.close();
console.log(JSON.stringify(results, null, 2));
