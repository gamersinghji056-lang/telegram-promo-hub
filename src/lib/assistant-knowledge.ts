export type AssistantScope = "website" | "promotion-mini-app";
export type AssistantLanguage = "en-US" | "hi-IN" | "ru-RU" | "zh-CN" | "fa-IR";
export type AssistantLanguagePreference = "auto" | AssistantLanguage;
export type AssistantTopic =
  | "home"
  | "campaigns"
  | "dm-campaign"
  | "group-campaign"
  | "audience"
  | "find-groups"
  | "found-groups"
  | "approved-groups"
  | "joined-groups"
  | "categories"
  | "sessions"
  | "session-health"
  | "analytics"
  | "growth-intelligence"
  | "add-users"
  | "refer-earn"
  | "billing"
  | "settings"
  | "support"
  | "mark-navigation"
  | "unknown";
export type AssistantAction = "how-to" | "navigation" | "troubleshooting" | "difference" | "status" | "selection" | "explain" | "pricing" | "out-of-scope";
export type AssistantConversationContext = {
  topic?: AssistantTopic;
  subtopic?: string;
  action?: AssistantAction;
  language?: AssistantLanguage;
  turns: number;
};
export type AssistantUnderstanding = {
  language: AssistantLanguage;
  topic: AssistantTopic;
  subtopic?: string;
  action: AssistantAction;
  questionType: "how" | "where" | "why" | "what" | "status" | "short-follow-up" | "unknown";
  entities: string[];
  confidence: number;
  inScope: boolean;
  usedContext: boolean;
};

export type AssistantContext = {
  scope: AssistantScope;
  name: string;
  avatarSrc: string;
  avatarAlt: string;
  theme: "website" | "promotion";
  storageKey: string;
  greeting: string;
  system: string;
  fallback: string;
  suggestions: string[];
  intents: {
    id: string;
    match: string[];
    answer: string;
    localized?: Partial<Record<AssistantLanguage, string>>;
  }[];
};

export const ASSISTANT_LANGUAGES: { code: AssistantLanguage; label: string; short: string; recognitionLang: string }[] = [
  { code: "en-US", label: "English", short: "EN", recognitionLang: "en-US" },
  { code: "hi-IN", label: "Hindi / Hinglish", short: "HI", recognitionLang: "hi-IN" },
  { code: "ru-RU", label: "Russian", short: "RU", recognitionLang: "ru-RU" },
  { code: "zh-CN", label: "Simplified Chinese", short: "ZH", recognitionLang: "zh-CN" },
  { code: "fa-IR", label: "Persian / Farsi", short: "FA", recognitionLang: "fa-IR" },
];

export const ASSISTANT_LANGUAGE_OPTIONS: { code: AssistantLanguagePreference; label: string; short: string }[] = [
  { code: "auto", label: "Auto", short: "AUTO" },
  ...ASSISTANT_LANGUAGES.map(({ code, label, short }) => ({ code, label, short })),
];

export const websiteAssistant: AssistantContext = {
  scope: "website",
  name: "MARK8LARA",
  avatarSrc: "/assistants/mark8lara-avatar.png",
  avatarAlt: "MARK8LARA website assistant",
  theme: "website",
  storageKey: "mark8lara-position",
  greeting: "Hi, I am MARK8LARA. I can guide you around MARK8BOT, Telegram Promotion, MARK, plans, guides and support.",
  system:
    "MARK8LARA is the public MARK8BOT website guide. It answers informational questions about MARK8BOT, Telegram Promotion, MARK, navigation, product guides, support and getting started. It never claims to run campaigns, modify accounts, operate Telegram, or act as MARK.",
  fallback:
    "I can help with MARK8BOT products, Telegram Promotion, MARK, guides, navigation, plans and support. For account-specific help, contact @laura_luxee.",
  suggestions: ["Compare MARK and Promotion", "How do I start?", "How do I get support?"],
  intents: [
    {
      id: "mark8bot",
      match: ["mark8bot", "company", "website", "home", "product", "platform", "ecosystem", "kya hai", "ye kya", "what is", "about"],
      answer:
        "MARK8BOT is a Telegram-first product platform. Telegram Promotion is live for campaign, audience, group, session, analytics and billing workflows. MARK is the separate intelligence product being built around business context. Next: open Products to compare both products.",
    },
    {
      id: "promotion",
      match: [
        "promotion", "telegram promotion", "campaign", "campaigns", "dm", "group promotion", "find groups", "audience", "add users", "growth intelligence",
        "promotion kya", "campaign kaise", "group promotion kaise", "audience kaise", "promo kaise", "продвижение", "кампания", "группа", "推广", "活动", "تبلیغ", "کمپین",
      ],
      answer:
        "Telegram Promotion is the live workspace for repeatable Telegram promotion: connect sessions, find groups, approve or join destinations, organize categories, build DM audiences, run DM or group campaigns, review history, manage billing and use Analytics plus Growth Intelligence. Next: open Telegram Promotion or the Mini App login.",
      localized: {
        "hi-IN": "Telegram Promotion live workspace hai: sessions connect karein, groups find/approve/join karein, categories banayein, DM audience prepare karein, DM ya group campaign chalayein, history, billing, Analytics aur Growth Intelligence dekhein. Next: Promotion Mini App open karein.",
      },
    },
    {
      id: "mark",
      match: ["mark", "intelligence", "ai", "business", "knowledge", "instructions", "mark ai", "business assistant", "марка", "智能", "مارک"],
      answer:
        "MARK is presented as: MARK - Intelligence built around your business. It is separate from Telegram Promotion and its operational workspace is not live yet, so Start/Open/Try/Use actions show the dedicated coming-soon access state. I can explain MARK, but I cannot run MARK AI.",
    },
    {
      id: "difference",
      match: ["difference", "compare", "vs", "versus", "telegram promotion and mark", "promotion and mark", "farak", "antar", "difference kya", "فرق", "разница", "区别"],
      answer:
        "Telegram Promotion is the live operational workspace for campaigns, sessions, groups, audiences, billing, Analytics and Growth Intelligence. MARK is separate: a planned intelligence product built around business knowledge, instructions and conversation context. Use Promotion for current campaign work; use MARK pages to follow the planned intelligence product.",
      localized: {
        "hi-IN": "Telegram Promotion live campaign, session, group, audience, billing, Analytics aur Growth Intelligence workspace hai. MARK alag planned intelligence product hai jo business knowledge, instructions aur conversation context ke around ban raha hai.",
        "ru-RU": "Telegram Promotion - действующее рабочее пространство для кампаний, сессий, групп, аудиторий, биллинга, аналитики и Growth Intelligence. MARK - отдельный будущий интеллектуальный продукт на основе знаний бизнеса, инструкций и контекста.",
        "zh-CN": "Telegram Promotion 是已上线的运营工作区，用于活动、会话、群组、受众、账单、Analytics 和 Growth Intelligence。MARK 是独立规划中的智能产品，围绕业务知识、指令和对话上下文构建。",
        "fa-IR": "Telegram Promotion فضای کاری فعال برای کمپین ها، سشن ها، گروه ها، مخاطبان، پرداخت، Analytics و Growth Intelligence است. MARK محصول جداگانه و در حال توسعه برای هوش مبتنی بر دانش و دستورالعمل های کسب و کار است.",
      },
    },
    {
      id: "start",
      match: ["start", "get started", "begin", "register", "login", "open", "try", "use", "shuru", "kaise start", "login kaise", "начать", "войти", "开始", "登录", "شروع", "ورود"],
      answer:
        "To start with Telegram Promotion, use the Promotion bot or open the Mini App login and sign in with your existing customer account. Bot sessions still continue automatically. To explore MARK, open the MARK page; operational access is still in development.",
    },
    {
      id: "plans",
      match: ["plan", "pricing", "price", "billing", "coins", "credits", "invoice", "add users", "premium", "standard", "paisa", "kitna", "оплата", "тариф", "价格", "账单", "پرداخت", "قیمت"],
      answer:
        "Plan limits, invoices, Coins, Add Users credits and add-ons are managed inside Telegram Promotion Billing. Standard/Premium capabilities depend on the active customer plan and available credits; the public site avoids inventing live prices.",
    },
    {
      id: "lara",
      match: ["lara", "assistant", "voice", "microphone", "mic", "mark8lara", "help bot", "madad", "voice", "голос", "助手", "میکروفون"],
      answer:
        "MARK8LARA guides the website across MARK8BOT, Telegram Promotion, MARK, plans, guides and support. Telegram Promotion has its own separate helper, LARA, for in-workspace Promotion questions. Both helpers are informational today; voice-driven workflow control is planned for the future.",
    },
    {
      id: "support",
      match: ["support", "contact", "help", "laura", "@laura_luxee", "telegram", "madad", "problem", "issue", "поддержка", "帮助", "پشتیبانی", "کمک"],
      answer:
        "Official MARK8BOT support is @laura_luxee on Telegram: https://t.me/laura_luxee. Use it for product, billing or account-specific help, and never share passwords or raw Telegram session data.",
      localized: {
        "hi-IN": "Official MARK8BOT support Telegram par @laura_luxee hai: https://t.me/laura_luxee. Product, billing ya account help ke liye message karein; password ya raw session data share na karein.",
        "ru-RU": "Официальная поддержка MARK8BOT в Telegram: @laura_luxee, https://t.me/laura_luxee. Для вопросов по продукту, биллингу или аккаунту напишите туда; не отправляйте пароли или raw session data.",
        "zh-CN": "MARK8BOT 官方支持是 Telegram 上的 @laura_luxee：https://t.me/laura_luxee。产品、账单或账号问题可以联系；不要发送密码或原始 session 数据。",
        "fa-IR": "پشتیبانی رسمی MARK8BOT در تلگرام @laura_luxee است: https://t.me/laura_luxee. برای محصول، پرداخت یا حساب پیام بدهید و رمز عبور یا داده خام session را ارسال نکنید.",
      },
    },
    {
      id: "navigation",
      match: ["navigate", "where", "page", "guide", "faq", "about", "contact", "route", "kidhar", "kahan", "куда", "страница", "页面", "راهنما", "کجا"],
      answer:
        "Use Products for Telegram Promotion and MARK, Guides for walkthroughs, FAQ for quick answers, About for company context, and Contact for support. Next: ask me for the page you need and I will point you there.",
    },
  ],
};

