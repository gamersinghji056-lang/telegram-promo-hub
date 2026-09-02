import assert from "node:assert/strict";

const cdpBase = process.env.CDP_BASE || "http://127.0.0.1:9223";
const appUrl = process.env.APP_URL || "http://127.0.0.1:5175/";

const target = await fetch(`${cdpBase}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" }).then((response) => response.json());
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

async function evaluate(expression, awaitPromise = true) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
});
await send("Page.navigate", { url: appUrl });
await new Promise((resolve) => setTimeout(resolve, 1800));

await evaluate(`(() => {
  window.__assistantSmoke = { audioPlays: 0, audioEnded: 0, recognitionStarts: 0, results: [], states: [], ttsRequests: 0 };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = String(args[0]);
    if (url.includes('/api/assistant/tts')) window.__assistantSmoke.ttsRequests += 1;
    return originalFetch(...args);
  };
  class MockAudio {
    constructor(url) {
      this.url = url;
      this.onended = null;
      this.onerror = null;
    }
    play() {
      window.__assistantSmoke.audioPlays += 1;
      window.setTimeout(() => {
        window.__assistantSmoke.audioEnded += 1;
        this.onended && this.onended();
      }, 180);
      return Promise.resolve();
    }
    pause() {}
    removeAttribute() {}
    load() {}
  }
  window.Audio = MockAudio;
  class MockRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
      this._stopped = false;
    }
    start() {
      window.__assistantSmoke.recognitionStarts += 1;
      const first = window.__assistantSmoke.recognitionStarts;
      window.__assistantSmoke.results.push({ type: 'start', lang: this.lang, first });
      if (first === 1) {
        window.setTimeout(() => this.onresult && this.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript: 'Mujhe campaign' }, isFinal: false, length: 1 }],
        }), 120);
        window.setTimeout(() => this.onresult && this.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript: 'Mujhe campaign kaise banana hai aur audience kaha se select karni hai' }, isFinal: true, length: 1 }],
        }), 760);
      } else {
        window.setTimeout(() => { if (!this._stopped) this.onend && this.onend(); }, 220);
      }
    }
    stop() {
      this._stopped = true;
      this.onend && this.onend();
    }
    abort() {
      this._stopped = true;
    }
  }
  window.SpeechRecognition = MockRecognition;
  window.webkitSpeechRecognition = MockRecognition;
})()`);

await evaluate(`new Promise((resolve, reject) => {
  const started = Date.now();
  const tick = () => {
    const dock = document.querySelector('.floating-assistant');
    const avatar = document.querySelector('.assistant-avatar');
    const chatButton = document.querySelector('.assistant-actions button');
    if (dock && avatar && chatButton) return resolve(true);
    if (Date.now() - started > 5000) return reject(new Error('assistant dock not found'));
    setTimeout(tick, 100);
  };
  tick();
})`);

const fullChat = await evaluate(`(async () => {
  const button = document.querySelector('.assistant-actions button');
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const overlay = document.querySelector('.assistant-full-view');
  const back = document.querySelector('.assistant-back');
  const body = document.documentElement;
  const rect = overlay.getBoundingClientRect();
  const backRect = back.getBoundingClientRect();
  const full = {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    back: { left: backRect.left, top: backRect.top, width: backRect.width, height: backRect.height },
    floatingHidden: !document.querySelector('.floating-assistant'),
    overflowX: body.scrollWidth > body.clientWidth,
  };
  back.click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  full.closed = !document.querySelector('.assistant-full-view');
  return full;
})()`);

assert.equal(Math.round(fullChat.rect.left), 0);
assert.equal(Math.round(fullChat.rect.top), 0);
assert(fullChat.rect.width >= 389, "full chat must span mobile width");
assert(fullChat.rect.height >= 843, "full chat must span mobile height");
assert(fullChat.back.left >= 0 && fullChat.back.top >= 0 && fullChat.back.width > 44, "Back must be visible");
assert.equal(fullChat.floatingHidden, true);
assert.equal(fullChat.overflowX, false);
assert.equal(fullChat.closed, true);

const voiceFlow = await evaluate(`(async () => {
  const avatar = document.querySelector('.assistant-avatar');
  const dock = document.querySelector('.floating-assistant');
  const recordState = () => window.__assistantSmoke.states.push(dock.className);
  new MutationObserver(recordState).observe(dock, { attributes: true, attributeFilter: ['class'] });
  recordState();
  avatar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 330, clientY: 650 }));
  avatar.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 330, clientY: 650 }));
  await new Promise((resolve) => setTimeout(resolve, 260));
  await new Promise((resolve) => setTimeout(resolve, 260));
  await new Promise((resolve) => setTimeout(resolve, 720));
  const earlyTtsRequests = window.__assistantSmoke.ttsRequests;
  await new Promise((resolve) => setTimeout(resolve, 1600));
  const afterAnswerStarts = window.__assistantSmoke.recognitionStarts;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const button = document.querySelector('.assistant-actions button');
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 22 }));
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 22 }));
  await new Promise((resolve) => setTimeout(resolve, 160));
  const historyText = [...document.querySelectorAll('.assistant-full-messages p')].map((item) => item.textContent || '').join('\\n');
  const ended = !document.querySelector('.voice-listening') && !document.querySelector('.voice-processing') && !document.querySelector('.voice-assistant-speaking');
  document.querySelector('.assistant-back')?.click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  return {
    earlyTtsRequests,
    historyText,
    smoke: window.__assistantSmoke,
    afterAnswerStarts,
    ended,
  };
})()`);

assert(voiceFlow.smoke.states.some((state) => state.includes('voice-processing')), "processing pulse should appear");
assert(voiceFlow.smoke.states.some((state) => state.includes('voice-listening')), "red listening wave should appear");
assert(voiceFlow.smoke.states.some((state) => state.includes('voice-assistant-speaking')), "blue speaking wave should appear");
assert.equal(voiceFlow.smoke.ttsRequests >= 2, true);
assert.equal(voiceFlow.smoke.audioPlays >= 2, true);
assert.equal(voiceFlow.smoke.audioEnded >= 2, true);
assert.equal(voiceFlow.smoke.recognitionStarts >= 2, true);
assert.match(JSON.stringify(voiceFlow.smoke.results), /hi-IN/);
assert.equal(voiceFlow.earlyTtsRequests, 1, "assistant answered before final transcript pause completed");
assert.match(voiceFlow.historyText, /Mujhe campaign kaise banana hai aur audience kaha se select karni hai/);
assert.equal(voiceFlow.ended, true);

const dragBefore = await evaluate(`(() => {
  const dock = document.querySelector('.floating-assistant');
  const rect = dock.getBoundingClientRect();
  return { left: rect.left, top: rect.top, x: rect.left + 26, y: rect.top + 26 };
})()`);
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: dragBefore.x, y: dragBefore.y, button: "left", buttons: 1, clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 82, y: 222, button: "left", buttons: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 82, y: 222, button: "left", buttons: 0, clickCount: 1 });
const drag = await evaluate(`(async () => {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const dock = document.querySelector('.floating-assistant');
  const after = dock.getBoundingClientRect();
  return { before: { left: ${dragBefore.left}, top: ${dragBefore.top} }, after: { left: after.left, top: after.top } };
})()`);

assert(Math.abs(drag.before.left - drag.after.left) > 20 || Math.abs(drag.before.top - drag.after.top) > 20, "drag should move dock");

await fetch(`${cdpBase}/json/close/${target.id}`).catch(() => undefined);
socket.close();
console.log(JSON.stringify({ ok: true, fullChat, voice: voiceFlow.smoke, drag }));
