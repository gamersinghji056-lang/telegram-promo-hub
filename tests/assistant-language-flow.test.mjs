import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function loadAssistantModules() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-language-"));
  for (const file of ["assistant-knowledge.ts", "assistant-voice.ts"]) {
    const sourcePath = path.join(root, "src", "lib", file);
    const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from "\.\/assistant-knowledge"/g, 'from "./assistant-knowledge.mjs"');
    fs.writeFileSync(path.join(dir, file.replace(".ts", ".mjs")), output);
  }
  return {
    knowledge: await import(pathToFileURL(path.join(dir, "assistant-knowledge.mjs")).href),
    voice: await import(pathToFileURL(path.join(dir, "assistant-voice.mjs")).href),
  };
}

test("AUTO detects English -> Hinglish -> English per turn", async () => {
  const { knowledge } = await loadAssistantModules();
  let previous = "en-US";
  const first = knowledge.resolveAssistantTurnLanguage("How do I check session health?", "auto", previous);
  previous = first.responseLanguage;
  const second = knowledge.resolveAssistantTurnLanguage("session connect nahi ho raha kya karu?", "auto", previous);
  previous = second.responseLanguage;
  const third = knowledge.resolveAssistantTurnLanguage("Where is analytics?", "auto", previous);
  assert.equal(first.responseLanguage, "en-US");
  assert.equal(second.responseLanguage, "hi-IN");
  assert.equal(third.responseLanguage, "en-US");
});

test("AUTO detects Hinglish -> English -> Hinglish per turn", async () => {
  const { knowledge } = await loadAssistantModules();
  let previous = "en-US";
  const first = knowledge.resolveAssistantTurnLanguage("Mujhe campaign kaise banana hai?", "auto", previous);
  previous = first.responseLanguage;
  const second = knowledge.resolveAssistantTurnLanguage("Where do I select the audience?", "auto", previous);
  previous = second.responseLanguage;
  const third = knowledge.resolveAssistantTurnLanguage("Ab approved groups kaha milenge?", "auto", previous);
  assert.equal(first.responseLanguage, "hi-IN");
  assert.equal(second.responseLanguage, "en-US");
  assert.equal(third.responseLanguage, "hi-IN");
});

test("Roman Hindi scoring handles mixed Hinglish without treating plain English as Hindi", async () => {
  const { knowledge } = await loadAssistantModules();
  assert.equal(knowledge.detectAssistantInputLanguage("Can you mujhe audience selection explain kar sakti ho?", "en-US"), "hi-IN");
  assert.equal(knowledge.detectAssistantInputLanguage("campaign kaha hai", "en-US"), "hi-IN");
  assert.equal(knowledge.detectAssistantInputLanguage("show campaign analytics", "hi-IN"), "en-US");
  assert.equal(knowledge.detectAssistantInputLanguage("ok", "hi-IN"), "hi-IN");
});

test("explicit language preference changes response language without disabling input detection", async () => {
  const { knowledge } = await loadAssistantModules();
  const locked = knowledge.resolveAssistantTurnLanguage("Speak in English", "auto", "hi-IN");
  assert.equal(locked.explicitLanguage, "en-US");
  assert.equal(locked.responseLanguage, "en-US");
  const understood = knowledge.resolveAssistantTurnLanguage("session connect nahi ho raha kya karu?", "en-US", "en-US");
  assert.equal(understood.inputLanguage, "hi-IN");
  assert.equal(understood.responseLanguage, "en-US");
});

test("natural Promotion paraphrases resolve by meaning", async () => {
  const { knowledge } = await loadAssistantModules();
  const samples = [
    ["campaign kaise banega", "Campaign banane ke liye"],
    ["mujhe campaign start karna hai", "Campaign banane ke liye"],
    ["promotion kaha se start karu", "Campaign banane ke liye"],
    ["how can I send promotion", "Open Campaigns"],
    ["I want to promote in groups", "Group Campaign"],
    ["group me message bhejna hai", "Group Campaign"],
    ["campaign create karne ka option kidhar hai", "Campaign banane ke liye"],
    ["where can I create group promotion", "Group Campaign"],
    ["campaign creation option?", "Open Campaigns"],
    ["groups ko message kaise bheju", "Group Campaign"],
    ["Where do I select the audience?", "Audience"],
    ["Ab approved groups kaha milenge?", "Approved Groups"],
    ["session connect nahi ho raha kya karu?", "Sessions page"],
    ["Where is analytics?", "Analytics"],
  ];
  for (const [question, expected] of samples) {
    const language = knowledge.resolveAssistantTurnLanguage(question, "auto", "en-US").responseLanguage;
    const answer = knowledge.answerAssistantQuestion(knowledge.promotionAssistant, question, undefined, language);
    assert(answer.includes(expected), `${question} -> ${answer}`);
  }
});

test("semantic router extracts topic action and confidence instead of fixed answers", async () => {
  const { knowledge } = await loadAssistantModules();
  const disconnected = knowledge.understandAssistantMessage(knowledge.promotionAssistant, "mere sessions bar bar disconnect kyu ho rahe hain", "hi-IN");
  assert.equal(disconnected.topic, "session-health");
  assert.equal(disconnected.action, "troubleshooting");
  assert(disconnected.confidence >= 4);

  const approved = knowledge.understandAssistantMessage(knowledge.promotionAssistant, "jo groups mene approve kiye the wo kaha hain", "hi-IN");
  assert.equal(approved.topic, "approved-groups");
  assert.equal(approved.action, "navigation");

  const targeting = knowledge.understandAssistantMessage(knowledge.promotionAssistant, "campaign me sirf selected groups ko kese bheju", "hi-IN");
  assert.equal(targeting.topic, "group-campaign");
  assert.equal(targeting.action, "selection");
});

