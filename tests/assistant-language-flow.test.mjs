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

test("natural Promotion intents resolve across English and Hinglish variants", async () => {
  const { knowledge } = await loadAssistantModules();
  const samples = [
    ["Mujhe campaign banana hai", "Campaign banane ke liye"],
    ["campaign kese banau", "Campaign banane ke liye"],
    ["campaign create kaha se hoga", "Campaign banane ke liye"],
    ["where is campaign creation", "Campaigns are split"],
    ["Where do I select the audience?", "Audience tools"],
    ["Ab approved groups kaha milenge?", "Approved Groups"],
    ["session connect nahi ho raha kya karu?", "Sessions page"],
    ["Where is analytics?", "Analytics reports"],
  ];
  for (const [question, expected] of samples) {
    const language = knowledge.resolveAssistantTurnLanguage(question, "auto", "en-US").responseLanguage;
    const answer = knowledge.answerAssistantQuestion(knowledge.promotionAssistant, question, undefined, language);
    assert(answer.includes(expected), `${question} -> ${answer}`);
  }
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
  assert(spoken.includes("Campaigns section खोलो"));
  assert(spoken.includes("Audience select करो"));
});