export const promotionAssistant: AssistantContext = {
  scope: "promotion-mini-app",
  name: "LARA",
  avatarSrc: "/assistants/lara-avatar.png",
  avatarAlt: "LARA Promotion Mini App assistant",
  theme: "promotion",
  storageKey: "promotion-lara-position",
  greeting:
    "Hi, I am LARA. I can explain this Promotion workspace, campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings.",
  system:
    "LARA is only the Telegram Promotion Mini App helper. It answers informational questions about the current Promotion page and workspace features. It does not answer as the public website assistant, does not discuss MARK except direct product-navigation questions, and never executes campaigns, changes data, clicks controls, or performs Telegram actions.",
  fallback:
    "I can help with Promotion workspace pages: campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings. I cannot perform actions yet.",
  suggestions: ["What can I do here?", "How do I start group promotion?", "Explain sessions"],
  intents: [
    {
      id: "current",
      match: ["current", "this page", "here", "what can i do", "what is this", "ye page", "yahan kya", "idhar kya", "здесь", "эта страница", "这个页面", "اینجا"],
      answer:
        "I can explain the visible Promotion controls, what data is shown, and what to check before you use a workflow. I cannot click controls or change campaign data in this phase.",
    },
    {
      id: "campaigns",
      match: [
        "campaign", "campaigns", "dm", "dm promotion", "group promotion", "history", "pause", "resume", "start group", "send message",
        "campaign kaise", "campaign banana", "campaign banana hai", "campaign kaise banana", "mujhe campaign kaise banana hai", "campaign setup", "group promotion kaise", "dm kaise", "message bhejna", "message kaise bhejna", "promotion chalana", "кампания", "личные сообщения", "групповая", "活动", "群组推广", "私信", "کمپین", "پیام",
      ],
      answer:
        "Campaigns are split into DM Promotion and Group Promotion. For group promotion, connect a healthy Telegram session, approve or join target groups, organize them into categories, verify writable/sendable status where available, then create the group campaign and monitor history/status. Next: check Sessions first if you are unsure whether sending is available.",
      localized: {
        "hi-IN": "Campaigns DM Promotion aur Group Promotion me split hain. Group promotion ke liye pehle healthy Telegram session connect karein, groups approve/join karein, categories banayein, writable/sendable checks dekhein, phir group campaign create karke history/status monitor karein.",
        "ru-RU": "Кампании разделены на DM Promotion и Group Promotion. Для групповой кампании подключите здоровую Telegram-сессию, подтвердите или вступите в группы, разложите их по категориям, проверьте writable/sendable и затем отслеживайте статус в истории.",
        "zh-CN": "Campaigns 分为 DM Promotion 和 Group Promotion。群组推广前，请先连接健康的 Telegram 会话，批准或加入目标群组，整理分类，检查 writable/sendable 状态，然后创建群组活动并查看历史和状态。",
        "fa-IR": "کمپین ها به DM Promotion و Group Promotion تقسیم می شوند. برای تبلیغ گروهی، ابتدا سشن سالم تلگرام را وصل کنید، گروه ها را تایید یا join کنید، دسته بندی بسازید، وضعیت writable/sendable را بررسی کنید و سپس وضعیت کمپین را در history پیگیری کنید.",
      },
    },
    {
      id: "groups",
      match: ["group", "groups", "found", "approved", "joined", "category", "categories", "folder", "find groups", "writable", "sendable", "group kaise", "group dhundna", "groups kaise milenge", "category banana", "folder banana", "категория", "группы", "群组", "分类", "گروه", "دسته"],
      answer:
        "Groups move through discovery, found review, approval, joining and categories. Approved and sendable groups are the best candidates for group campaigns, depending on session permissions and Telegram responses. Next: use Find Groups, review Found Groups, then keep campaign-ready groups in categories.",
    },
    {
      id: "audience",
      match: ["audience", "users", "find users", "add users", "contacts", "invite", "dm audience", "user add", "members", "audience kaise", "пользователи", "аудитория", "用户", "受众", "مخاطب", "کاربر"],
      answer:
        "Audience tools help organize eligible users where permitted. DM Audience prepares contacts for DM campaigns, and Add Users uses connected sessions, destination checks, tracked jobs and available credits. Next: confirm credits and limits before starting a user-add job.",
    },
    {
      id: "sessions",
      match: ["session", "sessions", "telegram account", "health", "reconnect", "premium", "standard", "writable", "sendable", "login", "session health", "session kaise", "account connect", "telegram connect", "session connect", "session healthy", "сессия", "здоровье", "会话", "健康", "سشن", "سلامت"],
      answer:
        "Sessions are customer-linked Telegram accounts. Check health, reconnect state, access, Premium/Standard visibility and selected-session requirements before workflows that depend on Telegram permissions. Next: reconnect or choose another session if health is weak.",
    },
    {
      id: "analytics",
      match: ["analytics", "growth", "growth intelligence", "members", "joins", "leaves", "report", "chart", "graph", "insight", "analytics kaise", "аналитика", "рост", "分析", "增长", "تحلیل", "رشد"],
      answer:
        "Analytics reports campaign and workspace data. Growth Intelligence uses stored snapshots and Telegram-exposed membership signals when an authorized session has enough access; unavailable metrics are not invented. Next: compare campaign history with group growth snapshots.",
    },
    {
      id: "billing",
      match: ["billing", "plan", "invoice", "payment", "coin", "coins", "credits", "settings", "support", "premium", "standard", "bill kaise", "оплата", "монеты", "账单", "积分", "پرداخت", "اعتبار"],
      answer:
        "Billing shows plans, invoices, Coins, Add Users credits and add-ons. Settings contains account, language, appearance, password and official support access. Next: check Billing before workflows that consume credits.",
    },
    {
      id: "support",
      match: ["support", "help", "laura", "@laura_luxee", "problem", "issue", "madad", "error", "поддержка", "ошибка", "帮助", "错误", "پشتیبانی", "خطا"],
      answer:
        "For Promotion support, contact @laura_luxee on Telegram: https://t.me/laura_luxee. Include the page name, what you were trying to do and the visible error message, but never share passwords or raw session data.",
    },
    {
      id: "mark-navigation",
      match: ["mark website", "mark product", "go to mark", "open mark", "mark page"],
      answer:
        "MARK is a separate MARK8BOT product. For MARK product information, open the public MARK page from the website; this Mini App helper stays focused on Telegram Promotion.",
    },
  ],
};

export function normalizeLanguage(language?: string | null): AssistantLanguage | null {
  const value = String(language ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("hi") || value.includes("hindi") || value.includes("hinglish")) return "hi-IN";
  if (value.startsWith("ru") || value.includes("russian")) return "ru-RU";
  if (value.startsWith("zh") || value.includes("cn") || value.includes("chinese") || value.includes("mandarin")) return "zh-CN";
  if (value.startsWith("fa") || value.startsWith("per") || value.includes("farsi") || value.includes("persian")) return "fa-IR";
  if (value.startsWith("en") || value.includes("english")) return "en-US";
  return null;
}

export function normalizeLanguagePreference(language?: string | null): AssistantLanguagePreference | null {
  const value = String(language ?? "").trim().toLowerCase();
  if (value === "auto" || value === "automatic" || value === "detect") return "auto";
  return normalizeLanguage(language);
}

export function inferAssistantLanguage(text: string, languageHint?: string | null): AssistantLanguage {
  const requestedLanguage = detectRequestedLanguage(text);
  if (requestedLanguage) return requestedLanguage;
  const scriptLanguage = detectLanguageFromText(text);
  if (scriptLanguage) return scriptLanguage;
  const hinglish = scoreHinglish(text);
  if (hinglish.score >= 3 && hinglish.score > hinglish.englishScore) return "hi-IN";
  return normalizeLanguage(languageHint) ?? "en-US";
}

export function detectAssistantInputLanguage(text: string, previousLanguage: AssistantLanguage = "en-US"): AssistantLanguage {
  const requestedLanguage = detectRequestedLanguage(text);
  if (requestedLanguage) return requestedLanguage;
  const scriptLanguage = detectLanguageFromText(text);
  if (scriptLanguage) return scriptLanguage;
  const hinglish = scoreHinglish(text);
  if (hinglish.score >= 3 && hinglish.score >= hinglish.englishScore + 1) return "hi-IN";
  if (hinglish.englishScore >= 3 && hinglish.englishScore > hinglish.score) return "en-US";
  if (hinglish.englishScore >= 2 && hinglish.englishScore >= hinglish.score + 2) return "en-US";
  if (hinglish.englishScore > 0 && hinglish.score <= 2) return "en-US";
  return previousLanguage;
}