test("same topic composes different answers for navigation selection and difference intents", async () => {
  const { knowledge } = await loadAssistantModules();
  const location = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "approved groups kaha milenge", undefined, "hi-IN");
  const use = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "approved group ko campaign me use kese karu", undefined, "hi-IN");
  const difference = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "approved aur joined group me difference kya hai", undefined, "hi-IN");

  assert(location.answer.includes("Audience kholo"));
  assert(use.answer.includes("targeting step"));
  assert.notEqual(location.answer, use.answer);
  assert(difference.answer.includes("Approved Groups wo hain"));
  assert(difference.answer.includes("Joined Groups wo hain"));
});

test("bounded follow-up context carries campaign workflow across short turns", async () => {
  const { knowledge } = await loadAssistantModules();
  let context = { turns: 0 };

  const first = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "mujhe group promotion karna hai", undefined, "hi-IN", context);
  context = first.nextContext;
  assert.equal(first.understanding.topic, "group-campaign");
  assert(first.answer.includes("Group Campaign"));

  const second = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "groups kaha se aayenge", undefined, "hi-IN", context);
  context = second.nextContext;
  assert(["approved-groups", "find-groups", "group-campaign"].includes(second.understanding.topic));
  assert(/Find Groups|Approved Groups|Categories/.test(second.answer));

  const third = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "aur session?", undefined, "hi-IN", context);
  context = third.nextContext;
  assert.equal(third.understanding.topic, "sessions");
  assert(third.answer.includes("Sessions"));

  const fourth = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "where can I check its status?", undefined, "en-US", context);
  assert.equal(fourth.understanding.language, "en-US");
  assert.equal(fourth.understanding.topic, "analytics");
  assert(/Analytics|Campaign History/.test(fourth.answer));
});

test("smart fallback clarifies Promotion-like low-confidence questions and refuses unrelated ones", async () => {
  const { knowledge } = await loadAssistantModules();
  const lowConfidence = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "promotion option confuse kar raha hai", undefined, "hi-IN");
  assert(lowConfidence.answer.includes("campaign banana"));
  const unrelated = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "kal ka weather kya hai", undefined, "hi-IN");
  assert(unrelated.answer.includes("Promotion workspace"));
});

test("semantic queries work in supported scripts without changing LARA scope", async () => {
  const { knowledge } = await loadAssistantModules();
  assert.equal(knowledge.answerAssistantTurn(knowledge.promotionAssistant, "मैं campaign कैसे बनाऊँ", undefined, "hi-IN").understanding.topic, "campaigns");
  assert.equal(knowledge.answerAssistantTurn(knowledge.promotionAssistant, "как проверить session health", undefined, "ru-RU").understanding.topic, "session-health");
  assert.equal(knowledge.answerAssistantTurn(knowledge.promotionAssistant, "在哪里创建 campaign", undefined, "zh-CN").understanding.topic, "campaigns");
  assert.equal(knowledge.answerAssistantTurn(knowledge.promotionAssistant, "چطور campaign بسازم", undefined, "fa-IR").understanding.topic, "campaigns");
  const markQuestion = knowledge.answerAssistantTurn(knowledge.promotionAssistant, "mark ai business plan batao", undefined, "hi-IN");
  assert(!markQuestion.answer.includes("MARK is"));
});

test("spoken text is normalized separately for Hindi and Hinglish Piper output", async () => {
  const { voice } = await loadAssistantModules();
  const spoken = voice.prepareTextForSpeech(
    "**Campaign** banane ke liye Campaigns section kholo, phir audience select karo. https://t.me/laura_luxee",
    "hi-IN",
    "lara",
  );
  assert(!spoken.includes("**"));
  assert(!spoken.includes("https://"));
  assert(spoken.includes("बनाने के लिए"));
  assert(spoken.includes("कैंपेन्स section खोलो"));
  assert(spoken.includes("ऑडियंस select करो"));
});

test("language-specific speech normalization does not leak Hindi pronunciation into other languages", async () => {
  const { voice } = await loadAssistantModules();
  const hi = voice.prepareTextForSpeech("Mujhe Group Campaign banana hai aur approved groups select karne hain.", "hi-IN", "lara");
  const en = voice.prepareTextForSpeech("Open Campaigns and choose Group Campaign.", "en-US", "lara");
  const ru = voice.prepareTextForSpeech("Откройте Campaigns и выберите Group Campaign.", "ru-RU", "lara");
  const zh = voice.prepareTextForSpeech("打开 Campaigns，然后选择 Group Campaign。", "zh-CN", "lara");
  const fa = voice.prepareTextForSpeech("Campaigns را باز کنید و Group Campaign را انتخاب کنید.", "fa-IR", "lara");

  assert(hi.includes("मुझे"));
  assert(hi.includes("ग्रुप कैंपेन"));
  assert.equal(en.includes("ग्रुप"), false);
  assert.equal(ru.includes("ग्रुप"), false);
  assert.equal(zh.includes("ग्रुप"), false);
  assert.equal(fa.includes("ग्रुप"), false);
  assert(ru.includes("кампейнс"));
  assert(zh.includes("活动"));
  assert(fa.includes("کمپین"));
});
