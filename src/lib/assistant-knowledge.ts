export type AssistantScope = "website" | "promotion-mini-app";
export type AssistantLanguage = "en-US" | "hi-IN" | "ru-RU" | "zh-CN" | "fa-IR";

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

export const websiteAssistant: AssistantContext = {
  scope: "website",
  name: "MARK8LARA",
  avatarSrc: "/assistants/mark8lara-avatar.svg",
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
  avatarSrc: "/assistants/lara-avatar.svg",
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
        "campaign kaise", "group promotion kaise", "dm kaise", "message bhejna", "кампания", "личные сообщения", "групповая", "活动", "群组推广", "私信", "کمپین", "پیام",
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
      match: ["group", "groups", "found", "approved", "joined", "category", "categories", "folder", "find groups", "writable", "sendable", "group kaise", "категория", "группы", "群组", "分类", "گروه", "دسته"],
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
      match: ["session", "sessions", "telegram account", "health", "reconnect", "premium", "standard", "writable", "sendable", "login", "session health", "session kaise", "сессия", "здоровье", "会话", "健康", "سشن", "سلامت"],
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

export function inferAssistantLanguage(text: string, languageHint?: string | null): AssistantLanguage {
  const scriptLanguage = detectLanguageFromText(text);
  if (scriptLanguage) return scriptLanguage;
  return normalizeLanguage(languageHint) ?? "en-US";
}

export function answerAssistantQuestion(config: AssistantContext, question: string, pageContext?: string, languageHint?: string | null) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return config.greeting;
  const language = inferAssistantLanguage(question, languageHint);
  const scored = config.intents
    .map((intent) => ({
      intent,
      score: intent.match.reduce((total, term) => total + matchScore(normalized, normalizeQuestion(term)), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const topIntent = scored[0]?.intent;
  const answer = topIntent?.localized?.[language] ?? topIntent?.answer ?? localizedFallback(config, language);
  if (config.scope === "promotion-mini-app") {
    return withPromotionContext(answer, topIntent?.id, pageContext);
  }
  return answer;
}

function detectLanguageFromText(text: string): AssistantLanguage | null {
  if (/[\u0600-\u06ff]/.test(text)) return "fa-IR";
  if (/[\u0400-\u04ff]/.test(text)) return "ru-RU";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u0900-\u097f]/.test(text)) return "hi-IN";
  const normalized = normalizeQuestion(text);
  if (/\b(kya|kaise|kaisa|kaisi|mujhe|mujko|batao|samjhao|madad|shuru|karna|karo|chahiye|bhejna|group kaise|campaign kaise|session kaise|kitna|paisa|kahan|kidhar)\b/.test(normalized)) {
    return "hi-IN";
  }
  return null;
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

function matchScore(question: string, term: string) {
  if (!term) return 0;
  if (question === term) return 6;
  if (question.includes(term)) return term.includes(" ") ? 4 : 2;
  const words = term.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((word) => question.includes(word))) return 3;
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