export function resolveAssistantTurnLanguage(text: string, preference: AssistantLanguagePreference, previousLanguage: AssistantLanguage = "en-US"): {
  inputLanguage: AssistantLanguage;
  responseLanguage: AssistantLanguage;
  explicitLanguage: AssistantLanguage | null;
} {
  const explicitLanguage = detectRequestedLanguage(text);
  const inputLanguage = detectAssistantInputLanguage(text, previousLanguage);
  return {
    inputLanguage,
    responseLanguage: explicitLanguage ?? (preference === "auto" ? inputLanguage : preference),
    explicitLanguage,
  };
}

export function detectRequestedLanguage(text: string): AssistantLanguage | null {
  const normalized = normalizeQuestion(text);
  if (!normalized) return null;
  const source = text.normalize("NFC");
  if (/[\u0900-\u097f]/.test(source) && /(\u0939\u093f\u0902\u0926\u0940|\u0939\u093f\u0928\u094d\u0926\u0940)/i.test(source)) return "hi-IN";
  if (/[\u0400-\u04ff]/.test(source) && /(\u0440\u0443\u0441\u0441\u043a|\u0433\u043e\u0432\u043e\u0440\u0438|\u044f\u0437\u044b\u043a)/i.test(source)) return "ru-RU";
  if (/(\u4e2d\u6587|\u6c49\u8bed|\u6f22\u8a9e|\u7528\u4e2d\u6587|\u8bf4\u4e2d\u6587|\u7b80\u4f53\u4e2d\u6587)/.test(source)) return "zh-CN";
  if (/(\u0641\u0627\u0631\u0633\u06cc|\u0641\u0627\u0631\u0633\u064a|\u067e\u0627\u0631\u0633\u06cc|\u0628\u0647 \u0641\u0627\u0631\u0633\u06cc|\u0641\u0627\u0631\u0633\u06cc \u0635\u062d\u0628\u062a|\u0641\u0627\u0631\u0633\u06cc \u067e\u0627\u0633\u062e|\u0628\u0647 \u0641\u0627\u0631\u0633\u06cc \u062c\u0648\u0627\u0628|\u0641\u0627\u0631\u0633\u06cc \u062d\u0631\u0641)/.test(source)) return "fa-IR";
  if (/\b(hindi|hinglish|hindi me|hindi mein|hindi mai|hindi bol|hindi bolo|hindi mein bolo|hindi me bolo|hindi baat|hindi language|hindi mein baat|hindi me baat|hindi mai baat|hindi mein baat karo|hindi me baat karo|hindi mai baat karo|can you speak hindi|speak hindi|talk hindi|use hindi|baat karo|hin me|roman hindi)\b/.test(normalized)) return "hi-IN";
  if (/\b(english|angrezi|english me|en me|speak english|talk english|use english)\b/.test(normalized)) return "en-US";
  if (/\b(russian|russki|russky|russkij|po russki|speak russian|talk russian|use russian)\b/.test(normalized)) return "ru-RU";
  if (/\b(chinese|mandarin|zhongwen|simplified chinese|speak chinese|talk chinese|use chinese)\b/.test(normalized)) return "zh-CN";
  if (/\b(farsi|persian|parsi|speak farsi|talk farsi|use farsi|speak persian|talk persian)\b/.test(normalized)) return "fa-IR";
  return null;
}

export function answerAssistantTurn(
  config: AssistantContext,
  question: string,
  pageContext?: string,
  languageHint?: string | null,
  context: AssistantConversationContext = { turns: 0 },
): { answer: string; understanding: AssistantUnderstanding; nextContext: AssistantConversationContext } {
  const normalized = normalizeQuestion(question);
  const language = inferAssistantLanguage(question, languageHint ?? context.language);
  if (!normalized) {
    const understanding = emptyUnderstanding(language);
    return { answer: config.greeting, understanding, nextContext: context };
  }
  const requestedLanguage = detectRequestedLanguage(question);
  if (requestedLanguage) {
    const understanding = emptyUnderstanding(requestedLanguage);
    return {
      answer: languageSwitchAnswer(config, requestedLanguage),
      understanding,
      nextContext: { ...context, language: requestedLanguage, turns: context.turns + 1 },
    };
  }

  const understanding = understandAssistantMessage(config, question, language, context);
  const baseAnswer = composeAssistantAnswer(config, understanding, question);
  const answer = config.scope === "promotion-mini-app" ? withPromotionContext(baseAnswer, topicIntentId(understanding.topic), pageContext) : baseAnswer;
  const nextContext = understanding.inScope && understanding.topic !== "unknown"
    ? {
        topic: understanding.topic,
        subtopic: understanding.subtopic,
        action: understanding.action,
        language: understanding.language,
        turns: Math.min(context.turns + 1, 8),
      }
    : { ...context, language: understanding.language, turns: Math.min(context.turns + 1, 8) };
  return { answer, understanding, nextContext };
}

export function answerAssistantQuestion(config: AssistantContext, question: string, pageContext?: string, languageHint?: string | null) {
  return answerAssistantTurn(config, question, pageContext, languageHint).answer;
}

