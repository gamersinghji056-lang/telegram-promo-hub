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
      match: ["mark8bot", "company", "website", "home", "product", "platform"],
      answer:
        "MARK8BOT is a Telegram-first product platform. Telegram Promotion is live for campaign, audience, group, session, analytics and billing workflows. MARK is the separate intelligence product being built around business context.",
    },
    {
      id: "promotion",
      match: ["promotion", "telegram promotion", "campaign", "campaigns", "dm", "group promotion", "find groups", "audience"],
      answer:
        "Telegram Promotion is the live workspace for repeatable Telegram promotion: connect sessions, find groups, approve or join destinations, organize categories, build DM audiences, run DM or group campaigns, review history, manage billing and use Analytics plus Growth Intelligence.",
    },
    {
      id: "mark",
      match: ["mark", "intelligence", "ai", "business", "knowledge", "instructions"],
      answer:
        "MARK is presented as: MARK - Intelligence built around your business. It is separate from Telegram Promotion and its operational workspace is not live yet, so Start/Open/Try/Use actions show the dedicated access state.",
    },
    {
      id: "difference",
      match: ["difference", "compare", "vs", "versus", "telegram promotion and mark", "promotion and mark"],
      answer:
        "Telegram Promotion is the live operational workspace for campaigns, sessions, groups, audiences, billing, Analytics and Growth Intelligence. MARK is separate: a planned intelligence product built around business knowledge, instructions and conversation context.",
      localized: {
        "hi-IN": "Telegram Promotion live campaign, session, group, audience, billing, Analytics aur Growth Intelligence workspace hai. MARK alag planned intelligence product hai jo business knowledge, instructions aur conversation context ke around ban raha hai.",
        "ru-RU": "Telegram Promotion - рабочее пространство для кампаний, сессий, групп, аудиторий, биллинга, аналитики и Growth Intelligence. MARK - отдельный будущий интеллектуальный продукт на основе знаний бизнеса, инструкций и контекста.",
        "zh-CN": "Telegram Promotion 是已上线的运营工作区，用于活动、会话、群组、受众、账单、Analytics 和 Growth Intelligence。MARK 是独立的规划中智能产品，围绕业务知识、指令和对话上下文构建。",
        "fa-IR": "Telegram Promotion فضای کاری فعال برای کمپین ها، سشن ها، گروه ها، مخاطبان، پرداخت، Analytics و Growth Intelligence است. MARK محصول جداگانه و در حال توسعه برای هوش مبتنی بر دانش و دستورالعمل های کسب و کار است.",
      },
    },
    {
      id: "start",
      match: ["start", "get started", "begin", "register", "login", "open", "try", "use"],
      answer:
        "To start with Telegram Promotion, use the Promotion bot or open the Mini App login and sign in with your existing customer account. To explore MARK, use the MARK page; operational access is still in development.",
    },
    {
      id: "plans",
      match: ["plan", "pricing", "price", "billing", "coins", "credits", "invoice", "add users"],
      answer:
        "Plan limits, invoices, Coins, Add Users credits and add-ons are managed inside Telegram Promotion Billing. The public site avoids inventing live prices.",
    },
    {
      id: "lara",
      match: ["lara", "assistant", "voice", "microphone", "mic", "mark8lara"],
      answer:
        "MARK8LARA guides the website. Telegram Promotion also includes LARA, an in-workspace helper that explains Promotion pages and feature questions. Voice-driven workflow control is planned for the future, not active in this phase.",
    },
    {
      id: "support",
      match: ["support", "contact", "help", "laura", "@laura_luxee", "telegram"],
      answer:
        "Official MARK8BOT support is @laura_luxee on Telegram: https://t.me/laura_luxee. You can also use the Contact page for product and billing questions.",
      localized: {
        "hi-IN": "Official MARK8BOT support Telegram par @laura_luxee hai: https://t.me/laura_luxee. Product ya billing help ke liye Contact page bhi use kar sakte hain.",
        "ru-RU": "Официальная поддержка MARK8BOT в Telegram: @laura_luxee, https://t.me/laura_luxee. Для вопросов по продукту и биллингу также используйте страницу Contact.",
        "zh-CN": "MARK8BOT 官方支持是 Telegram 上的 @laura_luxee：https://t.me/laura_luxee。产品和账单问题也可以使用 Contact 页面。",
        "fa-IR": "پشتیبانی رسمی MARK8BOT در تلگرام @laura_luxee است: https://t.me/laura_luxee. برای پرسش های محصول و پرداخت می توانید از صفحه Contact هم استفاده کنید.",
      },
    },
    {
      id: "navigation",
      match: ["navigate", "where", "page", "guide", "faq", "about", "contact"],
      answer:
        "Use Products for Telegram Promotion and MARK, Guides for walkthroughs, FAQ for quick answers, About for company context, and Contact for support.",
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
    "Hi, I am LARA. I can explain the current Promotion workspace, campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings.",
  system:
    "LARA is only the Telegram Promotion Mini App helper. It answers informational questions about the current Promotion page and workspace features. It does not answer as the public website assistant, does not discuss MARK except direct product-navigation questions, and never executes campaigns, changes data, clicks controls, or performs Telegram actions.",
  fallback:
    "I can help with Promotion workspace pages: campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings. I cannot perform actions yet.",
  suggestions: ["What can I do here?", "How do I start group promotion?", "Explain sessions"],
  intents: [
    {
      id: "current",
      match: ["current", "this page", "here", "what can i do", "what is this"],
      answer:
        "I can explain this Promotion page, the main controls, what data is shown, and what to check before you use a workflow. I cannot click controls or change campaign data in this phase.",
    },
    {
      id: "campaigns",
      match: ["campaign", "campaigns", "dm", "group promotion", "history", "pause", "resume", "start group"],
      answer:
        "Campaigns are split into DM Promotion and Group Promotion. For group promotion, first connect a healthy Telegram session, approve or join target groups, organize them into categories, verify writable/sendable status where available, then create the group campaign and monitor history/status.",
      localized: {
        "hi-IN": "Campaigns DM Promotion aur Group Promotion me split hain. Group promotion ke liye pehle healthy Telegram session connect karein, groups approve/join karein, categories banayein, writable/sendable checks dekhein, phir group campaign create karke history/status monitor karein.",
        "ru-RU": "Кампании разделены на DM Promotion и Group Promotion. Для групповой кампании подключите здоровую Telegram-сессию, подтвердите или вступите в группы, разложите их по категориям, проверьте writable/sendable и затем отслеживайте статус в истории.",
        "zh-CN": "Campaigns 分为 DM Promotion 和 Group Promotion。群组推广前，请先连接健康的 Telegram 会话，批准或加入目标群组，整理分类，检查 writable/sendable 状态，然后创建群组活动并查看历史和状态。",
        "fa-IR": "کمپین ها به DM Promotion و Group Promotion تقسیم می شوند. برای تبلیغ گروهی، ابتدا سشن سالم تلگرام را وصل کنید، گروه ها را تایید یا جوین کنید، دسته بندی بسازید، وضعیت writable/sendable را بررسی کنید و سپس کمپین را از history/status پیگیری کنید.",
      },
    },
    {
      id: "groups",
      match: ["group", "groups", "found", "approved", "joined", "category", "categories", "folder", "find groups"],
      answer:
        "Groups move through discovery, found review, approval, joining and categories. Approved and sendable groups are the safest candidates for group campaigns, depending on session permissions and Telegram responses.",
    },
    {
      id: "audience",
      match: ["audience", "users", "find users", "add users", "contacts", "invite"],
      answer:
        "Audience tools help discover eligible users where permitted. Add Users uses connected sessions, destination checks, tracked jobs and available credits; review limits and job status before starting.",
    },
    {
      id: "sessions",
      match: ["session", "sessions", "telegram account", "health", "reconnect", "premium", "writable", "sendable"],
      answer:
        "Sessions are customer-linked Telegram accounts. Check health, reconnect state, access, Premium visibility and selected-session requirements before workflows that depend on Telegram permissions.",
    },
    {
      id: "analytics",
      match: ["analytics", "growth", "growth intelligence", "members", "joins", "leaves", "report", "chart"],
      answer:
        "Analytics reports campaign and workspace data. Growth Intelligence uses stored snapshots and Telegram-exposed membership signals when an authorized session has enough access; unavailable metrics are not invented.",
    },
    {
      id: "billing",
      match: ["billing", "plan", "invoice", "payment", "coin", "coins", "credits", "settings", "support"],
      answer:
        "Billing shows plans, invoices, Coins, Add Users credits and add-ons. Settings contains account, language, appearance, password and official support access.",
    },
    {
      id: "support",
      match: ["support", "help", "laura", "@laura_luxee", "problem", "issue"],
      answer:
        "For Promotion support, contact @laura_luxee on Telegram: https://t.me/laura_luxee. Include the page name, what you were trying to do and the visible error message, but never share passwords or raw session data.",
    },
    {
      id: "mark-navigation",
      match: ["mark website", "mark product", "go to mark"],
      answer:
        "MARK is a separate MARK8BOT product. For MARK product information, open the public MARK page from the website; this Mini App helper stays focused on Telegram Promotion.",
    },
  ],
};

