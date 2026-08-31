export type AssistantScope = "website" | "promotion-mini-app";

export type AssistantContext = {
  scope: AssistantScope;
  name: string;
  storageKey: string;
  greeting: string;
  system: string;
  fallback: string;
  suggestions: string[];
  intents: {
    id: string;
    match: string[];
    answer: string;
  }[];
};

export const websiteAssistant: AssistantContext = {
  scope: "website",
  name: "MARK8LARA",
  storageKey: "mark8lara-position",
  greeting: "Hi, I am MARK8LARA. I can guide you around MARK8BOT, Telegram Promotion, MARK, plans, guides and support.",
  system:
    "MARK8LARA is the public MARK8BOT website guide. It answers informational questions about MARK8BOT, Telegram Promotion, MARK, navigation, product guides, support and getting started. It never claims to run campaigns, modify accounts, operate Telegram, or act as MARK.",
  fallback:
    "I can help with MARK8BOT products, Telegram Promotion, MARK, guides, navigation, plans and support. For account-specific help, contact @laura_luxee.",
  suggestions: ["What is Telegram Promotion?", "What is MARK?", "How do I get support?"],
  intents: [
    {
      id: "mark8bot",
      match: ["mark8bot", "company", "website", "home", "product"],
      answer:
        "MARK8BOT builds Telegram-first software. Telegram Promotion is the live workspace for promotion operations, while MARK is the separate intelligence product built around business context.",
    },
    {
      id: "promotion",
      match: ["promotion", "telegram promotion", "campaign", "campaigns", "dm", "group promotion"],
      answer:
        "Telegram Promotion helps customers connect Telegram sessions, discover and organize groups or audiences, create DM or group campaigns, review history, manage billing and use Analytics plus Growth Intelligence.",
    },
    {
      id: "mark",
      match: ["mark", "intelligence", "ai", "business"],
      answer:
        "MARK is presented as: MARK - Intelligence built around your business. Start, Try, Open or Use actions lead to the polished access state because the operational MARK workspace is not live yet.",
    },
    {
      id: "lara",
      match: ["lara", "assistant", "voice", "microphone", "mic", "mark8lara"],
      answer:
        "MARK8LARA guides the website. Telegram Promotion also includes LARA, an in-workspace helper that explains current Promotion features. Voice-driven workflow control is planned for the future, not active in this phase.",
    },
    {
      id: "support",
      match: ["support", "contact", "help", "laura", "@laura_luxee", "telegram"],
      answer:
        "Official MARK8BOT support is @laura_luxee on Telegram: https://t.me/laura_luxee. You can also use the Contact page for product and billing questions.",
    },
    {
      id: "plans",
      match: ["plan", "pricing", "price", "billing", "coins", "credits", "invoice"],
      answer:
        "Plan limits, invoices, Coins, Add Users credits and add-ons are managed inside Telegram Promotion Billing. The public site avoids inventing live prices.",
    },
    {
      id: "navigation",
      match: ["navigate", "where", "page", "guide", "faq", "about", "contact"],
      answer:
        "Use Products for Telegram Promotion and MARK, Guides for product walkthroughs, FAQ for quick answers, About for company context, and Contact for support.",
    },
  ],
};

export const promotionAssistant: AssistantContext = {
  scope: "promotion-mini-app",
  name: "LARA",
  storageKey: "promotion-lara-position",
  greeting:
    "Hi, I am LARA. I can explain the current Promotion workspace, campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings.",
  system:
    "LARA is only the Telegram Promotion Mini App helper. It answers informational questions about the current Promotion page and workspace features. It does not answer as the public website assistant, does not discuss MARK except direct product-navigation questions, and never executes campaigns, changes data, clicks controls, or performs Telegram actions.",
  fallback:
    "I can help with Promotion workspace pages: campaigns, groups, audiences, sessions, analytics, Growth Intelligence, Add Users, billing and settings. I cannot perform actions yet.",
  suggestions: ["What can I do here?", "Explain sessions", "How does Growth Intelligence work?"],
  intents: [
    {
      id: "current",
      match: ["current", "this page", "here", "what can i do"],
      answer:
        "This Promotion page is informationally supported by LARA. I can explain what the page is for, what the main controls mean, and what to check before using a feature.",
    },
    {
      id: "campaigns",
      match: ["campaign", "campaigns", "dm", "group promotion", "history", "pause", "resume"],
      answer:
        "Campaigns are split between DM Promotion and Group Promotion. Use the create pages to configure messages and targets, then use history/status views to review progress and supported controls.",
    },
    {
      id: "groups",
      match: ["group", "groups", "found", "approved", "joined", "category", "categories", "folder"],
      answer:
        "Groups move through discovery, found review, approval, joining and categories. Approved and sendable groups are used by group campaigns and related checks.",
    },
    {
      id: "audience",
      match: ["audience", "users", "find users", "add users", "contacts"],
      answer:
        "Audience tools help discover eligible users where permitted. Add Users uses connected sessions, destination checks, tracked jobs and available credits.",
    },
    {
      id: "sessions",
      match: ["session", "sessions", "telegram account", "health", "reconnect", "premium"],
      answer:
        "Sessions are customer-linked Telegram accounts. Check health, reconnect state, access, Premium visibility and selected-session requirements before workflows that depend on Telegram permissions.",
    },
    {
      id: "analytics",
      match: ["analytics", "growth", "growth intelligence", "members", "joins", "leaves", "report"],
      answer:
        "Analytics reports campaign and workspace data. Growth Intelligence uses stored snapshots and Telegram-exposed membership signals when an authorized session has enough access.",
    },
    {
      id: "billing",
      match: ["billing", "plan", "invoice", "payment", "coin", "coins", "credits", "settings", "support"],
      answer:
        "Billing shows plans, invoices, Coins, Add Users credits and add-ons. Settings contains account, language, appearance, password and official support access.",
    },
    {
      id: "mark-navigation",
      match: ["mark website", "mark product", "go to mark"],
      answer:
        "MARK is a separate MARK8BOT product. For MARK product information, open the public MARK page from the website; this Mini App helper stays focused on Telegram Promotion.",
    },
  ],
};

export function answerAssistantQuestion(config: AssistantContext, question: string, pageContext?: string) {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return config.greeting;
  const scored = config.intents
    .map((intent) => ({
      intent,
      score: intent.match.reduce((total, term) => total + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const answer = scored[0]?.intent.answer ?? config.fallback;
  if (config.scope === "promotion-mini-app" && pageContext && scored[0]?.intent.id === "current") {
    return `${pageContext}: ${answer}`;
  }
  return answer;
}