export function understandAssistantMessage(
  config: AssistantContext,
  question: string,
  language: AssistantLanguage = inferAssistantLanguage(question),
  context: AssistantConversationContext = { turns: 0 },
): AssistantUnderstanding {
  const normalized = normalizeQuestion(question);
  const tokens = normalized.split(" ").filter(Boolean);
  const topicScores = scoreTopics(normalized, tokens, config.scope);
  const action = detectAction(normalized);
  const questionType = detectQuestionType(normalized, action);
  const entities = detectEntities(normalized);
  const best = [...topicScores.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["unknown", 0] as [AssistantTopic, number];
  let topic = best[0];
  let confidence = best[1];
  let usedContext = false;

  if (isShortFollowUp(normalized) && context.topic && context.topic !== "unknown") {
    topic = refineFollowUpTopic(normalized, context.topic);
    confidence = Math.max(confidence, 6);
    usedContext = true;
  } else if (confidence < 4 && context.topic && hasContextualFollowUp(normalized)) {
    topic = refineFollowUpTopic(normalized, context.topic);
    confidence = Math.max(confidence, 4.5);
    usedContext = true;
  }

  const inScope = config.scope === "promotion-mini-app" ? isPromotionTopic(topic, confidence, normalized) : isWebsiteTopic(topic, confidence, normalized);
  return {
    language,
    topic: inScope ? topic : "unknown",
    subtopic: detectSubtopic(normalized, topic),
    action,
    questionType,
    entities,
    confidence: Math.min(10, Number(confidence.toFixed(2))),
    inScope,
    usedContext,
  };
}

function emptyUnderstanding(language: AssistantLanguage): AssistantUnderstanding {
  return {
    language,
    topic: "unknown",
    action: "explain",
    questionType: "unknown",
    entities: [],
    confidence: 0,
    inScope: true,
    usedContext: false,
  };
}

type TopicRule = {
  topic: AssistantTopic;
  terms: string[];
  phrases?: RegExp[];
  weight?: number;
};

const promotionTopicRules: TopicRule[] = [
  {
    topic: "group-campaign",
    terms: ["group campaign", "group promotion", "groups promotion", "group promo", "group me", "groups me", "group wala", "selected groups", "message bhejna", "promo bhejna"],
    phrases: [
      /\b(group|groups)\b.*\b(campaign|promotion|promo|message|send|bhejna|bheju)\b/,
      /\b(campaign|promotion|promo|message|send|bhejna|bheju)\b.*\b(group|groups)\b/,
    ],
    weight: 2,
  },
  {
    topic: "dm-campaign",
    terms: ["dm campaign", "dm promotion", "direct message", "private message", "dm audience", "contacts"],
    phrases: [/\b(dm|direct|private)\b.*\b(campaign|promotion|message|audience)\b/],
    weight: 2,
  },
  {
    topic: "campaigns",
    terms: ["campaign", "campaigns", "promotion", "promo", "promote", "send promotion", "start promotion", "campaign create", "campaign creation", "campaign banana", "campaign banega", "campaign banau", "message bhejna", "bhejna hai", "launch", "start"],
    phrases: [
      /\b(how|kaise|kese|kaha|kidhar|where|start|create|banana|banau|banega|bhejna|promote|promotion)\b.*\b(campaign|promotion|promo|message|groups?)\b/,
      /\b(campaign|promotion|promo|message|groups?)\b.*\b(how|kaise|kese|kaha|kidhar|where|start|create|banana|banau|banega|bhejna|promote)\b/,
    ],
    weight: 1.5,
  },
  {
    topic: "approved-groups",
    terms: ["approved group", "approved groups", "approve group", "approve kiye", "approve kiye the", "approved", "swikrit", "manzoor"],
    phrases: [/\b(approved|approve)\b.*\b(group|groups)\b/, /\b(groups?)\b.*\b(approved|approve)\b/],
    weight: 2.5,
  },
  {
    topic: "joined-groups",
    terms: ["joined group", "joined groups", "join group", "joined", "join kiye"],
    phrases: [/\b(joined|join)\b.*\b(group|groups)\b/, /\b(groups?)\b.*\b(joined|join)\b/],
    weight: 2.2,
  },
  {
    topic: "find-groups",
    terms: ["find groups", "search groups", "discover groups", "group dhundna", "groups dhundna", "group find", "groups kaha se aayenge"],
    phrases: [/\b(find|search|discover|dhundna|dhundo|kaha se aayenge)\b.*\b(group|groups)\b/],
    weight: 2,
  },
  { topic: "found-groups", terms: ["found groups", "found group", "review found", "discovered groups"], weight: 1.8 },
  { topic: "categories", terms: ["category", "categories", "folder", "folders", "segment", "list"], weight: 1.7 },
  {
    topic: "audience",
    terms: ["audience", "audiences", "users", "contacts", "members", "target", "targeting", "select audience", "choose audience", "eligible users", "audience selection"],
    phrases: [/\b(audience|users|contacts|members|targeting|target)\b.*\b(select|choose|kaise|where|kaha|kidhar)\b/, /\b(select|choose|kaise|where|kaha|kidhar)\b.*\b(audience|users|contacts|members|targeting|target)\b/],
    weight: 2,
  },
  {
    topic: "session-health",
    terms: ["session health", "session disconnect", "sessions disconnect", "disconnect", "disconnected", "unhealthy", "health weak", "connect nahi", "reconnect", "bar bar disconnect", "not connecting"],
    phrases: [/\b(session|sessions|account)\b.*\b(disconnect|unhealthy|health|reconnect|connect nahi|not connecting|fail|problem)\b/],
    weight: 2.4,
  },
  {
    topic: "sessions",
    terms: ["session", "sessions", "telegram account", "account connect", "healthy session", "premium session", "standard session", "sending account"],
    phrases: [/\b(session|sessions|telegram account|account)\b.*\b(select|choose|kaise|where|kaha|connect|health)\b/],
    weight: 1.8,
  },
  {
    topic: "analytics",
    terms: ["analytics", "analysis", "report", "reports", "history", "status", "result", "tracking", "campaign status", "check status", "metrics"],
    phrases: [/\b(analytics|report|history|status|result|tracking|metrics)\b/, /\b(check|see|where|kaha|kidhar)\b.*\b(status|history|report|analytics)\b/],
    weight: 1.9,
  },
  { topic: "growth-intelligence", terms: ["growth intelligence", "growth", "members growth", "joins", "leaves", "snapshot"], weight: 2 },
  { topic: "add-users", terms: ["add users", "add members", "invite users", "member add", "users add", "add karna", "invite"], weight: 2 },
  { topic: "billing", terms: ["billing", "bill", "payment", "invoice", "plan", "plans", "coins", "credits", "price", "pricing", "upi"], weight: 1.9 },
  { topic: "settings", terms: ["settings", "setting", "language", "theme", "profile", "password", "security", "appearance"], weight: 1.6 },
  { topic: "support", terms: ["support", "help", "error", "issue", "problem", "contact", "laura_luxee", "@laura_luxee", "madad"], weight: 1.4 },
  { topic: "home", terms: ["home", "dashboard", "this page", "current page", "yahan", "idhar", "ye page"], weight: 1.3 },
];

const websiteTopicRules: TopicRule[] = [
  { topic: "mark-navigation", terms: ["mark8bot", "website", "product", "products", "mark", "telegram promotion", "guides", "faq", "contact", "support", "plans", "pricing"], weight: 1.5 },
  ...promotionTopicRules,
];

function scoreTopics(normalized: string, tokens: string[], scope: AssistantScope) {
  const scores = new Map<AssistantTopic, number>();
  const rules = scope === "website" ? websiteTopicRules : promotionTopicRules;
  for (const rule of rules) {
    let score = 0;
    for (const term of rule.terms) {
      const termScore = matchScore(normalized, normalizeQuestion(term));
      if (termScore) score += termScore * (rule.weight ?? 1);
    }
    for (const pattern of rule.phrases ?? []) {
      if (pattern.test(normalized)) score += 4 * (rule.weight ?? 1);
    }
    if (score > 0) scores.set(rule.topic, (scores.get(rule.topic) ?? 0) + score);
  }
  if (tokens.some((token) => ["campaign", "campaigns", "promotion", "promo", "promote"].includes(token)) && tokens.some((token) => ["group", "groups"].includes(token))) {
    scores.set("group-campaign", (scores.get("group-campaign") ?? 0) + 4);
  }
  if (tokens.includes("approved") && tokens.includes("joined") && /\b(difference|farak|antar|vs|versus|compare|kya)\b/.test(normalized)) {
    scores.set("approved-groups", (scores.get("approved-groups") ?? 0) + 4);
    scores.set("joined-groups", (scores.get("joined-groups") ?? 0) + 3);
  }
  if (tokens.includes("session") || tokens.includes("sessions")) {
    if (/\b(disconnect|nahi|fail|problem|error|health|unhealthy|reconnect)\b/.test(normalized)) {
      scores.set("session-health", (scores.get("session-health") ?? 0) + 5);
    }
  }
  return scores;
}

function detectAction(normalized: string): AssistantAction {
  if (/\b(difference|farak|antar|vs|versus|compare|alag)\b/.test(normalized)) return "difference";
  if (/\b(disconnect|nahi|nhi|problem|issue|error|fail|failed|why|kyu|kyon|not working|stuck|unhealthy)\b/.test(normalized)) return "troubleshooting";
  if (/\b(status|history|result|report|check|track|tracking|monitor)\b/.test(normalized)) return "status";
  if (/\b(select|choose|target|sirf selected|selected|filter|category|categories|audience)\b/.test(normalized)) return "selection";
  if (/\b(where|kaha|kahan|kidhar|milenge|milega|show|open|see|find|location|page|option)\b/.test(normalized)) return "navigation";
  if (/\b(how|kaise|kese|karu|kru|karna|create|start|banana|banau|banega|send|bhejna|promote|launch)\b/.test(normalized)) return "how-to";
  if (/\b(price|pricing|plan|billing|payment|invoice|credits|coins)\b/.test(normalized)) return "pricing";
  return "explain";
}

function detectQuestionType(normalized: string, action: AssistantAction): AssistantUnderstanding["questionType"] {
  if (isShortFollowUp(normalized)) return "short-follow-up";
  if (/\b(how|kaise|kese|karu|kru)\b/.test(normalized)) return "how";
  if (/\b(where|kaha|kahan|kidhar|milenge|milega)\b/.test(normalized)) return "where";
  if (/\b(why|kyu|kyon)\b/.test(normalized)) return "why";
  if (/\b(what|kya)\b/.test(normalized)) return "what";
  if (action === "status") return "status";
  return "unknown";
}

function detectEntities(normalized: string) {
  const entityPatterns: [string, RegExp][] = [
    ["Campaigns", /\bcampaigns?\b|\bpromotion\b|\bpromo\b/],
    ["Group Campaign", /\bgroup campaign\b|\bgroup promotion\b|\bgroup promo\b/],
    ["DM Campaign", /\bdm\b|\bdirect message\b/],
    ["Audience", /\baudience\b|\bcontacts\b|\bmembers\b|\busers\b/],
    ["Approved Groups", /\bapproved groups?\b/],
    ["Joined Groups", /\bjoined groups?\b/],
    ["Sessions", /\bsessions?\b|\btelegram account\b/],
    ["Analytics", /\banalytics\b|\breports?\b|\bhistory\b|\bstatus\b/],
    ["Billing", /\bbilling\b|\bplan\b|\bpayment\b|\bcredits?\b|\bcoins?\b/],
  ];
  return entityPatterns.flatMap(([label, pattern]) => (pattern.test(normalized) ? [label] : []));
}

function detectSubtopic(normalized: string, topic: AssistantTopic) {
  if (topic === "campaigns" || topic === "group-campaign" || topic === "dm-campaign") {
    if (/\bgroup\b/.test(normalized)) return "group";
    if (/\bdm\b|\bdirect\b|\bcontacts\b/.test(normalized)) return "dm";
    if (/\bstatus|history|report\b/.test(normalized)) return "history";
  }
  if (topic === "approved-groups" || topic === "joined-groups" || topic === "find-groups" || topic === "found-groups") return "groups";
  if (topic === "session-health") return "health";
  return undefined;
}

function isShortFollowUp(normalized: string) {
  const words = normalized.split(" ").filter(Boolean);
  return words.length <= 5 && /\b(aur|and|also|wala|wali|usme|isme|that|it|its|session|audience|groups?|status|history|then|phir)\b/.test(normalized);
}

function hasContextualFollowUp(normalized: string) {
  return /\b(usme|isme|its|that|same|aur|and|then|phir|kaha se|where can i)\b/.test(normalized);
}

function refineFollowUpTopic(normalized: string, previousTopic: AssistantTopic): AssistantTopic {
  if (/\bsession|account\b/.test(normalized)) return "sessions";
  if (/\baudience|target|select|choose\b/.test(normalized)) return "audience";
  if (/\bstatus|history|report|analytics|check\b/.test(normalized)) return "analytics";
  if (/\bgroup|groups|approved|joined|category|categories\b/.test(normalized)) {
    if (previousTopic === "campaigns") return "group-campaign";
    return previousTopic === "approved-groups" || previousTopic === "joined-groups" ? previousTopic : "approved-groups";
  }
  return previousTopic;
}

function isPromotionTopic(topic: AssistantTopic, confidence: number, normalized: string) {
  if (topic === "mark-navigation") return false;
  if (topic !== "unknown" && confidence >= 4) return true;
  return /\b(promotion|campaign|groups?|audience|session|analytics|billing|settings|telegram|approved|joined|category|users?)\b/.test(normalized);
}

function isWebsiteTopic(topic: AssistantTopic, confidence: number, normalized: string) {
  if (confidence >= 3.5 && topic !== "unknown") return true;
  return /\b(mark8bot|mark|promotion|campaign|telegram|plans|pricing|support|guide|website|product)\b/.test(normalized);
}

function topicIntentId(topic: AssistantTopic) {
  if (["group-campaign", "dm-campaign"].includes(topic)) return "campaigns";
  if (["approved-groups", "joined-groups", "find-groups", "found-groups", "categories"].includes(topic)) return "groups";
  if (topic === "session-health") return "sessions";
  if (topic === "growth-intelligence") return "analytics";
  if (topic === "add-users") return "audience";
  return topic === "unknown" ? undefined : topic;
}

function composeAssistantAnswer(config: AssistantContext, understanding: AssistantUnderstanding, question: string) {
  if (config.scope === "website") return composeWebsiteAnswer(config, understanding, question);
  return composePromotionAnswer(config, understanding, question);
}

function composePromotionAnswer(config: AssistantContext, understanding: AssistantUnderstanding, question: string) {
  const language = understanding.language;
  if (!understanding.inScope) return localizedFallback(config, language);
  const normalized = normalizeQuestion(question);
  if (/\b(confuse|confused|samajh nahi|samajh nhi|clear nahi|clear nhi)\b/.test(normalized) && !/\b(campaign|audience|group|session|billing|analytics)\b.*\b(create|banana|select|choose|status|health|send|bhejna|pay|invoice)\b/.test(normalized)) {
    return promotionClarification(language);
  }
  if (understanding.topic === "unknown" || understanding.confidence < 4) return promotionClarification(language);
  if (language === "hi-IN") return composePromotionHinglish(understanding);
  if (language === "ru-RU") return composePromotionRussian(understanding);
  if (language === "zh-CN") return composePromotionChinese(understanding);
  if (language === "fa-IR") return composePromotionPersian(understanding);
  return composePromotionEnglish(understanding);
}

function composeWebsiteAnswer(config: AssistantContext, understanding: AssistantUnderstanding, question: string) {
  if (!understanding.inScope) return localizedFallback(config, understanding.language);
  const intentId = topicIntentId(understanding.topic);
  if (intentId && intentTranslations[`${config.scope}:${intentId}`]?.[understanding.language]) {
    return intentTranslations[`${config.scope}:${intentId}`]?.[understanding.language] ?? config.fallback;
  }
  if (understanding.topic === "mark-navigation") {
    return understanding.language === "hi-IN"
      ? "MARK8BOT website par Products me Telegram Promotion aur MARK compare kar sakte ho. Guides setup ke liye hain, FAQ quick answers ke liye, aur Contact support ke liye."
      : "Use Products to compare Telegram Promotion and MARK, Guides for setup help, FAQ for quick answers, and Contact for support.";
  }
  return localizedIntentAnswer(config.scope, intentId ?? "promotion", understanding.language, config.fallback);
}

function composePromotionEnglish(understanding: AssistantUnderstanding) {
  switch (understanding.topic) {
    case "group-campaign":
      if (understanding.action === "selection") return "In Group Campaign, choose the approved groups or categories you want to target, then set the message and pick a healthy Session before starting.";
      return "Open Campaigns, choose Group Campaign, select approved groups or categories, set your message, choose a healthy Session, then start the campaign and watch History for status.";
    case "dm-campaign":
      return "Open Campaigns and choose DM Promotion. Prepare the DM Audience first, review eligible contacts, set the message, choose the sending Session, then monitor campaign history.";
    case "campaigns":
      if (understanding.action === "status") return "Campaign status is in Campaign History. Open the DM or Group history view and check delivery, pauses, failures and completion state there.";
      return "Open Campaigns. Use DM Promotion for contacts and Group Campaign for groups, then select the audience, set the message, choose a healthy Session and start.";
    case "audience":
      return "Open Audience to manage campaign targets. For group promotion, use approved groups or categories; for DM Promotion, prepare contacts in DM Audience before launching.";
    case "approved-groups":
      if (understanding.action === "difference") return "Approved Groups are groups you reviewed and approved for promotion. Joined Groups are groups a connected Session has joined. Approved tells LARA what is campaign-ready; Joined tells you what the Telegram account can access.";
      if (understanding.action === "selection" || understanding.entities.includes("Campaigns")) return "When creating a Group Campaign, use the targeting step to choose Approved Groups or their categories. That is how approved groups become campaign destinations.";
      return "Open Audience, then Approved Groups. That is where your approved groups are listed and ready to organize for campaign targeting.";
    case "joined-groups":
      return "Open Audience, then Joined Groups. These show groups joined by connected Sessions, useful for checking access before using them in campaigns.";
    case "find-groups":
      return "Use Find Groups to discover Telegram groups, review them in Found Groups, approve the useful ones, then organize approved groups into categories for campaigns.";
    case "categories":
      return "Use Categories to organize approved or joined groups into reusable target sets, so a Group Campaign can select a category instead of picking groups one by one.";
    case "session-health":
      return "Open Sessions and check health. If a Session keeps disconnecting, reconnect it, confirm Telegram access, and choose another healthy Session before sending a campaign.";
    case "sessions":
      return "Sessions are the Telegram accounts used for sending and checks. Pick a healthy Session before campaigns, Add Users or group workflows.";
    case "analytics":
      return "Open Analytics or Campaign History to check performance, delivery state and reports. Use Growth Intelligence when you need group growth signals and membership snapshots.";
    case "growth-intelligence":
      return "Growth Intelligence shows group growth snapshots and Telegram membership signals when a connected Session has enough access. Compare it with campaign history for results.";
    case "add-users":
      return "Open Add Users when you want to add eligible users to a destination. Check credits, destination limits and Session health before starting the job.";
    case "billing":
      return "Open Billing for plans, invoices, Coins and Add Users credits. Check it before workflows that consume credits.";
    case "settings":
      return "Open Settings for account profile, password, language, appearance and support access.";
    default:
      return promotionClarification("en-US");
  }
}

function composePromotionHinglish(understanding: AssistantUnderstanding) {
  switch (understanding.topic) {
    case "group-campaign":
      if (understanding.action === "selection") return "Group Campaign banate waqt targeting step me Approved Groups ya Categories select karo. Phir message set karo, healthy Session choose karo aur campaign start karo.";
      return "Campaigns section kholo. Groups me promotion bhejna hai to Group Campaign choose karo, approved groups ya categories select karo, message set karo, healthy Session choose karo, phir start karo.";
    case "dm-campaign":
      return "Campaigns section me DM Promotion choose karo. Pehle DM Audience prepare karo, eligible contacts review karo, message set karo, Session choose karo aur History me status check karo.";
    case "campaigns":
      if (understanding.action === "status") return "Campaign ka status Campaign History me milega. DM ya Group History kholo aur delivery, failures, pause/resume aur completion state check karo.";
      return "Campaign banane ke liye Campaigns section kholo. DM Promotion contacts ke liye hai, Group Campaign groups ke liye. Audience select karo, message set karo, healthy Session choose karo aur campaign start karo.";
    case "audience":
      return "Audience section me campaign targets manage hote hain. Group promotion ke liye Approved Groups ya Categories use karo; DM Promotion ke liye DM Audience me contacts prepare karo.";
    case "approved-groups":
      if (understanding.action === "difference") return "Approved Groups wo hain jo tumne review karke campaign ke liye approve kiye. Joined Groups wo hain jahan connected Session already joined hai. Campaign targeting me usually Approved Groups ya Categories use hote hain.";
      if (understanding.action === "selection" || understanding.entities.includes("Campaigns")) return "Approved Groups ko Group Campaign me use karne ke liye campaign banate waqt targeting step me Approved Groups ya Categories select karo.";
      return "Audience kholo, phir Approved Groups me jao. Wahi par tumhare approved groups milenge.";
    case "joined-groups":
      return "Audience me Joined Groups kholo. Wahan connected Sessions ke joined groups dikhte hain, jisse access aur campaign readiness check kar sakte ho.";
    case "find-groups":
      return "Groups lane ke liye Find Groups use karo. Found Groups me review karo, useful groups approve karo, phir Categories me organize karke Group Campaign me use karo.";
    case "categories":
      return "Categories me approved ya joined groups ko folders jaisa organize karo. Group Campaign me category select karna one-by-one groups select karne se easy hota hai.";
    case "session-health":
      return "Sessions page kholo aur health check karo. Session baar-baar disconnect ho raha hai to reconnect try karo, Telegram access confirm karo, aur campaign se pehle healthy Session choose karo.";
    case "sessions":
      return "Sessions connected Telegram accounts hote hain. Campaign, Add Users aur group checks se pehle healthy Session select karna zaroori hai.";
    case "analytics":
      return "Analytics ya Campaign History me status aur reports milte hain. Delivery, failures aur results check karo; Growth Intelligence group growth signals ke liye use hota hai.";
    case "growth-intelligence":
      return "Growth Intelligence group growth snapshots aur membership signals dikhata hai, jab connected Session ke paas access hota hai. Isko campaign history ke saath compare karo.";
    case "add-users":
      return "Add Users section users add karne ke workflow ke liye hai. Start se pehle credits, destination limits aur Session health check karo.";
    case "billing":
      return "Billing me plans, invoices, Coins aur Add Users credits milte hain. Credits use hone wale workflow se pehle Billing check kar lo.";
    case "settings":
      return "Settings me profile, password, language, theme aur support access milta hai.";
    default:
      return promotionClarification("hi-IN");
  }
}

function composePromotionRussian(understanding: AssistantUnderstanding) {
  if (understanding.topic === "session-health") return "Откройте Sessions и проверьте health. Если сессия часто отключается, переподключите ее и перед кампанией выберите здоровую Session.";
  if (understanding.topic === "approved-groups") return understanding.action === "difference"
    ? "Approved Groups - это группы, которые вы одобрили для кампаний. Joined Groups - группы, куда уже вошла подключенная Session."
    : "Откройте Audience, затем Approved Groups. Там находятся одобренные группы для дальнейшего таргетинга.";
  if (understanding.topic === "analytics") return "Откройте Analytics или Campaign History, чтобы проверить статус, доставку, ошибки и результаты кампании.";
  return "Откройте Campaigns. Для групп выберите Group Campaign, затем Approved Groups или Categories, задайте сообщение, выберите здоровую Session и запустите кампанию.";
}

function composePromotionChinese(understanding: AssistantUnderstanding) {
  if (understanding.topic === "session-health") return "打开 Sessions 查看 health。如果会话经常断开，先重新连接，再选择健康的 Session 发送活动。";
  if (understanding.topic === "approved-groups") return understanding.action === "difference"
    ? "Approved Groups 是你审核后批准用于推广的群组；Joined Groups 是已连接 Session 加入过的群组。"
    : "打开 Audience，然后进入 Approved Groups。那里可以看到已批准、可用于活动定位的群组。";
  if (understanding.topic === "analytics") return "打开 Analytics 或 Campaign History，可以查看活动状态、发送结果、失败和报表。";
  return "打开 Campaigns。群组推广选择 Group Campaign，然后选择 Approved Groups 或 Categories，设置消息，选择健康的 Session，再启动。";
}

function composePromotionPersian(understanding: AssistantUnderstanding) {
  if (understanding.topic === "session-health") return "بخش Sessions را باز کنید و health را بررسی کنید. اگر Session مرتب قطع می‌شود، دوباره وصل کنید و قبل از کمپین یک Session سالم انتخاب کنید.";
  if (understanding.topic === "approved-groups") return understanding.action === "difference"
    ? "Approved Groups گروه‌هایی هستند که برای کمپین تایید کرده‌اید. Joined Groups گروه‌هایی هستند که Session متصل وارد آن‌ها شده است."
    : "Audience را باز کنید و به Approved Groups بروید. گروه‌های تایید شده برای هدف‌گیری کمپین آنجا هستند.";
  if (understanding.topic === "analytics") return "Analytics یا Campaign History را باز کنید تا وضعیت، ارسال‌ها، خطاها و نتیجه کمپین را ببینید.";
  return "Campaigns را باز کنید. برای ارسال در گروه‌ها Group Campaign را انتخاب کنید، سپس Approved Groups یا Categories، پیام و Session سالم را انتخاب کنید.";
}

function promotionClarification(language: AssistantLanguage) {
  if (language === "hi-IN") return "Aap campaign banana, groups select karna, ya Session choose/check karna pooch rahe ho? Inme se jo part chahiye bol do, main wahi explain kar dungi.";
  if (language === "ru-RU") return "Вы спрашиваете про создание кампании, выбор групп или выбор Session? Уточните часть, и я объясню.";
  if (language === "zh-CN") return "你是想问创建 campaign、选择 groups，还是选择 Session？告诉我具体部分，我会直接解释。";
  if (language === "fa-IR") return "منظورتان ساخت campaign، انتخاب groups یا انتخاب Session است؟ همان بخش را بگویید تا توضیح بدهم.";
  return "Are you asking about creating a campaign, selecting groups, or choosing a Session? Tell me which part and I will explain that.";
}

function languageSwitchAnswer(config: AssistantContext, language: AssistantLanguage) {
  if (language === "hi-IN") return `Theek hai, ab main Hindi/Hinglish me baat karungi. ${config.scope === "website" ? "Aap MARK8BOT, Telegram Promotion, MARK, plans ya support ke baare me pooch sakte hain." : "Aap Promotion campaigns, groups, sessions, analytics, Add Users ya billing ke baare me pooch sakte hain."}`;
  if (language === "ru-RU") return `Хорошо, теперь я буду отвечать по-русски. ${config.scope === "website" ? "Можете спросить про MARK8BOT, Telegram Promotion, MARK, планы или поддержку." : "Можете спросить про Promotion campaigns, groups, sessions, analytics, Add Users или billing."}`;
  if (language === "zh-CN") return `好的，我现在用中文回答。${config.scope === "website" ? "你可以询问 MARK8BOT、Telegram Promotion、MARK、计划或支持。" : "你可以询问 Promotion campaigns、groups、sessions、analytics、Add Users 或 billing。"}`;
  if (language === "fa-IR") return `باشه، از حالا فارسی پاسخ می دهم. ${config.scope === "website" ? "می توانید درباره MARK8BOT، Telegram Promotion، MARK، پلن ها یا پشتیبانی بپرسید." : "می توانید درباره campaigns، groups، sessions، analytics، Add Users یا billing در Promotion بپرسید."}`;
  return `Sure, I will use English now. ${config.scope === "website" ? "Ask me about MARK8BOT, Telegram Promotion, MARK, plans or support." : "Ask me about Promotion campaigns, groups, sessions, analytics, Add Users or billing."}`;
}

function detectLanguageFromText(text: string): AssistantLanguage | null {
  if (/[\u0600-\u06ff]/.test(text)) return "fa-IR";
  if (/[\u0400-\u04ff]/.test(text)) return "ru-RU";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u0900-\u097f]/.test(text)) return "hi-IN";
  const hinglish = scoreHinglish(text);
  if (hinglish.score >= 3 && hinglish.score > hinglish.englishScore) return "hi-IN";
  return null;
}