export function normalizeLanguage(language?: string | null): AssistantLanguage | null {
  const value = String(language ?? "").toLowerCase();
  if (value.startsWith("hi")) return "hi-IN";
  if (value.startsWith("ru")) return "ru-RU";
  if (value.startsWith("zh") || value.includes("cn")) return "zh-CN";
  if (value.startsWith("fa") || value.startsWith("per")) return "fa-IR";
  if (value.startsWith("en")) return "en-US";
  return null;
}

export function inferAssistantLanguage(text: string, languageHint?: string | null): AssistantLanguage {
  const hint = normalizeLanguage(languageHint);
  if (hint) return hint;
  if (/[\u0600-\u06ff]/.test(text)) return "fa-IR";
  if (/[\u0400-\u04ff]/.test(text)) return "ru-RU";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u0900-\u097f]/.test(text)) return "hi-IN";
  return "en-US";
}

export function answerAssistantQuestion(config: AssistantContext, question: string, pageContext?: string, languageHint?: string | null) {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return config.greeting;
  const language = inferAssistantLanguage(question, languageHint);
  const scored = config.intents
    .map((intent) => ({
      intent,
      score: intent.match.reduce((total, term) => total + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const answer = scored[0]?.intent.localized?.[language] ?? scored[0]?.intent.answer ?? localizedFallback(config, language);
  if (config.scope === "promotion-mini-app" && pageContext && scored[0]?.intent.id === "current") {
    return `${pageContext}: ${answer}`;
  }
  return answer;
}

function localizedFallback(config: AssistantContext, language: AssistantLanguage) {
  if (language === "hi-IN") return config.scope === "website"
    ? "Main MARK8BOT, Telegram Promotion, MARK, guides, plans aur support ke baare me madad kar sakti hoon. Account help ke liye @laura_luxee se contact karein."
    : "Main Promotion workspace ke campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing aur settings samjha sakti hoon. Main abhi actions perform nahi karti.";
  if (language === "ru-RU") return config.scope === "website"
    ? "Я могу помочь с MARK8BOT, Telegram Promotion, MARK, навигацией, тарифами, гайдами и поддержкой. Для помощи по аккаунту пишите @laura_luxee."
    : "Я могу объяснить страницы Promotion: кампании, группы, аудитории, сессии, аналитику, Growth Intelligence, Add Users, биллинг и настройки. Действия я пока не выполняю.";
  if (language === "zh-CN") return config.scope === "website"
    ? "我可以介绍 MARK8BOT、Telegram Promotion、MARK、导航、计划、指南和支持。账户相关帮助请联系 @laura_luxee。"
    : "我可以解释 Promotion 工作区的 campaigns、groups、audiences、sessions、analytics、Growth Intelligence、Add Users、billing 和 settings。目前我不会执行操作。";
  if (language === "fa-IR") return config.scope === "website"
    ? "می توانم درباره MARK8BOT، Telegram Promotion، MARK، راهنماها، پلن ها و پشتیبانی کمک کنم. برای کمک حساب با @laura_luxee تماس بگیرید."
    : "می توانم بخش های Promotion مثل کمپین ها، گروه ها، مخاطبان، سشن ها، Analytics، Growth Intelligence، Add Users، billing و settings را توضیح بدهم. فعلا عملی انجام نمی دهم.";
  return config.fallback;
}