export function isHinglishText(text: string) {
  const score = scoreHinglish(text);
  return score.score >= 3 && score.score >= score.englishScore;
}

function normalizeQuestion(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@._:/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hinglishWords = new Set([
  "mujhe", "muje", "mera", "meri", "mere", "batao", "btao", "samjhao", "kaise", "kese", "kaha", "kahan", "kidhar",
  "karna", "krna", "karo", "karu", "kru", "banau", "banana", "banane", "banaya", "chahiye", "chaiye", "nahi", "nhi",
  "hai", "hain", "ho", "h", "ye", "y", "kya", "kon", "kaun", "wala", "wali", "vali", "ab", "phir", "fir", "isme",
  "usme", "se", "me", "mein", "mai", "par", "pe", "ke", "ki", "ko", "aur", "ya", "help", "madad", "dhundna",
  "milenge", "milegi", "select", "add", "connect", "create", "check",
]);

const hinglishProductWords = new Set([
  "group", "groups", "campaign", "campaigns", "audience", "account", "session", "sessions", "promotion", "analytics",
  "billing", "settings", "category", "categories", "approved", "joined", "health", "users",
]);

const englishSignalWords = new Set([
  "how", "what", "where", "when", "why", "can", "could", "should", "do", "does", "did", "is", "are", "the", "my",
  "your", "show", "open", "create", "select", "check", "explain", "manage", "see",
]);

function scoreHinglish(text: string) {
  const normalized = normalizeQuestion(text);
  const words = normalized.split(" ").filter(Boolean);
  let score = 0;
  let englishScore = 0;
  for (const word of words) {
    if (hinglishWords.has(word)) score += 2;
    if (hinglishProductWords.has(word)) score += 1;
    if (englishSignalWords.has(word)) englishScore += 1;
  }
  if (/\b(kya|kaise|kese|kaha|kahan|kidhar)\b.*\b(campaign|audience|group|groups|session|analytics|billing)\b/.test(normalized)) score += 3;
  if (/\b(campaign|audience|group|groups|session|analytics|billing)\b.*\b(kya|kaise|kese|kaha|kahan|kidhar|karu|kru|banana|banau|nahi|nhi)\b/.test(normalized)) score += 3;
  if (/\b(can you|could you)\b.*\b(mujhe|muje|batao|samjhao|kar sakti|kar sakte)\b/.test(normalized)) score += 4;
  if (/\b(how do i|where can i|show me|create a|select my)\b/.test(normalized)) englishScore += 3;
  return { score, englishScore };
}

function matchScore(question: string, term: string) {
  if (!term) return 0;
  if (question === term) return 6;
  if (question.includes(term)) return term.includes(" ") ? 4 : 2;
  const words = term.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((word) => question.includes(word))) return 3;
  return 0;
}

function semanticIntentScore(question: string, intentId: string) {
  const has = (pattern: RegExp) => pattern.test(question);
  const productAction = "(how|where|kaise|kese|kaha|kahan|kidhar|banana|banau|banane|create|creation|select|check|open|show|see|milenge|kru|karu|karo)";
  if (intentId === "campaigns" && (
    has(new RegExp(`\\bcampaigns?\\b.*\\b${productAction}\\b`)) ||
    has(new RegExp(`\\b${productAction}\\b.*\\bcampaigns?\\b`)) ||
    has(/\b(dm|group promotion|send message|message bhejna)\b/)
  )) return 7;
  if (intentId === "audience" && (
    has(new RegExp(`\\baudience\\b.*\\b${productAction}\\b`)) ||
    has(new RegExp(`\\b${productAction}\\b.*\\baudience\\b`)) ||
    has(/\b(dm audience|contacts|members|invite|find users)\b/)
  )) return 7;
  if (intentId === "groups" && (
    has(new RegExp(`\\b(approved groups?|joined groups?|groups?|categories|folder)\\b.*\\b${productAction}\\b`)) ||
    has(new RegExp(`\\b${productAction}\\b.*\\b(approved groups?|joined groups?|groups?|categories|folder)\\b`)) ||
    has(/\b(find groups|found groups|writable|sendable)\b/)
  )) return 7;
  if (intentId === "sessions" && (
    has(new RegExp(`\\b(sessions?|telegram account|account)\\b.*\\b(health|connect|reconnect|nahi|check|kaise|kese)\\b`)) ||
    has(new RegExp(`\\b(health|connect|reconnect|nahi|check|kaise|kese)\\b.*\\b(sessions?|telegram account|account)\\b`))
  )) return 7;
  if (intentId === "analytics" && (
    has(/\b(analytics|growth intelligence|growth|report|chart|graph|insight)\b.*\b(kaha|where|show|check|see|kaise)\b/) ||
    has(/\b(kaha|where|show|check|see|kaise)\b.*\b(analytics|growth intelligence|growth|report|chart|graph|insight)\b/)
  )) return 7;
  if (intentId === "billing" && has(/\b(billing|plan|invoice|payment|coins?|credits|settings)\b/)) return 4;
  return 0;
}

function withPromotionContext(answer: string, intentId?: string, pageContext?: string) {
  if (!pageContext) return answer;
  const section = pageContext.split(":")[0]?.trim();
  if (!section) return answer;
  if (intentId === "current") return `${pageContext}: ${answer}`;
  const relevant = sectionIntentHints[section];
  if (relevant && relevant.includes(intentId ?? "")) {
    return `${answer} You are already on the right ${section} page, so use the visible controls there and review status before starting anything.`;
  }
  return answer;
}

const sectionIntentHints: Record<string, string[]> = {
  dashboard: ["analytics", "campaigns", "groups", "sessions"],
  campaigns: ["campaigns"],
  "dm-create": ["campaigns", "audience"],
  "group-create": ["campaigns", "groups", "sessions"],
  "dm-history": ["campaigns", "analytics"],
  "group-history": ["campaigns", "analytics"],
  audience: ["audience", "groups"],
  "groups-find": ["groups"],
  "groups-found": ["groups"],
  "groups-approved": ["groups"],
  "groups-joined": ["groups"],
  "group-categories": ["groups"],
  "dm-audience": ["audience"],
  "add-users": ["audience", "billing", "sessions"],
  analytics: ["analytics"],
  "growth-intelligence": ["analytics", "groups"],
  sessions: ["sessions"],
  billing: ["billing"],
  settings: ["billing", "support"],
};

function localizedIntentAnswer(scope: AssistantScope, intentId: string, language: AssistantLanguage, fallback: string) {
  const naturalAnswer = naturalAssistantAnswer(scope, intentId, language);
  if (naturalAnswer) return naturalAnswer;
  return intentTranslations[`${scope}:${intentId}`]?.[language] ?? fallback;
}

function naturalAssistantAnswer(scope: AssistantScope, intentId: string, language: AssistantLanguage) {
  if (language !== "hi-IN") return "";
  if (scope === "promotion-mini-app") {
    if (intentId === "campaigns") return "Campaign banane ke liye Campaigns section kholo. DM Promotion ya Group Promotion select karo, healthy Telegram session choose karo, Audience ya approved groups set karo, phir campaign create karke History me status check karo.";
    if (intentId === "audience") return "Audience select karne ke liye Audience ya DM Audience section kholo. Wahan contacts/members review karo, filters apply karo, aur campaign ke liye eligible audience choose karo.";
    if (intentId === "groups") return "Approved Groups aur Joined Groups groups area me milenge. Find Groups se groups discover karo, Found Groups review karo, approved groups ko categories me rakho, phir campaign me use karo.";
    if (intentId === "sessions") return "Sessions page par Telegram accounts ki health check karo. Agar session connect nahi ho raha, reconnect try karo; health weak ho to campaign se pehle dusra healthy session choose karo.";
    if (intentId === "analytics") return "Analytics me campaign reports aur workspace data milta hai. Growth Intelligence group growth snapshots aur Telegram membership signals dikhata hai jab session ke paas access hota hai.";
    if (intentId === "billing") return "Billing me plans, invoices, Coins aur Add Users credits dikhte hain. Credits use hone wale workflow se pehle Billing check kar lo.";
  }
  if (scope === "website") {
    if (intentId === "promotion") return "Telegram Promotion live workspace hai jahan campaigns, Audience, groups, Sessions, Analytics, Growth Intelligence aur Billing manage hote hain. Start karne ke liye Promotion Mini App open karo.";
    if (intentId === "mark8bot") return "MARK8BOT Telegram-first product platform hai. Telegram Promotion abhi live hai, aur MARK ek alag intelligence product hai jo business context ke liye ban raha hai.";
    if (intentId === "start") return "Start karne ke liye Telegram Promotion bot ya Mini App login open karo aur apne customer account se sign in karo.";
  }
  return "";
}

const intentTranslations: Partial<Record<`${AssistantScope}:${string}`, Partial<Record<AssistantLanguage, string>>>> = {
  "website:mark8bot": {
    "hi-IN": "MARK8BOT Telegram-first product platform hai. Telegram Promotion live hai campaigns, audience, groups, sessions, analytics aur billing ke liye. MARK alag intelligence product hai jo business context ke around build ho raha hai. Next: Products open karke compare karein.",
    "ru-RU": "MARK8BOT - Telegram-first платформа продуктов. Telegram Promotion уже работает для кампаний, аудиторий, групп, сессий, аналитики и биллинга. MARK - отдельный интеллектуальный продукт вокруг бизнес-контекста.",
    "zh-CN": "MARK8BOT 是 Telegram-first 产品平台。Telegram Promotion 已上线，用于活动、受众、群组、会话、分析和账单。MARK 是围绕业务上下文构建的独立智能产品。",
    "fa-IR": "MARK8BOT یک پلتفرم محصول Telegram-first است. Telegram Promotion برای کمپین، مخاطب، گروه، سشن، Analytics و billing فعال است. MARK محصول جداگانه هوشمندی بر پایه زمینه کسب و کار است.",
  },
  "website:promotion": {
    "ru-RU": "Telegram Promotion - рабочее пространство для повторяемого продвижения в Telegram: сессии, поиск групп, approve/join, категории, DM audiences, DM/group campaigns, history, billing, Analytics и Growth Intelligence.",
    "zh-CN": "Telegram Promotion 是可重复 Telegram 推广工作区：连接 sessions、查找 groups、approve/join、管理 categories、准备 DM audience、运行 DM 或 group campaigns，并查看 history、billing、Analytics 和 Growth Intelligence。",
    "fa-IR": "Telegram Promotion فضای کاری فعال برای تبلیغ تکرارپذیر تلگرام است: اتصال session، پیدا کردن گروه، approve/join، دسته بندی، DM audience، کمپین DM یا group، history، billing، Analytics و Growth Intelligence.",
  },
  "website:mark": {
    "hi-IN": "MARK ka presentation hai: MARK - Intelligence built around your business. Ye Telegram Promotion se alag hai aur operational workspace abhi live nahi hai. Start/Open/Try/Use par coming-soon access state dikhta hai.",
    "ru-RU": "MARK представлен как: MARK - Intelligence built around your business. Это отдельный от Telegram Promotion продукт; рабочий доступ пока не запущен, поэтому Start/Open/Try/Use показывает coming-soon состояние.",
    "zh-CN": "MARK 的定位是：MARK - Intelligence built around your business。它独立于 Telegram Promotion，当前操作工作区尚未上线，所以 Start/Open/Try/Use 会显示 coming-soon 状态。",
    "fa-IR": "MARK با پیام MARK - Intelligence built around your business معرفی می شود. از Telegram Promotion جداست و workspace عملیاتی هنوز live نیست، بنابراین Start/Open/Try/Use حالت coming-soon را نشان می دهد.",
  },
  "website:start": {
    "hi-IN": "Telegram Promotion start karne ke liye Promotion bot ya Mini App login use karke existing customer account se sign in karein. Bot sessions automatic continue hote hain. MARK explore karne ke liye MARK page open karein.",
    "ru-RU": "Чтобы начать Telegram Promotion, используйте Promotion bot или Mini App login и войдите в существующий customer account. Bot sessions продолжаются автоматически. MARK смотрите на публичной MARK странице.",
    "zh-CN": "开始 Telegram Promotion：使用 Promotion bot，或打开 Mini App login 并用现有 customer account 登录。Bot sessions 会自动继续。了解 MARK 请打开 MARK 页面。",
    "fa-IR": "برای شروع Telegram Promotion از Promotion bot یا Mini App login با حساب مشتری فعلی وارد شوید. Bot sessions خودکار ادامه پیدا می کنند. برای MARK صفحه MARK را باز کنید.",
  },
  "website:plans": {
    "hi-IN": "Plans, invoices, Coins, Add Users credits aur add-ons Promotion Billing ke andar manage hote hain. Standard/Premium active plan aur credits par depend karte hain.",
    "ru-RU": "Планы, invoices, Coins, Add Users credits и add-ons управляются внутри Promotion Billing. Standard/Premium зависят от активного плана и доступных credits.",
    "zh-CN": "Plans、invoices、Coins、Add Users credits 和 add-ons 在 Promotion Billing 中管理。Standard/Premium 能力取决于当前计划和可用 credits。",
    "fa-IR": "Plans، invoices، Coins، Add Users credits و add-ons داخل Promotion Billing مدیریت می شوند. Standard/Premium به plan فعال و credits موجود بستگی دارد.",
  },
  "website:lara": {
    "hi-IN": "MARK8LARA website guide hai. Telegram Promotion ke andar alag LARA helper hai jo workspace pages aur features samjhati hai. Dono abhi informational hain; voice workflow control future capability hai.",
    "ru-RU": "MARK8LARA помогает на публичном сайте. В Telegram Promotion есть отдельная LARA для вопросов внутри workspace. Сейчас обе помощницы только объясняют; voice workflow control запланирован на будущее.",
    "zh-CN": "MARK8LARA 是网站向导。Telegram Promotion 内有独立的 LARA，用于解释 workspace 页面和功能。目前两者只提供信息；语音控制工作流是未来能力。",
    "fa-IR": "MARK8LARA راهنمای website است. داخل Telegram Promotion دستیار جداگانه LARA فقط workspace و features را توضیح می دهد. هر دو فعلا informational هستند؛ voice workflow control قابلیت آینده است.",
  },
  "website:navigation": {
    "hi-IN": "Products me Telegram Promotion aur MARK milenge, Guides walkthroughs ke liye, FAQ quick answers ke liye, About company context ke liye, aur Contact support ke liye.",
    "ru-RU": "Products ведет к Telegram Promotion и MARK, Guides - к инструкциям, FAQ - к быстрым ответам, About - к контексту компании, Contact - к поддержке.",
    "zh-CN": "Products 用于 Telegram Promotion 和 MARK，Guides 用于教程，FAQ 用于快速答案，About 用于公司介绍，Contact 用于支持。",
    "fa-IR": "Products برای Telegram Promotion و MARK است، Guides برای آموزش، FAQ برای پاسخ سریع، About برای معرفی شرکت، و Contact برای پشتیبانی.",
  },
  "promotion-mini-app:current": {
    "hi-IN": "Main visible Promotion controls, page data aur workflow se pehle check karne wali cheezen samjha sakti hoon. Main abhi click ya data change nahi karti.",
    "ru-RU": "Я могу объяснить видимые controls Promotion, какие данные показаны и что проверить перед workflow. Я не нажимаю кнопки и не меняю данные.",
    "zh-CN": "我可以解释当前 Promotion 控件、页面数据，以及使用 workflow 前要检查的内容。目前我不会点击控件或修改数据。",
    "fa-IR": "می توانم controls قابل مشاهده Promotion، داده های صفحه و مواردی که قبل از workflow باید بررسی شوند را توضیح بدهم. فعلا کلیک یا تغییر داده انجام نمی دهم.",
  },
  "promotion-mini-app:campaigns": {
    "hi-IN": "Campaigns DM Promotion aur Group Promotion me split hain. Group promotion ke liye healthy Telegram session connect karein, groups approve/join karein, categories banayein, writable/sendable checks dekhein, phir campaign create karke history monitor karein.",
    "ru-RU": "Campaigns делятся на DM Promotion и Group Promotion. Для group promotion подключите healthy Telegram session, approve/join target groups, разложите их по categories, проверьте writable/sendable и затем смотрите history/status.",
    "zh-CN": "Campaigns 分为 DM Promotion 和 Group Promotion。Group promotion 需要先连接 healthy Telegram session，approve/join target groups，整理 categories，检查 writable/sendable，然后创建 campaign 并查看 history/status。",
    "fa-IR": "Campaigns به DM Promotion و Group Promotion تقسیم می شود. برای group promotion ابتدا healthy Telegram session وصل کنید، target groups را approve/join کنید، categories بسازید، writable/sendable را بررسی کنید و سپس history/status را ببینید.",
  },
  "promotion-mini-app:groups": {
    "hi-IN": "Groups discovery se Found review, approval, joining aur categories tak move hote hain. Approved aur sendable groups group campaigns ke liye best candidates hain.",
    "ru-RU": "Groups проходят discovery, found review, approval, joining и categories. Approved и sendable groups лучше всего подходят для group campaigns.",
    "zh-CN": "Groups 会经过 discovery、found review、approval、joining 和 categories。Approved 且 sendable 的 groups 更适合 group campaigns。",
    "fa-IR": "Groups از discovery به found review، approval، joining و categories می روند. گروه های approved و sendable بهترین گزینه برای group campaigns هستند.",
  },
  "promotion-mini-app:audience": {
    "hi-IN": "Audience tools permitted users ko organize karte hain. DM Audience DM campaigns ke contacts prepare karta hai, aur Add Users sessions, destination checks, jobs aur credits use karta hai.",
    "ru-RU": "Audience tools организуют eligible users. DM Audience готовит contacts для DM campaigns, а Add Users использует sessions, destination checks, tracked jobs и credits.",
    "zh-CN": "Audience tools 用于整理允许范围内的 eligible users。DM Audience 准备 DM campaigns 的 contacts；Add Users 使用 sessions、destination checks、tracked jobs 和 credits。",
    "fa-IR": "Audience tools کاربران مجاز را organize می کند. DM Audience contacts را برای DM campaigns آماده می کند و Add Users از sessions، destination checks، jobs و credits استفاده می کند.",
  },
  "promotion-mini-app:sessions": {
    "hi-IN": "Sessions customer-linked Telegram accounts hain. Health, reconnect state, access, Premium/Standard visibility aur selected-session requirements check karein.",
    "ru-RU": "Sessions - customer-linked Telegram accounts. Проверьте health, reconnect state, access, Premium/Standard visibility и selected-session requirements.",
    "zh-CN": "Sessions 是客户连接的 Telegram accounts。请检查 health、reconnect state、access、Premium/Standard visibility 和 selected-session requirements。",
    "fa-IR": "Sessions حساب های Telegram متصل به مشتری هستند. health، reconnect state، access، Premium/Standard visibility و selected-session requirements را بررسی کنید.",
  },
  "promotion-mini-app:analytics": {
    "hi-IN": "Analytics campaign aur workspace data report karta hai. Growth Intelligence stored snapshots aur Telegram membership signals use karta hai jab authorized session ke paas access ho.",
    "ru-RU": "Analytics показывает campaign и workspace data. Growth Intelligence использует stored snapshots и Telegram membership signals, когда authorized session имеет доступ.",
    "zh-CN": "Analytics 报告 campaign 和 workspace data。Growth Intelligence 在 authorized session 有足够访问权限时使用 stored snapshots 和 Telegram membership signals。",
    "fa-IR": "Analytics داده های campaign و workspace را گزارش می کند. Growth Intelligence از stored snapshots و Telegram membership signals در صورت دسترسی authorized session استفاده می کند.",
  },
  "promotion-mini-app:billing": {
    "hi-IN": "Billing me plans, invoices, Coins, Add Users credits aur add-ons dikhte hain. Settings me account, language, appearance, password aur support access hai.",
    "ru-RU": "Billing показывает plans, invoices, Coins, Add Users credits и add-ons. Settings содержит account, language, appearance, password и support access.",
    "zh-CN": "Billing 显示 plans、invoices、Coins、Add Users credits 和 add-ons。Settings 包含 account、language、appearance、password 和 support access。",
    "fa-IR": "Billing شامل plans، invoices، Coins، Add Users credits و add-ons است. Settings شامل account، language، appearance، password و support access است.",
  },
};

function localizedFallback(config: AssistantContext, language: AssistantLanguage) {
  if (language === "hi-IN") return config.scope === "website"
    ? "Main MARK8BOT, Telegram Promotion, MARK, guides, plans aur support ke baare me madad kar sakti hoon. Account help ke liye @laura_luxee se contact karein."
    : "Main Promotion workspace ke campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing aur settings samjha sakti hoon. Main abhi actions perform nahi karti.";
  if (language === "ru-RU") return config.scope === "website"
    ? "Я могу помочь с MARK8BOT, Telegram Promotion, MARK, навигацией, тарифами, гайдами и поддержкой. Для помощи по аккаунту пишите @laura_luxee."
    : "Я могу объяснить страницы Promotion: кампании, группы, аудитории, сессии, аналитику, Growth Intelligence, Add Users, биллинг и настройки. Действия я пока не выполняю.";
  if (language === "zh-CN") return config.scope === "website"
    ? "我可以介绍 MARK8BOT、Telegram Promotion、MARK、导航、计划、指南和支持。账号相关帮助请联系 @laura_luxee。"
    : "我可以解释 Promotion 工作区的 campaigns、groups、audiences、sessions、analytics、Growth Intelligence、Add Users、billing 和 settings。目前我不会执行操作。";
  if (language === "fa-IR") return config.scope === "website"
    ? "می توانم درباره MARK8BOT، Telegram Promotion، MARK، راهنماها، پلن ها و پشتیبانی کمک کنم. برای کمک حساب با @laura_luxee تماس بگیرید."
    : "می توانم بخش های Promotion مثل کمپین ها، گروه ها، مخاطبان، سشن ها، Analytics، Growth Intelligence، Add Users، billing و settings را توضیح بدهم. فعلا عملی انجام نمی دهم.";
  return config.fallback;
}
