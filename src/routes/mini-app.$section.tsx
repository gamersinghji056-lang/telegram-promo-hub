/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Copy,
  CreditCard,
  Eye,
  FolderOpen,
  Gauge,
  LogOut,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { MiniAppShell } from "@/components/mini-app-shell";
import { FloatingAssistant } from "@/components/floating-assistant";
import { ProductIcon, type ProductIconName } from "@/components/product-icon";
import { TgsPlayer } from "@/components/tgs-player";
import { Button } from "@/components/ui/button";
import {
  normalizeMessageEntities,
  reconcileEntitiesAfterTextChange,
  replaceTextAndShiftEntities,
  utf16Length,
  utf16Offset,
} from "@/lib/message-entities";
import {
  addConnection,
  addApprovedGroupByUsername,
  addGroupByUsername,
  addKeyword,
  approveGroup,
  checkConnection,
  checkAddUsersDestination,
  controlCampaign,
  controlAddUsersJob,
  createApprovedGroupFolderLink,
  createCampaign,
  deleteCampaign,
  deleteGroupCategory,
  discoverAudience,
  disconnectConnection,
  findAudience,
  getAudienceDiscoveryState,
  getAnalytics,
  getGrowthIntelligence,
  discoverGrowthDestinations,
  getReferralDashboard,
  useCoinsForInvoice,
  getAccountProfile,
  getAddUsersState,
  getApprovedGroupFolderEligibility,
  getApprovedGroupFolderLinks,
  getBilling,
  getBulkJoinState,
  getCampaignDetail,
  getCampaigns,
  getConnections,
  getGroupDiscoveryState,
  getDashboard,
  getGroupCategories,
  getGroupCategoryDetail,
  getGroupWritabilitySummary,
  getGroups,
  getKeywords,
  getCustomerPreferences,
  getSupportSettings,
  getCustomEmojiCatalog,
  getCustomEmojiPreview,
  getCustomEmojiPreviews,
  getNotifications,
  getOwnActivity,
  rejectGroup,
  reconnectConnection,
  removeKeyword,
  removeConnection,
  removeGroup,
  revokeApprovedGroupFolderLink,
  getInvoiceStatus,
  checkInvoicePaymentStatus,
  requestPayment,
  requestAddUsersCreditsPayment,
  requestPremiumEmojiPayment,
  runGroupDiscovery,
  pauseGroupDiscovery,
  searchGroupDiscoveryNow,
  importApprovedGroups,
  joinGroup,
  logout as logoutCustomer,
  markNotificationsRead,
  pauseAudienceDiscovery,
  pauseBulkJoin,
  saveGroupCategory,
  saveCustomerPreferenceSettings,
  setPreferredPremiumEmojiSession,
  testSendableGroups,
  testSessionHealth,
  resumeBulkJoin,
  selectAudienceIds,
  startAddUsersJob,
  startAudienceDiscovery,
  startBulkJoin,
  startGroupDiscovery,
  startConnectionLogin,
  updateCampaign,
  updateAccountName,
  changeAccountPassword,
  directMiniAppLogin,
  directMiniAppRegister,
  verifyConnectionCode,
  verifyConnectionPassword,
  testWritableGroups,
  verifyWritableGroups,
} from "@/lib/customer.functions";
import { applyThemePreference } from "@/lib/theme";
import { promotionAssistant } from "@/lib/assistant-knowledge";
import { MINI_LANGUAGE_LABELS, applyMiniAppTranslations, miniT, normalizeMiniLanguage } from "@/lib/mini-i18n";

const valid = new Set([
  "dashboard",
  "audience",
  "sessions",
  "groups-find",
  "groups-found",
  "groups-approved",
  "groups-joined",
  "group-categories",
  "dm-audience",
  "add-users",
  "dm-create",
  "dm-history",
  "campaigns",
  "group-create",
  "group-history",
  "analytics",
  "growth-intelligence",
  "refer-earn",
  "billing",
  "settings",
]);

const titles: Record<string, string> = {
  dashboard: "Home",
  audience: "Audience",
  sessions: "Sessions",
  "groups-find": "Find Groups",
  "groups-found": "Found Groups",
  "groups-approved": "Approved Groups",
  "groups-joined": "Joined Groups",
  "group-categories": "Group Categories",
  "dm-audience": "DM Audience",
  "add-users": "Add Users",
  "dm-create": "DM Promotion",
  "dm-history": "DM History",
  campaigns: "Campaigns",
  "group-create": "Group Promotion",
  "group-history": "Group History",
  analytics: "Analytics",
  "growth-intelligence": "Growth Intelligence",
  "refer-earn": "Refer & Earn",
  billing: "Billing",
  settings: "Settings",
};

const primarySections = new Set(["dashboard", "campaigns", "audience", "analytics", "settings"]);
const parentSections: Record<string, { section: "campaigns" | "audience" | "settings"; label: string }> = {
  "dm-create": { section: "campaigns", label: "Campaigns" },
  "group-create": { section: "campaigns", label: "Campaigns" },
  "dm-history": { section: "campaigns", label: "Campaigns" },
  "group-history": { section: "campaigns", label: "Campaigns" },
  "groups-find": { section: "audience", label: "Audience" },
  "groups-found": { section: "audience", label: "Audience" },
  "groups-approved": { section: "audience", label: "Audience" },
  "groups-joined": { section: "audience", label: "Audience" },
  "group-categories": { section: "audience", label: "Audience" },
  "dm-audience": { section: "audience", label: "Audience" },
  "add-users": { section: "audience", label: "Audience" },
  "growth-intelligence": { section: "audience", label: "Audience" },
  sessions: { section: "settings", label: "Settings" },
  billing: { section: "settings", label: "Settings" },
  "refer-earn": { section: "settings", label: "Settings" },
};

const sectionContext: Record<string, string> = {
  dashboard: "Your promotion operations at a glance",
  campaigns: "Create, monitor, and manage promotion campaigns",
  audience: "Discover, organize, and grow your Telegram reach",
  analytics: "Real campaign, delivery, and audience performance",
  settings: "Accounts, billing, preferences, security, and support",
  sessions: "Connected Telegram accounts and session health",
  "groups-find": "Discover public groups using your connected accounts",
  "groups-found": "Review groups returned by discovery",
  "groups-approved": "Manage approved destinations and folder links",
  "groups-joined": "Groups joined by your connected accounts",
  "group-categories": "Organize destinations for group campaigns",
  "dm-audience": "Discover eligible users from approved sources",
  "add-users": "Configure and run tracked Telegram invite jobs",
  "dm-create": "Create a direct-user promotion campaign",
  "group-create": "Create a promotion campaign for approved groups",
  "dm-history": "Past direct-user campaign activity",
  "group-history": "Past group campaign activity",
  "growth-intelligence": "Real Telegram membership and engagement analytics",
  "refer-earn": "Direct referrals, rewards, and Coin activity",
  billing: "Plans, payments, Coins, credits, and add-ons",
};

function pageIdentity(section: string) {
  return {
    title: titles[section] ?? section,
    context: sectionContext[section] ?? "Telegram promotion workspace",
    visual: sectionVisual[section],
    parent: parentSections[section],
    primary: primarySections.has(section),
  };
}

const sectionVisual: Record<string, ProductIconName> = {
  dashboard: "home", campaigns: "campaigns", audience: "audience", analytics: "analytics", settings: "settings",
  sessions: "sessions", "groups-find": "search-groups", "groups-found": "groups", "groups-approved": "approved",
  "groups-joined": "joined", "group-categories": "categories", "dm-audience": "search-users", "add-users": "audience",
  "dm-create": "direct", "dm-history": "direct", "group-create": "groups", "group-history": "groups",
  "growth-intelligence": "growth", "refer-earn": "referral", billing: "billing",
};

const AUTH_REQUIRED_MESSAGE = "Login to continue inside Telegram Promotion.";

export const Route = createFileRoute("/mini-app/$section")({
  head: ({ params }: { params: { section: string } }) => ({
    meta: [
      { title: `${titles[params.section] ?? "Mini App"} | Telegram Promotion` },
      { name: "description", content: "Telegram-native campaign and audience control panel." },
      { property: "og:title", content: "Telegram Promotion Mini App" },
      { property: "og:description", content: "Manage Telegram promotion campaigns securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MiniAppSection,
});

function telegramAuth(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("sess");
  if (fromHash) {
    sessionStorage.setItem("customer-session", fromHash);
    history.replaceState(null, "", window.location.pathname);
    return `sess ${fromHash}`;
  }
  const session = sessionStorage.getItem("customer-session");
  if (session) return `sess ${session}`;

  const telegram = (
    window as unknown as {
      Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
    }
  ).Telegram?.WebApp;
  telegram?.ready?.();
  telegram?.expand?.();
  if (telegram?.initData) return `tma ${telegram.initData}`;
  return null;
}

async function telegramAuthReady() {
  for (let i = 0; i < 8; i += 1) {
    const auth = telegramAuth();
    if (auth) return auth;
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  return null;
}

function telegramLanguageHint() {
  if (typeof window === "undefined") return "en";
  const telegram = (
    window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
    }
  ).Telegram?.WebApp;
  return normalizeMiniLanguage(telegram?.initDataUnsafe?.user?.language_code ?? null);
}

function inputClass(extra = "") {
  return `min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1.5 text-[13px] text-foreground caret-foreground opacity-100 shadow-[inset_0_1px_1px_rgba(2,6,23,0.03)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 [-webkit-text-fill-color:currentColor] ${extra}`;
}

function panelClass(extra = "") {
  return `mini-panel min-w-0 rounded-xl border border-border/80 bg-card p-3 shadow-[0_1px_2px_rgba(2,6,23,0.06)] ${extra}`;
}

function statusTone(status?: string) {
  if (["CONNECTED", "JOINED", "SENT", "COMPLETED", "APPROVED", "OPTED_IN", "PAID", "CONFIRMED"].includes(status ?? ""))
    return "text-success";
  if (["ERROR", "FAILED", "RESTRICTED", "REJECTED", "CANCELLED", "EXPIRED", "UNDERPAID", "LATE_PAYMENT"].includes(status ?? ""))
    return "text-destructive";
  if (["PAYMENT_DETECTED", "CONFIRMING", "OVERPAID", "REVIEW_REQUIRED"].includes(status ?? ""))
    return "text-warning";
  return "text-primary";
}

function formatUsdtAmount(value: unknown) {
  const raw = String(value ?? "").trim();
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;
  return numeric.toFixed(6).replace(/\.?0+$/, "");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall back for Telegram and iOS WebViews */
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
}

function openExternalLink(url?: string | null, telegramOnly = false) {
  if (!url) return;
  const telegram = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; openLink?: (url: string) => void } } }).Telegram?.WebApp;
  if (telegramOnly && telegram?.openTelegramLink) telegram.openTelegramLink(url);
  else if (telegram?.openLink) telegram.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function healthColor(score: number) {
  const clamped = Math.max(0, Math.min(100, score));
  return `hsl(${Math.round(clamped * 1.2)}, 78%, 45%)`;
}

function DirectMiniAppLogin({
  login,
  register,
  onSuccess,
}: {
  login: (email: string, password: string) => Promise<{ token: string }>;
  register: (input: { email: string; password: string; confirmPassword: string; name?: string | null }) => Promise<{ token: string }>;
  onSuccess: (token: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "login"
          ? await login(email, password)
          : await register({ email, password, confirmPassword, name: name.trim() || null });
      sessionStorage.setItem("customer-session", result.token);
      onSuccess(result.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mini-app-compact grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <section className={panelClass("w-full max-w-sm space-y-4")}>
        <div className="flex items-center gap-3">
          <ProductIcon name="avatar" className="size-11 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Telegram Promotion</p>
            <h1 className="text-lg font-semibold">{mode === "login" ? "Login to Telegram Promotion" : "Create your Promotion account"}</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Bot sessions continue automatically. In a normal browser or Android app, use the same customer account here.
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button type="button" className={`min-h-9 rounded-md text-xs font-semibold ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={`min-h-9 rounded-md text-xs font-semibold ${mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setMode("register")}>Register</button>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          {mode === "register" ? (
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Name
              <input className={inputClass()} type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Email
            <input className={inputClass()} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Password
            <input className={inputClass()} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {mode === "register" ? (
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Confirm password
              <input className={inputClass()} type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          ) : null}
          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={busy}>{busy ? (mode === "login" ? "Logging in..." : "Creating account...") : (mode === "login" ? "LOGIN" : "REGISTER")}</Button>
        </form>
        <p className="text-xs text-muted-foreground">
          This uses the same account and workspace data as Telegram Promotion. Support: <a className="font-semibold text-primary" href="https://t.me/laura_luxee" target="_blank" rel="noreferrer">@laura_luxee</a>.
        </p>
      </section>
      <FloatingAssistant config={promotionAssistant} pageContext="login: Promotion Mini App access" />
    </main>
  );
}

function MiniAppSection() {
  const { section } = Route.useParams();
  const dashboardFn = useServerFn(getDashboard);
  const connectionsFn = useServerFn(getConnections);
  const groupsFn = useServerFn(getGroups);
  const keywordsFn = useServerFn(getKeywords);
  const campaignsFn = useServerFn(getCampaigns);
  const groupCategoriesFn = useServerFn(getGroupCategories);
  const groupWritabilitySummaryFn = useServerFn(getGroupWritabilitySummary);
  const analyticsFn = useServerFn(getAnalytics);
  const growthFn = useServerFn(getGrowthIntelligence);
  const referralFn = useServerFn(getReferralDashboard);
  const billingFn = useServerFn(getBilling);
  const logsFn = useServerFn(getOwnActivity);
  const notificationsFn = useServerFn(getNotifications);
  const markNotificationsReadFn = useServerFn(markNotificationsRead);
  const logoutFn = useServerFn(logoutCustomer);
  const profileFn = useServerFn(getAccountProfile);
  const discoveryStateFn = useServerFn(getGroupDiscoveryState);
  const audienceFn = useServerFn(findAudience);
  const audienceDiscoveryFn = useServerFn(getAudienceDiscoveryState);
  const bulkJoinStateFn = useServerFn(getBulkJoinState);
  const directLoginFn = useServerFn(directMiniAppLogin);
  const directRegisterFn = useServerFn(directMiniAppRegister);

  const actions = {
    addConnection: useServerFn(addConnection),
    startConnectionLogin: useServerFn(startConnectionLogin),
    verifyConnectionCode: useServerFn(verifyConnectionCode),
    verifyConnectionPassword: useServerFn(verifyConnectionPassword),
    checkConnection: useServerFn(checkConnection),
    checkAddUsersDestination: useServerFn(checkAddUsersDestination),
    getAddUsersState: useServerFn(getAddUsersState),
    startAddUsersJob: useServerFn(startAddUsersJob),
    controlAddUsersJob: useServerFn(controlAddUsersJob),
    testSessionHealth: useServerFn(testSessionHealth),
    reconnectConnection: useServerFn(reconnectConnection),
    disconnectConnection: useServerFn(disconnectConnection),
    removeConnection: useServerFn(removeConnection),
    addKeyword: useServerFn(addKeyword),
    removeKeyword: useServerFn(removeKeyword),
    runGroupDiscovery: useServerFn(runGroupDiscovery),
    getGroupDiscoveryState: useServerFn(getGroupDiscoveryState),
    startGroupDiscovery: useServerFn(startGroupDiscovery),
    pauseGroupDiscovery: useServerFn(pauseGroupDiscovery),
    searchGroupDiscoveryNow: useServerFn(searchGroupDiscoveryNow),
    addGroupByUsername: useServerFn(addGroupByUsername),
    addApprovedGroupByUsername: useServerFn(addApprovedGroupByUsername),
    importApprovedGroups: useServerFn(importApprovedGroups),
    getApprovedGroupFolderEligibility: useServerFn(getApprovedGroupFolderEligibility),
    getApprovedGroupFolderLinks: useServerFn(getApprovedGroupFolderLinks),
    createApprovedGroupFolderLink: useServerFn(createApprovedGroupFolderLink),
    revokeApprovedGroupFolderLink: useServerFn(revokeApprovedGroupFolderLink),
    approveGroup: useServerFn(approveGroup),
    joinGroup: useServerFn(joinGroup),
    getBulkJoinState: useServerFn(getBulkJoinState),
    startBulkJoin: useServerFn(startBulkJoin),
    pauseBulkJoin: useServerFn(pauseBulkJoin),
    resumeBulkJoin: useServerFn(resumeBulkJoin),
    rejectGroup: useServerFn(rejectGroup),
    removeGroup: useServerFn(removeGroup),
    getGroupCategoryDetail: useServerFn(getGroupCategoryDetail),
    testWritableGroups: useServerFn(testWritableGroups),
    testSendableGroups: useServerFn(testSendableGroups),
    verifyWritableGroups: useServerFn(verifyWritableGroups),
    saveGroupCategory: useServerFn(saveGroupCategory),
    deleteGroupCategory: useServerFn(deleteGroupCategory),
    getCampaignDetail: useServerFn(getCampaignDetail),
    findAudience: useServerFn(findAudience),
    selectAudienceIds: useServerFn(selectAudienceIds),
    discoverAudience: useServerFn(discoverAudience),
    getAudienceDiscoveryState: useServerFn(getAudienceDiscoveryState),
    startAudienceDiscovery: useServerFn(startAudienceDiscovery),
    pauseAudienceDiscovery: useServerFn(pauseAudienceDiscovery),
    createCampaign: useServerFn(createCampaign),
    updateCampaign: useServerFn(updateCampaign),
    deleteCampaign: useServerFn(deleteCampaign),
    controlCampaign: useServerFn(controlCampaign),
    updateAccountName: useServerFn(updateAccountName),
    changeAccountPassword: useServerFn(changeAccountPassword),
    getCustomerPreferences: useServerFn(getCustomerPreferences),
    getSupportSettings: useServerFn(getSupportSettings),
    getCustomEmojiCatalog: useServerFn(getCustomEmojiCatalog),
    getCustomEmojiPreview: useServerFn(getCustomEmojiPreview),
    getCustomEmojiPreviews: useServerFn(getCustomEmojiPreviews),
    setPreferredPremiumEmojiSession: useServerFn(setPreferredPremiumEmojiSession),
    saveCustomerPreferenceSettings: useServerFn(saveCustomerPreferenceSettings),
    requestAddUsersCreditsPayment: useServerFn(requestAddUsersCreditsPayment),
    discoverGrowthDestinations: useServerFn(discoverGrowthDestinations),
    getGrowthIntelligence: useServerFn(getGrowthIntelligence),
    useCoinsForInvoice: useServerFn(useCoinsForInvoice),
    logout: useServerFn(logoutCustomer),
  };

  const [auth, setAuth] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loadedSection, setLoadedSection] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [appLanguage, setAppLanguageState] = useState(() => normalizeMiniLanguage(typeof window !== "undefined" ? localStorage.getItem("wpay-language") : telegramLanguageHint()));
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const cacheRef = useRef(new Map<string, any>());
  const languageVersionRef = useRef(0);
  const manualLanguageRef = useRef(false);
  const currentLanguageRef = useRef(appLanguage);

  function applyAuthoritativeLanguage(value: string | null | undefined, source = "mini-app", manual = false, requestVersion = languageVersionRef.current) {
    const next = normalizeMiniLanguage(value);
    if (!manual && manualLanguageRef.current && (requestVersion < languageVersionRef.current || next !== currentLanguageRef.current)) {
      console.info("I18N_STALE_UPDATE_IGNORED", { source, attempted_locale: next, current_locale: currentLanguageRef.current, request_version: requestVersion, current_version: languageVersionRef.current });
      return;
    }
    if (manual) {
      manualLanguageRef.current = true;
      languageVersionRef.current += 1;
    }
    console.info(manual ? "I18N_LOCALE_CHANGED" : "I18N_LOCALE_SOURCE", { source, locale: next, manual });
    currentLanguageRef.current = next;
    setAppLanguageState(next);
    try {
      localStorage.setItem("wpay-language", next);
    } catch {
      /* restricted webviews can block localStorage */
    }
    applyMiniAppTranslations(next);
  }

  const loaders = useMemo<Record<string, (auth: string) => Promise<any>>>(
    () => ({
      dashboard: (a) => dashboardFn({ data: { auth: a } }),
      audience: async () => ({}),
      sessions: (a) => connectionsFn({ data: { auth: a } }),
      "groups-find": async (a) => {
        const [connections, keywords, groups, discovery] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          keywordsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "AUTO_PENDING" } }),
          discoveryStateFn({ data: { auth: a } }),
        ]);
        return { connections, keywords, groups, discovery };
      },
      "groups-found": async (a) => {
        const [connections, groups] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "FOUND" } }),
        ]);
        return { connections, groups };
      },
      "groups-approved": async (a) => {
        const [connections, groups, bulkJoin, folderLinks] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
          bulkJoinStateFn({ data: { auth: a } }),
          actions.getApprovedGroupFolderLinks({ data: { auth: a } }),
        ]);
        return { connections, groups, bulkJoin, folderLinks };
      },
      "groups-joined": async (a) => {
        const [connections, groups] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "JOINED" } }),
        ]);
        return { connections, groups };
      },
      "dm-audience": async (a) => {
        const [groups, discovery] = await Promise.all([
          groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
          audienceDiscoveryFn({ data: { auth: a } }),
        ]);
        return { groups, discovery };
      },
      "add-users": async (a) => {
        const [connections, audience, addUsers] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          audienceFn({ data: { auth: a, groupIds: [], onlyNew: true } }),
          actions.getAddUsersState({ data: { auth: a } }),
        ]);
        return { connections, audience, addUsers };
      },
      "dm-create": async (a) => {
        const [connections, audience, campaigns, billing] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          audienceFn({ data: { auth: a, groupIds: [], onlyNew: true } }),
          campaignsFn({ data: { auth: a, filter: "DM" } }),
          billingFn({ data: { auth: a } }),
        ]);
        return { connections, audience, campaigns, billing };
      },
      "dm-history": (a) => campaignsFn({ data: { auth: a, filter: "DM" } }),
      campaigns: async (a) => {
        const [campaigns, connections] = await Promise.all([
          campaignsFn({ data: { auth: a, filter: "ALL" } }),
          connectionsFn({ data: { auth: a } }),
        ]);
        return { campaigns, connections };
      },
      "group-create": async (a) => {
        const [connections, groups, categories, campaigns, billing] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
          groupCategoriesFn({ data: { auth: a } }),
          campaignsFn({ data: { auth: a, filter: "GROUP" } }),
          billingFn({ data: { auth: a } }),
        ]);
        return { connections, groups, categories, campaigns, billing };
      },
      "group-history": (a) => campaignsFn({ data: { auth: a, filter: "GROUP" } }),
      "group-categories": async (a) => {
        const [connections, groups, categories, writability] = await Promise.all([
          connectionsFn({ data: { auth: a } }),
          groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
          groupCategoriesFn({ data: { auth: a } }),
          groupWritabilitySummaryFn({ data: { auth: a } }),
        ]);
        return { connections, groups, categories, writability };
      },
      analytics: (a) => analyticsFn({ data: { auth: a } }),
      "growth-intelligence": (a) => growthFn({ data: { auth: a, range: "7D" } }),
      "refer-earn": (a) => referralFn({ data: { auth: a } }),
      billing: (a) => billingFn({ data: { auth: a } }),
      settings: async (a) => {
        const [logs, profile, preferences, support] = await Promise.all([
          logsFn({ data: { auth: a } }),
          profileFn({ data: { auth: a } }),
          actions.getCustomerPreferences({ data: { auth: a } }),
          actions.getSupportSettings({ data: { auth: a } }),
        ]);
        return { logs, profile, preferences, support };
      },
    }),
    [],
  );

  async function load(force = false, options: { quiet?: boolean } = {}) {
    const targetSection = section;
    const requestLanguageVersion = languageVersionRef.current;
    const nextAuth = await telegramAuthReady();
    if (sectionRef.current !== targetSection) return;
    const cacheKey = `${nextAuth ?? "none"}:${targetSection}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && !force) {
      setAuth(nextAuth);
      setData(cached.data);
      if (cached.data?.preferences?.language) {
        applyAuthoritativeLanguage(cached.data.preferences.language, "cache", false, requestLanguageVersion);
      }
      setLoadedSection(targetSection);
      setNotifications(cached.notifications ?? notifications);
      setProfile(cached.profile ?? profile);
      setBusy(false);
    } else {
      if (!options.quiet) {
        setBusy(true);
        setLoadedSection("");
        setData(null);
      } else if (!data) {
        setBusy(true);
        setLoadedSection("");
      }
    }
    setError("");
    setAuth(nextAuth);
    if (!valid.has(section)) {
      setError("This section does not exist.");
      setBusy(false);
      return;
    }
    if (!nextAuth) {
      setError(AUTH_REQUIRED_MESSAGE);
      setBusy(false);
      return;
    }
    try {
      const result = await loaders[targetSection]?.(nextAuth);
      if (sectionRef.current !== targetSection) return;
      setData(result);
      if (result?.preferences?.language) {
        applyAuthoritativeLanguage(result.preferences.language, "server-preferences", false, requestLanguageVersion);
      } else if (!manualLanguageRef.current) {
        applyAuthoritativeLanguage(telegramLanguageHint(), "telegram-language-code", false, requestLanguageVersion);
      }
      setLoadedSection(targetSection);
      setBusy(false);
      void notificationsFn({ data: { auth: nextAuth } }).then((notes) => {
        setNotifications(notes ?? []);
        const current = cacheRef.current.get(cacheKey) ?? {};
        cacheRef.current.set(cacheKey, { ...current, data: result, notifications: notes ?? [] });
      });
      void profileFn({ data: { auth: nextAuth } }).then((nextProfile) => {
        setProfile(nextProfile);
        const current = cacheRef.current.get(cacheKey) ?? {};
        cacheRef.current.set(cacheKey, { ...current, data: result, profile: nextProfile });
      });
      cacheRef.current.set(cacheKey, { data: result, notifications, profile });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("NO_ACCOUNT")
          ? AUTH_REQUIRED_MESSAGE
          : e instanceof Error && e.message.includes("UNAUTHENTICATED")
            ? AUTH_REQUIRED_MESSAGE
          : e instanceof Error
            ? e.message
            : "Your session could not be verified. Return to the bot and open the Mini App again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const current = telegramAuth();
    if (current) {
      try {
        await logoutFn({ data: { auth: current } });
      } catch {
        /* local logout still clears the browser session */
      }
    }
    sessionStorage.removeItem("customer-session");
    setData(null);
    setProfile(null);
    cacheRef.current.clear();
    setError(AUTH_REQUIRED_MESSAGE);
  }

  async function runAction(label: string, fn: () => Promise<void>) {
    setActionBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionBusy("");
    }
  }

  async function markAllNotifications() {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((note) => ({ ...note, read_at: note.read_at ?? readAt })));
    await runAction("mark-notifications-read", async () => {
      await markNotificationsReadFn({ data: { auth: auth ?? "" } });
    });
  }

  useEffect(() => {
    void load(false);
  }, [section]);

  useEffect(() => {
    if (typeof window === "undefined" || !auth) return;
    const groupRunning = section === "groups-find" && data?.discovery?.status === "RUNNING";
    const audienceRunning = section === "dm-audience" && data?.discovery?.state?.status === "RUNNING";
    if (!groupRunning && !audienceRunning) return;
    const timer = window.setInterval(() => {
      void load(true, { quiet: true });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [auth, section, data?.discovery?.status, data?.discovery?.state?.status]);

  useEffect(() => {
    applyMiniAppTranslations(appLanguage);
  }, [appLanguage, section, data, notice, error, showNotifications, showProfile]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error || error === AUTH_REQUIRED_MESSAGE) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const focusSelector = "input, textarea, select, [contenteditable='true']";
    const telegram = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            viewportHeight?: number;
            viewportStableHeight?: number;
            onEvent?: (event: string, handler: () => void) => void;
            offEvent?: (event: string, handler: () => void) => void;
          };
        };
      }
    ).Telegram?.WebApp;
    let lastFocused: HTMLElement | null = null;
    const layoutHeight = () =>
      Math.max(
        window.innerHeight,
        window.visualViewport?.height ?? 0,
        Number(telegram?.viewportStableHeight ?? 0),
        Number(telegram?.viewportHeight ?? 0),
      );
    const scrollFocusedIntoView = (active: HTMLElement) => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const navHeight = Number.parseFloat(
        getComputedStyle(root).getPropertyValue("--miniapp-bottom-nav-height") || "72",
      );
      const topGuard = viewportTop + 12;
      const bottomGuard = viewportTop + viewportHeight - navHeight - 18;
      const rect = active.getBoundingClientRect();
      if (rect.bottom > bottomGuard) {
        window.scrollBy({ top: rect.bottom - bottomGuard + 16, behavior: "smooth" });
      } else if (rect.top < topGuard) {
        window.scrollBy({ top: rect.top - topGuard, behavior: "smooth" });
      }
    };
    const updateViewportPadding = () => {
      const viewport = window.visualViewport;
      const visualBottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      const stableHeight =
        typeof telegram?.viewportStableHeight === "number" && telegram.viewportStableHeight > 0
          ? telegram.viewportStableHeight
          : layoutHeight();
      const telegramHeight =
        typeof telegram?.viewportHeight === "number" && telegram.viewportHeight > 0
          ? telegram.viewportHeight
          : window.innerHeight;
      const inset = Math.max(
        0,
        layoutHeight() - visualBottom,
        stableHeight - telegramHeight,
        stableHeight - (viewport?.height ?? telegramHeight) - (viewport?.offsetTop ?? 0),
      );
      const focused = document.activeElement instanceof HTMLElement && document.activeElement.matches(focusSelector);
      const keyboardOpen = focused && inset > 40;
      const navHeight = Number.parseFloat(
        getComputedStyle(root).getPropertyValue("--miniapp-bottom-nav-height") || "72",
      );
      root.style.setProperty(
        "--miniapp-keyboard-inset",
        `${Math.ceil(keyboardOpen ? inset + navHeight + 96 : 0)}px`,
      );
      root.style.setProperty("--miniapp-nav-translate", keyboardOpen ? "110%" : "0px");
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches(focusSelector)) {
        lastFocused = active;
        window.setTimeout(() => {
          scrollFocusedIntoView(active);
        }, 40);
      } else if (!focused) {
        lastFocused = null;
      }
    };
    const onFocus = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.matches(focusSelector)) {
        lastFocused = event.target;
        event.target.style.scrollMarginBottom = "calc(7rem + var(--miniapp-keyboard-inset, 0px))";
        window.setTimeout(updateViewportPadding, 60);
        window.setTimeout(updateViewportPadding, 260);
        window.setTimeout(() => scrollFocusedIntoView(event.target as HTMLElement), 360);
      }
    };
    const onBlur = () => {
      if (lastFocused) lastFocused.style.scrollMarginBottom = "";
      lastFocused = null;
      window.setTimeout(updateViewportPadding, 80);
    };
    window.visualViewport?.addEventListener("resize", updateViewportPadding);
    window.visualViewport?.addEventListener("scroll", updateViewportPadding);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onBlur);
    telegram?.onEvent?.("viewportChanged", updateViewportPadding);
    updateViewportPadding();
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportPadding);
      window.visualViewport?.removeEventListener("scroll", updateViewportPadding);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onBlur);
      telegram?.offEvent?.("viewportChanged", updateViewportPadding);
      root.style.removeProperty("--miniapp-keyboard-inset");
      root.style.removeProperty("--miniapp-nav-translate");
    };
  }, []);

  const unread = notifications.filter((n) => !n.read_at).length;
  const currentPage = pageIdentity(section);
  const guardedNotice = (origin: string) => (value: string) => {
    if (sectionRef.current === origin) setNotice(value);
  };

  if (error === AUTH_REQUIRED_MESSAGE) {
    return (
      <DirectMiniAppLogin
        login={(email, password) => directLoginFn({ data: { email, password } })}
        register={(input) => directRegisterFn({ data: input })}
        onSuccess={(token) => {
          setAuth(`sess ${token}`);
          setError("");
          void load(true);
        }}
      />
    );
  }

  return (
    <MiniAppShell
      active={section}
      headerActions={
        <>
          <Button size="icon" variant="ghost" className="size-8 min-h-8 rounded-full" aria-label="Refresh" onClick={() => load(true)} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} /></Button>
          <Button size="icon" variant="ghost" className="relative size-8 min-h-8 rounded-full" aria-label="Notifications" onClick={() => setShowNotifications(true)}><Bell />{unread ? <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">{unread}</span> : null}</Button>
          <Button size="icon" variant="ghost" className="relative size-8 min-h-8 rounded-full p-0" aria-label="Profile" onClick={() => setShowProfile(true)}><ProductIcon name="avatar" className="size-7" /></Button>
        </>
      }
    >
      <div key={section} data-page-section={section} className="mb-4 flex min-w-0 items-center gap-2.5 border-b border-border/70 pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {!currentPage.primary && currentPage.parent ? (
            <a
              href={`/mini-app/${currentPage.parent.section}`}
              aria-label={`Back to ${currentPage.parent.label}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4" />
            </a>
          ) : null}
          {currentPage.visual ? <ProductIcon name={currentPage.visual} className="hidden size-8 shrink-0 min-[390px]:block" /> : null}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{miniT(appLanguage, currentPage.title)}</h1>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{currentPage.context}</p>
          </div>
        </div>
      </div>
      {notice ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[min(88vw,360px)] -translate-x-1/2 -translate-y-1/2 border border-primary bg-card p-4 text-center text-sm font-semibold text-primary shadow-lg">
          {notice}
        </div>
      ) : null}
      {error ? (
        <SessionWarning error={error} />
      ) : busy || loadedSection !== section ? (
        <LoadingWorkspace />
      ) : (
        <CustomerContent
          section={section}
          auth={auth ?? ""}
          data={data}
          actions={actions}
          reload={() => load(true)}
          setNotice={guardedNotice(section)}
          actionBusy={actionBusy}
          runAction={runAction}
          appLanguage={appLanguage}
          setAppLanguage={applyAuthoritativeLanguage}
        />
      )}
      {showNotifications ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <section className={panelClass("max-h-[88vh] w-full max-w-md space-y-3 overflow-auto shadow-lg")}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">Notifications</p>
              <button type="button" onClick={() => setShowNotifications(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!unread || actionBusy === "mark-notifications-read"}
              onClick={markAllNotifications}
            >
              {actionBusy === "mark-notifications-read" ? "Marking..." : "MARK ALL AS READ"}
            </Button>
            {notifications.map((note) => (
              <a
                key={note.id}
                href={note.link ?? "#"}
                className="block border border-border bg-background p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{note.title}</p>
                  {!note.read_at ? <span className="text-xs text-primary">Unread</span> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{note.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </a>
            ))}
            {!notifications.length ? <Empty message="No notifications yet." /> : null}
          </section>
        </div>
      ) : null}
      {showProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <section className={panelClass("w-full max-w-sm space-y-3 shadow-lg")}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">Profile</p>
              <button type="button" onClick={() => setShowProfile(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/40 p-2.5 text-sm">
              <ProductIcon name="avatar" className="size-10 shrink-0" />
              <div className="min-w-0 space-y-0.5"><p className="truncate font-semibold">{profile?.name ?? "User001"}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p>
              <p className="text-[10px] font-semibold uppercase text-primary">{profile?.status ?? "ACTIVE"}</p></div>
            </div>
            <a
              href="/mini-app/settings"
              className="inline-flex w-full items-center justify-center border border-border bg-secondary px-3 py-2 text-sm font-semibold"
              onClick={() => setShowProfile(false)}
            >
              Account Settings
            </a>
          </section>
        </div>
      ) : null}
    </MiniAppShell>
  );
}

function SessionWarning({ error }: { error: string }) {
  return (
    <div className={panelClass("border-l-2 border-l-warning")}>
      <AlertTriangle className="size-5 text-warning" />
      <p className="mt-3 text-sm">{error}</p>
      <a
        href="https://t.me/Wpaypromotionbot"
        className="mt-4 inline-flex text-sm font-semibold text-primary"
      >
        Return to bot
      </a>
    </div>
  );
}

function CustomerContent(props: {
  section: string;
  auth: string;
  data: any;
  actions: Record<string, any>;
  reload: () => Promise<void>;
  setNotice: (value: string) => void;
  actionBusy: string;
  runAction: (label: string, fn: () => Promise<void>) => Promise<void>;
  appLanguage?: string;
  setAppLanguage?: (value: any) => void;
}) {
  const { section } = props;
  if (section === "dashboard") return <Dashboard data={props.data} />;
  if (section === "audience") return <AudienceHub />;
  if (section === "sessions") return <Sessions {...props} />;
  if (section === "groups-find") return <GroupFinder {...props} />;
  if (["groups-found", "groups-approved", "groups-joined"].includes(section))
    return <GroupList {...props} />;
  if (section === "group-categories") return <GroupCategories {...props} />;
  if (section === "dm-audience") return <DMAudience {...props} />;
  if (section === "add-users") return <AddUsersPage {...props} />;
  if (section === "dm-create") return <DMCampaign {...props} />;
  if (section === "campaigns") return <CampaignsPage {...props} />;
  if (section === "dm-history" || section === "group-history")
    return <CampaignHistory {...props} />;
  if (section === "group-create") return <GroupCampaign {...props} />;
  if (section === "analytics") return <Analytics data={props.data} />;
  if (section === "growth-intelligence") return <GrowthIntelligence {...props} />;
  if (section === "refer-earn") return <ReferEarn {...props} />;
  if (section === "billing") return <Billing {...props} />;
  if (section === "settings") return <SettingsPanel {...props} />;
  return null;
}

type HubItem = { href: string; label: string; body: string; icon: any };

function HubSection({ title, description, items }: { title: string; description: string; items: HubItem[] }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => <QuickLink key={item.href} {...item} />)}
      </div>
    </section>
  );
}

function AudienceHub() {
  return (
    <div className="space-y-4">
      <section className={panelClass("bg-gradient-to-br from-primary/10 via-card to-card") }>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Audience workspace</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">Find, organize, and grow your reach</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">Move from group discovery to qualified users without losing any step in your existing workflow.</p>
      </section>
      <HubSection title="Groups" description="Discover, review, approve, join, and organize Telegram groups." items={[
        { href: "/mini-app/groups-find", label: "Find Groups", body: "Run keyword-based group discovery.", icon: Search },
        { href: "/mini-app/groups-found", label: "Found Groups", body: "Review newly discovered destinations.", icon: FolderOpen },
        { href: "/mini-app/groups-approved", label: "Approved Groups", body: "Manage approved groups and folder links.", icon: CheckCircle2 },
        { href: "/mini-app/groups-joined", label: "Joined Groups", body: "View groups connected sessions have joined.", icon: Bot },
        { href: "/mini-app/group-categories", label: "Group Categories", body: "Organize targets for group campaigns.", icon: Settings },
      ]} />
      <HubSection title="Users" description="Build and activate a real Telegram audience." items={[
        { href: "/mini-app/dm-audience", label: "Find Users", body: "Discover eligible users from approved sources.", icon: Users },
        { href: "/mini-app/add-users", label: "Add Users", body: "Add selected users through the existing job flow.", icon: Plus },
      ]} />
      <HubSection title="Growth" description="Monitor destinations where your selected session has admin access." items={[
        { href: "/mini-app/growth-intelligence", label: "Growth Intelligence", body: "Real snapshots, membership events, and engagement.", icon: BarChart3 },
      ]} />
    </div>
  );
}

function Dashboard({ data }: { data: any }) {
  const messageStats = data?.campaigns?.messages ?? {};
  const overview = [
    ["Connected Sessions", data?.connections?.active, Bot],
    ["Approved Groups", data?.groups?.approved, FolderOpen],
    ["Writable Groups", data?.groups?.writable, CheckCircle2],
    ["Sendable Groups", data?.groups?.sendable, Send],
    ["Audience Users", data?.audience?.total, Users],
    ["Active Campaigns", data?.campaigns?.running, Send],
    ["Messages Sent", messageStats.sent_messages ?? 0, CheckCircle2],
  ];
  const quick = [
    ["/mini-app/dm-create", "DM Promotion", "Create and manage one-to-one campaigns.", Send],
    ["/mini-app/group-create", "Group Promotion", "Send approved campaigns to writable categories.", Megaphone],
    ["/mini-app/groups-find", "Group Discovery", "Find and approve public Telegram groups.", Search],
    ["/mini-app/dm-audience", "Find Users", "Build eligible audience from approved sources.", Users],
  ];
  return (
    <div className="space-y-4">
      {Number(data?.connections?.total ?? 0) === 0 ? (
        <section className="border-2 border-primary bg-card p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-5 text-primary" />
            <div>
              <p className="text-lg font-semibold">Connect your first Telegram account to start.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Group Finder, DM Promotion, and Group Promotion require an authorized Telegram user
                session.
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="relative overflow-hidden rounded-xl border border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_14%,var(--card)),color-mix(in_oklch,var(--chart-5)_7%,var(--card)))] p-3 shadow-[0_12px_30px_-24px_color-mix(in_oklch,var(--primary)_45%,transparent)]">
        <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Current workspace</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight">{data?.subscription?.planName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Real account usage and promotion readiness</p>
          </div>
          <ProductIcon name="campaigns" className="size-11 shrink-0 drop-shadow-sm" />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary"
            style={{
              width: `${Math.min(100, (data?.usage?.messagesUsed / Math.max(data?.usage?.messageLimit, 1)) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {data?.usage?.messagesUsed ?? 0} / {data?.usage?.messageLimit ?? 0} messages
        </p>
      </section>
      <div><h2 className="text-sm font-bold">Operational overview</h2><p className="mb-2 text-xs text-muted-foreground">Live production totals</p></div>
      <div className="-mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {overview.map(([label, value, Icon]) => (
          <MetricCard key={String(label)} label={label as string} value={Number(value ?? 0)} icon={Icon as any} />
        ))}
      </div>
      <section className={panelClass("space-y-3")}>
        <div className="flex items-center justify-between">
          <p className="font-semibold">Campaign Status</p>
          <p className="text-xs text-muted-foreground">Real job totals</p>
        </div>
        <CampaignDonut
          stats={{
            total: messageStats.total_messages ?? 0,
            sent: messageStats.sent_messages ?? 0,
            pending: messageStats.pending_messages ?? 0,
            failed: messageStats.failed_messages ?? 0,
          }}
        />
      </section>
      <section className={panelClass("space-y-3 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--chart-2)_16%,transparent),transparent_45%),linear-gradient(135deg,color-mix(in_oklch,var(--primary)_8%,var(--card)),var(--card))]")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Promotion pulse</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Campaign and audience movement</h2>
            <p className="mt-1 text-xs text-muted-foreground">Visualized from current workspace totals.</p>
          </div>
          <MiniProgressRing
            label="Sent"
            value={Number(messageStats.sent_messages ?? 0)}
            total={Number(messageStats.total_messages ?? 0)}
          />
        </div>
        <MiniDashboardLine
          sent={Number(messageStats.sent_messages ?? 0)}
          pending={Number(messageStats.pending_messages ?? 0)}
          failed={Number(messageStats.failed_messages ?? 0)}
          audience={Number(data?.audience?.total ?? 0)}
          groups={Number(data?.groups?.approved ?? 0)}
        />
      </section>
      <div className="grid gap-2 sm:grid-cols-3">
        <DashboardSignalCard title="Audience / Groups" icon={Users} rows={[
          ["Found", data?.groups?.found ?? 0],
          ["Approved", data?.groups?.approved ?? 0],
          ["Joined", data?.groups?.joined ?? 0],
        ]} />
        <DashboardSignalCard title="Session Health" icon={ShieldCheck} rows={[
          ["Connected", data?.connections?.active ?? 0],
          ["Total", data?.connections?.total ?? 0],
          ["Writable", data?.groups?.writable ?? 0],
        ]} />
        <DashboardSignalCard title="Growth Intelligence" icon={BarChart3} rows={[
          ["Members tracked", data?.growth?.members ?? 0],
          ["Signals", data?.growth?.events ?? 0],
          ["Reports", data?.analytics?.reports ?? 0],
        ]} />
      </div>
      <div><h2 className="text-sm font-bold">Quick actions</h2><p className="mb-2 text-xs text-muted-foreground">Start your next promotion workflow</p></div>
      <div className="-mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quick.map(([href, label, body, Icon]) => (
          <QuickLink key={String(href)} href={href as string} label={label as string} body={body as string} icon={Icon as any} />
        ))}
      </div>
    </div>
  );
}

function MiniProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid size-16 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--success)_0_calc(var(--pct)*1%),color-mix(in_oklch,var(--muted)_80%,transparent)_0)] p-1.5" style={{ "--pct": pct } as CSSProperties & Record<"--pct", number>}>
      <div className="grid size-full place-items-center rounded-full bg-card text-center">
        <span className="text-sm font-bold tabular-nums">{pct}%</span>
        <span className="-mt-1 text-[9px] uppercase text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function MiniDashboardLine({ sent, pending, failed, audience, groups }: { sent: number; pending: number; failed: number; audience: number; groups: number }) {
  const values = [groups, audience, pending, sent, sent + groups, sent + audience - failed].map((value) => Math.max(0, Number(value || 0)));
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${12 + index * 55},${86 - (value / max) * 64}`).join(" ");
  return (
    <div className="h-32 rounded-xl border border-border/80 bg-background/60 p-2">
      <svg className="h-full w-full overflow-visible" viewBox="0 0 292 104" role="img" aria-label="Campaign and audience movement chart">
        {[20, 46, 72, 98].map((y) => <line key={y} x1="8" x2="284" y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 5" />)}
        <polyline points={points} fill="none" stroke="var(--chart-2)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".7" transform="translate(0 8)" />
        {values.map((value, index) => {
          const x = 12 + index * 55;
          const y = 86 - (value / max) * 64;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" fill="var(--chart-2)" />;
        })}
      </svg>
    </div>
  );
}

function DashboardSignalCard({ title, icon: Icon, rows }: { title: string; icon: any; rows: [string, unknown][] }) {
  return (
    <section className={panelClass("space-y-2")}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-muted/35 px-2.5 py-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{Number(value ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  const visual = productVisual(label);
  return (
    <section className={panelClass("min-h-[4.75rem]") }>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs leading-4 text-muted-foreground">{label}</p>
        {visual ? <ProductIcon name={visual} className="size-7 shrink-0" /> : <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/12 text-primary"><span className="absolute -right-1 -top-1 size-3 rounded-full bg-primary/15" /><Icon className="relative size-3.5" strokeWidth={2.2} /></span>}
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
    </section>
  );
}

function QuickLink({ href, label, body, icon: Icon }: { href: string; label: string; body: string; icon: any }) {
  const visual = productVisual(label);
  return (
    <a
      className="group flex min-h-[4.75rem] min-w-0 items-center gap-2.5 rounded-xl border border-border/80 bg-card p-3 text-left shadow-[0_1px_2px_rgba(2,6,23,0.05)] outline-none transition-colors hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
      href={href}
    >
      {visual ? <ProductIcon name={visual} className="size-9 shrink-0 drop-shadow-sm" /> : <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/12 text-primary"><span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-primary/15" /><Icon className="relative size-4" strokeWidth={2.2} /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </a>
  );
}

function Sessions({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const rows = Array.isArray(data) ? data : [];
  const premiumEmojiSessionMode = rows[0]?.premiumEmojiSessionMode ?? "AUTO";
  const preferredPremiumEmojiConnectionId = rows[0]?.preferredPremiumEmojiConnectionId ?? null;
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"PHONE" | "CODE" | "PASSWORD">("PHONE");
  const [cardAuth, setCardAuth] = useState<Record<string, { step: "CODE" | "PASSWORD"; code: string; password: string }>>({});
  const [cardMessage, setCardMessage] = useState<Record<string, string>>({});
  const [localBusy, setLocalBusy] = useState("");
  const busy = localBusy || actionBusy;
  async function sessionAction(key: string, connectionKey: string, fn: () => Promise<void>) {
    setLocalBusy(key);
    setCardMessage((current) => ({ ...current, [connectionKey]: "" }));
    try {
      await fn();
    } catch (error) {
      setCardMessage((current) => ({
        ...current,
        [connectionKey]: error instanceof Error ? error.message : "Action failed.",
      }));
    } finally {
      setLocalBusy("");
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await sessionAction("send-code", "new", async () => {
      const result = await actions.startConnectionLogin({ data: { auth, label, phone } });
      setConnectionId(result.connection.id);
      setStep("CODE");
      setNotice(result.isCodeViaApp ? "Code sent to your Telegram app." : "Code sent by Telegram.");
      await reload();
    });
  }
  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    await sessionAction("verify-code", connectionId || "new", async () => {
      const result = await actions.verifyConnectionCode({ data: { auth, connectionId, code } });
      if (result.step === "PASSWORD") {
        setStep("PASSWORD");
        setNotice("Telegram requires your 2FA password.");
        return;
      }
      setStep("PHONE");
      setPhone("");
      setCode("");
      setPassword("");
      setConnectionId("");
      setNotice("Telegram session connected.");
      await reload();
    });
  }
  async function verifyPassword(e: FormEvent) {
    e.preventDefault();
    await sessionAction("verify-password", connectionId || "new", async () => {
      await actions.verifyConnectionPassword({ data: { auth, connectionId, password } });
      setStep("PHONE");
      setPhone("");
      setCode("");
      setPassword("");
      setConnectionId("");
      setNotice("Telegram session connected.");
      await reload();
    });
  }
  async function check(id: string) {
    await sessionAction(`check-${id}`, id, async () => {
      const result = await actions.checkConnection({ data: { auth, id } });
      setCardMessage((current) => ({
        ...current,
        [id]: result.ok ? "HEALTHY" : result.error || "DISCONNECTED",
      }));
      await reload();
    });
  }
  async function testHealth(id: string) {
    await sessionAction(`test-health-${id}`, id, async () => {
      const result = await actions.testSessionHealth({ data: { auth, id } });
      const failed = (result.diagnostics ?? []).filter((item: any) => item.status === "FAIL").length;
      const warned = (result.diagnostics ?? []).filter((item: any) => item.status === "WARN").length;
      setCardMessage((current) => ({
        ...current,
        [id]: `Health ${result.health_score ?? 0}% - ${failed ? `${failed} failed` : warned ? `${warned} warning(s)` : "diagnostics passed"}`,
      }));
      await reload();
    });
  }
  async function setPremiumEmojiSession(mode: "AUTO" | "MANUAL", id?: string | null) {
    await sessionAction(`premium-emoji-session-${id ?? "auto"}`, id ?? "premium-auto", async () => {
      await actions.setPreferredPremiumEmojiSession({ data: { auth, mode, connectionId: id ?? null } });
      setNotice(mode === "AUTO" ? "Premium Emoji session selection set to AUTO." : "Preferred Premium Emoji session saved.");
      await reload();
    });
  }
  async function reconnect(row: any) {
    await sessionAction(`reconnect-${row.id}`, row.id, async () => {
      const result = await actions.reconnectConnection({ data: { auth, id: row.id } });
      setCardAuth((current) => ({
        ...current,
        [row.id]: { step: result.step === "PASSWORD" ? "PASSWORD" : "CODE", code: "", password: "" },
      }));
      setCardMessage((current) => ({
        ...current,
        [row.id]: `Code sent to ${result.connection?.phone_masked ?? row.phone_masked ?? "saved phone"}.`,
      }));
      await reload();
    });
  }
  async function verifyCardCode(row: any, e: FormEvent) {
    e.preventDefault();
    const state = cardAuth[row.id] ?? { step: "CODE", code: "", password: "" };
    await sessionAction(`verify-code-${row.id}`, row.id, async () => {
      const result = await actions.verifyConnectionCode({ data: { auth, connectionId: row.id, code: state.code } });
      if (result.step === "PASSWORD") {
        setCardAuth((current) => ({ ...current, [row.id]: { ...state, step: "PASSWORD", password: "" } }));
        setCardMessage((current) => ({ ...current, [row.id]: "Telegram requires your 2FA password." }));
        return;
      }
      setCardAuth((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setCardMessage((current) => ({ ...current, [row.id]: "HEALTHY" }));
      await reload();
    });
  }
  async function verifyCardPassword(row: any, e: FormEvent) {
    e.preventDefault();
    const state = cardAuth[row.id] ?? { step: "PASSWORD", code: "", password: "" };
    await sessionAction(`verify-password-${row.id}`, row.id, async () => {
      await actions.verifyConnectionPassword({ data: { auth, connectionId: row.id, password: state.password } });
      setCardAuth((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setCardMessage((current) => ({ ...current, [row.id]: "HEALTHY" }));
      await reload();
    });
  }
  async function cancelCard(row: any) {
    await sessionAction(`cancel-${row.id}`, row.id, async () => {
      await actions.disconnectConnection({ data: { auth, id: row.id } });
      setCardAuth((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setCardMessage((current) => ({ ...current, [row.id]: "Reconnect cancelled." }));
      await reload();
    });
  }
  return (
    <div className="space-y-4">
      {step === "PHONE" ? (
        <form onSubmit={submit} className={panelClass("space-y-3")}>
          <p className="text-lg font-semibold">Add Telegram Session</p>
          <p className="text-sm text-muted-foreground">
            Authorize a Telegram user account with MTProto. OTP and 2FA password are never logged or
            stored.
          </p>
          <input
            className={inputClass()}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Account label"
          />
          <input
            className={inputClass()}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            inputMode="tel"
          />
          {cardMessage.new ? <p className="text-sm text-warning">{cardMessage.new}</p> : null}
          <Button type="submit" className="w-full" disabled={!phone || busy === "send-code"}>
            <Plus className="mr-2 size-4" /> {busy === "send-code" ? "Sending..." : "SEND CODE"}
          </Button>
        </form>
      ) : null}
      {step === "CODE" ? (
        <form onSubmit={verifyCode} className={panelClass("space-y-3")}>
          <p className="text-lg font-semibold">Telegram Login Code</p>
          <input
            className={inputClass()}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Login code"
            inputMode="numeric"
          />
          <Button type="submit" className="w-full" disabled={!code || busy === "verify-code"}>
            {busy === "verify-code" ? "Verifying..." : "VERIFY CODE"}
          </Button>
        </form>
      ) : null}
      {step === "PASSWORD" ? (
        <form onSubmit={verifyPassword} className={panelClass("space-y-3")}>
          <p className="text-lg font-semibold">Telegram 2FA Password</p>
          <input
            className={inputClass()}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="2FA password"
            type="password"
          />
          <Button type="submit" className="w-full" disabled={!password || busy === "verify-password"}>
            {busy === "verify-password" ? "Connecting..." : "CONNECT SESSION"}
          </Button>
        </form>
      ) : null}
      <div className="space-y-3">
        {rows.map((row: any) => {
          const authState =
            cardAuth[row.id] ??
            (row.status === "AUTH_CODE_SENT" || row.health === "REQUIRES_CODE"
              ? { step: "CODE" as const, code: "", password: "" }
              : row.status === "TWO_FACTOR_REQUIRED"
                ? { step: "PASSWORD" as const, code: "", password: "" }
                : null);
          const score = Number(row.health_score ?? 75);
          const isPremium = row.telegram_premium === true;
          const reconnectRequired = row.health === "RECONNECT_REQUIRED" || row.session_error_code === "AUTH_KEY_UNREGISTERED";
          const canPreferForEmoji = row.status === "CONNECTED" && row.has_session && !reconnectRequired && isPremium;
          const preferred = premiumEmojiSessionMode === "MANUAL" && preferredPremiumEmojiConnectionId === row.id;
          return (
          <article key={row.id} className={panelClass()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  <span>{row.account_name ?? row.label}</span>
                  {isPremium ? (
                    <span title="Telegram Premium" aria-label="Telegram Premium" className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Sparkles className="size-3.5" />
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.username ? `@${row.username}` : "Username pending"} | ID{" "}
                  {row.telegram_user_id ?? row.telegram_id ?? "pending"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phone {row.phone_masked ?? "not saved"} | Health {row.health ?? "unknown"}
                </p>
              </div>
              <span className={`text-xs font-semibold ${statusTone(row.status)}`}>
                {reconnectRequired ? "RECONNECT REQUIRED" : row.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {preferred ? <span className="border border-primary px-2 py-1 font-semibold text-primary">Premium Emoji preferred</span> : null}
              {row.telegram_premium_checked_at ? (
                <span className="text-muted-foreground">Checked {new Date(row.telegram_premium_checked_at).toLocaleString()}</span>
              ) : null}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Health {score}%</span>
                <span className="text-muted-foreground">{row.health_summary ?? "Health not tested yet."}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: healthColor(score) }}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <p>
                Last active:{" "}
                {row.last_active_at ? new Date(row.last_active_at).toLocaleString() : "never"}
              </p>
              <p>
                Last used:{" "}
                {row.last_used_at ? new Date(row.last_used_at).toLocaleString() : "never"}
              </p>
              <p>Restriction: {row.restriction_status ?? "NONE"}</p>
              <p>{reconnectRequired ? "Telegram session expired. Reconnect this account." : row.restriction_reason ?? row.error_message ?? "No errors"}</p>
            </div>
            {cardMessage[row.id] ? (
              <p className="mt-3 text-sm font-semibold text-primary">{cardMessage[row.id]}</p>
            ) : null}
            {authState?.step === "CODE" ? (
              <form className="mt-4 space-y-3 border-t border-border pt-3" onSubmit={(e) => verifyCardCode(row, e)}>
                <p className="text-sm font-semibold">Code sent to {row.phone_masked ?? "saved phone"}</p>
                <input
                  className={inputClass()}
                  value={authState.code}
                  onChange={(e) =>
                    setCardAuth((current) => ({
                      ...current,
                      [row.id]: { ...authState, code: e.target.value },
                    }))
                  }
                  placeholder="OTP code"
                  inputMode="numeric"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" type="submit" disabled={!authState.code || busy === `verify-code-${row.id}`}>
                    {busy === `verify-code-${row.id}` ? "Verifying..." : "VERIFY CODE"}
                  </Button>
                  <Button size="sm" type="button" variant="secondary" disabled={busy === `reconnect-${row.id}`} onClick={() => reconnect(row)}>
                    {busy === `reconnect-${row.id}` ? "Sending..." : "RESEND CODE"}
                  </Button>
                  <Button size="sm" type="button" variant="secondary" disabled={busy === `cancel-${row.id}`} onClick={() => cancelCard(row)}>
                    {busy === `cancel-${row.id}` ? "Cancelling..." : "CANCEL"}
                  </Button>
                </div>
              </form>
            ) : null}
            {authState?.step === "PASSWORD" ? (
              <form className="mt-4 space-y-3 border-t border-border pt-3" onSubmit={(e) => verifyCardPassword(row, e)}>
                <p className="text-sm font-semibold">Telegram 2FA Password</p>
                <input
                  className={inputClass()}
                  value={authState.password}
                  onChange={(e) =>
                    setCardAuth((current) => ({
                      ...current,
                      [row.id]: { ...authState, password: e.target.value },
                    }))
                  }
                  placeholder="2FA password"
                  type="password"
                />
                <Button size="sm" type="submit" disabled={!authState.password || busy === `verify-password-${row.id}`}>
                  {busy === `verify-password-${row.id}` ? "Connecting..." : "CONNECT SESSION"}
                </Button>
              </form>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy === `check-${row.id}`} onClick={() => check(row.id)}>
                {busy === `check-${row.id}` ? "Checking..." : "CHECK STATUS"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy === `test-health-${row.id}`} onClick={() => testHealth(row.id)}>
                {busy === `test-health-${row.id}` ? "Testing..." : "TEST HEALTH"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy === `reconnect-${row.id}`} onClick={() => reconnect(row)}>
                {busy === `reconnect-${row.id}` ? "Sending..." : "RECONNECT"}
              </Button>
              {canPreferForEmoji ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === `premium-emoji-session-${row.id}` || preferred}
                  onClick={() => setPremiumEmojiSession("MANUAL", row.id)}
                >
                  {preferred ? "PREFERRED PREMIUM EMOJI SESSION" : "SET AS PREMIUM EMOJI SESSION"}
                </Button>
              ) : null}
              {preferred ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === "premium-emoji-session-auto"}
                  onClick={() => setPremiumEmojiSession("AUTO")}
                >
                  AUTO PREMIUM EMOJI SESSION
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === `disconnect-${row.id}`}
                onClick={() =>
                  sessionAction(`disconnect-${row.id}`, row.id, async () => {
                    await actions.disconnectConnection({ data: { auth, id: row.id } });
                    setCardMessage((current) => ({ ...current, [row.id]: "DISCONNECTED" }));
                    await reload();
                  })
                }
              >
                {busy === `disconnect-${row.id}` ? "Disconnecting..." : "DISCONNECT"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === `delete-${row.id}`}
                onClick={() => {
                  if (!confirm("Delete this Telegram session permanently?")) return;
                  void sessionAction(`delete-${row.id}`, row.id, async () => {
                    await actions.removeConnection({ data: { auth, id: row.id } });
                    await reload();
                  });
                }}
              >
                {busy === `delete-${row.id}` ? "Deleting..." : "DELETE SESSION"}
              </Button>
            </div>
          </article>
          );
        })}
        {!rows.length ? <Empty message="No Telegram sessions connected yet." /> : null}
      </div>
    </div>
  );
}

function SessionSelect({ value, onChange, connections, label }: any) {
  const rows = connections ?? [];
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <select className={inputClass()} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select session</option>
        {rows.map((c: any) => {
          const waitingForAuth = ["AUTH_CODE_SENT", "TWO_FACTOR_REQUIRED", "DISCONNECTED"].includes(
            String(c.status),
          );
          const requiresAction =
            String(c.health) === "REQUIRES_ACTION" &&
            String(c.restriction_status) === "REQUIRES_ACTION";
          const usable = Boolean(c.has_session) && !waitingForAuth && !requiresAction;
          return (
            <option key={c.id} value={c.id} disabled={!usable}>
              {c.username ? `@${c.username}` : c.label} -{" "}
              {usable ? c.health ?? c.status : "authorization required"}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function GroupFinder({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [keyword, setKeyword] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const keywords = (data?.keywords ?? []).map((k: any) => String(k.keyword));
  const discovery = data?.discovery ?? {};
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  useEffect(() => {
    const saved = new Set(keywords);
    const preferred = ((discovery.selected_keywords ?? discovery.keywords ?? keywords) as string[])
      .map(String)
      .filter((k) => saved.has(k));
    setSelectedKeywords((current) => {
      const kept = current.filter((k) => saved.has(k));
      return kept.length ? kept : preferred.length ? preferred : keywords;
    });
  }, [keywords.join("|"), (discovery.selected_keywords ?? discovery.keywords ?? []).join("|")]);
  const toggleKeyword = (value: string) => {
    setSelectedKeywords((current) =>
      current.includes(value) ? current.filter((k) => k !== value) : [...current, value],
    );
  };
  async function addKey(e: FormEvent) {
    e.preventDefault();
    await runAction("add-keyword", async () => {
      await actions.addKeyword({ data: { auth, keyword } });
      setKeyword("");
      setNotice("Keyword saved.");
      await reload();
    });
  }
  async function searchGroups() {
    await runAction("search-groups", async () => {
      const result = await actions.searchGroupDiscoveryNow({
        data: { auth, connectionId: connectionId || null, keywords: selectedKeywords },
      });
      setNotice(`${result.added} new group(s) found. Discovery progress saved.`);
      await reload();
    });
  }
  async function startDiscovery() {
    await runAction("start-discovery", async () => {
      await actions.startGroupDiscovery({ data: { auth, connectionId, keywords: selectedKeywords } });
      setNotice("Group discovery started.");
      await reload();
    });
  }
  async function pauseDiscovery() {
    await runAction("pause-discovery", async () => {
      await actions.pauseGroupDiscovery({ data: { auth } });
      setNotice("Group discovery paused.");
      await reload();
    });
  }
  return (
    <div className="space-y-4">
      <form onSubmit={addKey} className={panelClass("space-y-3")}>
        <p className="font-semibold">Saved Keywords</p>
        <div className="flex gap-2">
          <input
            className={inputClass()}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Education, Courses, Learning"
          />
          <Button type="submit" size="icon" aria-label="Add keyword">
            <Plus />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data?.keywords ?? []).map((k: any) => (
            <span
              key={k.id}
              className="inline-flex items-center gap-2 border border-border px-2 py-1 text-xs"
            >
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selectedKeywords.includes(String(k.keyword))}
                  onChange={() => toggleKeyword(String(k.keyword))}
                />
                {k.keyword}
              </label>
              <button
                type="button"
                disabled={!!actionBusy}
                aria-label={`Remove ${k.keyword}`}
                onClick={() =>
                  runAction(`remove-keyword-${k.id}`, async () => {
                    await actions.removeKeyword({ data: { auth, id: k.id } });
                    await reload();
                  })
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </form>
      <section className={panelClass("space-y-3")}>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
          <Stat label="Status" value={discovery.status ?? "IDLE"} />
          <Stat label="Selected Keywords" value={selectedKeywords.length} />
          <Stat label="Groups Found Total" value={discovery.total_found ?? data?.groups?.length ?? 0} />
          <Stat
            label="Last Search"
            value={discovery.last_search_at ? new Date(discovery.last_search_at).toLocaleString() : "never"}
          />
          <Stat label="New This Run" value={discovery.new_groups_found ?? 0} />
          <Stat label="Duplicates" value={discovery.duplicates_found ?? 0} />
          <Stat
            label="Next Search"
            value={discovery.next_search_at ? new Date(discovery.next_search_at).toLocaleString() : "not scheduled"}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Current Keyword: {discovery.current_keyword ?? "none"} | Errors: {(discovery.errors ?? []).length}
        </p>
        {discovery.status === "RUNNING" ? (
          <p className="text-xs text-success">Running in the background. You can close the app and return later.</p>
        ) : null}
        {discovery.last_error ? (
          <p className="text-sm text-warning">{discovery.last_error}</p>
        ) : null}
        {(discovery.errors ?? []).length ? (
          <details className="text-xs text-muted-foreground">
            <summary>Discovery Errors ({(discovery.errors ?? []).length})</summary>
            <div className="mt-2 space-y-1">
              {(discovery.errors ?? []).slice(0, 5).map((item: any, index: number) => (
                <p key={`${item.time ?? "error"}-${index}`}>{item.message ?? "Discovery failed."}</p>
              ))}
            </div>
          </details>
        ) : null}
        <SessionSelect
          label="Select Search Session"
          value={connectionId}
          onChange={setConnectionId}
          connections={data?.connections}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            onClick={startDiscovery}
            disabled={!connectionId || selectedKeywords.length === 0 || actionBusy === "start-discovery"}
          >
            {actionBusy === "start-discovery" ? "Starting..." : "START DISCOVERY"}
          </Button>
          <Button
            variant="secondary"
            onClick={pauseDiscovery}
            disabled={actionBusy === "pause-discovery"}
          >
            {actionBusy === "pause-discovery" ? "Pausing..." : "PAUSE DISCOVERY"}
          </Button>
          <Button
            variant="secondary"
            onClick={searchGroups}
            disabled={!connectionId || selectedKeywords.length === 0 || actionBusy === "search-groups"}
          >
            <Search className="mr-2 size-4" /> {actionBusy === "search-groups" ? "Searching..." : "SEARCH NOW"}
          </Button>
        </div>
      </section>
      <GroupRows
        groups={data?.groups ?? []}
        connections={data?.connections ?? []}
        auth={auth}
        actions={actions}
        reload={reload}
        setNotice={setNotice}
        actionBusy={actionBusy}
        runAction={runAction}
      />
    </div>
  );
}

function GroupList({ auth, data, actions, reload, setNotice, actionBusy, runAction, section }: any) {
  const [modal, setModal] = useState<"" | "ADD" | "IMPORT" | "SHARE">("");
  const [username, setUsername] = useState("");
  const [folderLink, setFolderLink] = useState("");
  const approvedGroups = data?.groups ?? [];
  const [folderSelection, setFolderSelection] = useState<string[]>([]);
  const folderConnections = data?.connections ?? [];
  const [folderConnectionId, setFolderConnectionId] = useState("");
  const [expandedLinkId, setExpandedLinkId] = useState("");
  const [folderResult, setFolderResult] = useState<any>(null);
  const [folderError, setFolderError] = useState("");
  const selectedFolderConnection = folderConnections.find((connection: any) => connection.id === folderConnectionId) ?? null;
  const healthyFolderConnections = folderConnections.filter((connection: any) =>
    connection.status === "CONNECTED" &&
    connection.has_session &&
    !["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(String(connection.health ?? "")) &&
    connection.session_error_code !== "AUTH_KEY_UNREGISTERED",
  );
  const folderReconnectRequired = selectedFolderConnection
    ? selectedFolderConnection.status !== "CONNECTED" ||
      !selectedFolderConnection.has_session ||
      ["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(String(selectedFolderConnection.health ?? "")) ||
      selectedFolderConnection.session_error_code === "AUTH_KEY_UNREGISTERED"
    : true;
  const activeFolderLinks = (data?.folderLinks ?? []).filter((link: any) => !link.revoked_at);
  const latestFolderLink = folderResult ?? activeFolderLinks[0] ?? null;
  const folderAccountLabel = (link: any) => {
    const connection = folderConnections.find((item: any) => item.id === link?.connection_id);
    return connection?.username ? `@${connection.username}` : (connection?.account_name ?? connection?.label ?? "Telegram account");
  };
  useEffect(() => {
    if (modal !== "SHARE") return;
    const nextId = healthyFolderConnections.find((connection: any) => connection.id === folderConnectionId)?.id || healthyFolderConnections[0]?.id || "";
    if (nextId !== folderConnectionId) setFolderConnectionId(nextId);
  }, [modal, folderConnectionId, folderConnections.length, data?.connections]);
  const selectFolderLimit = (limit: number) => {
    let members = 0;
    const ids: string[] = [];
    for (const group of approvedGroups) {
      const count = Number(group.member_count ?? 0);
      if (count > 0 && members + count > limit) continue;
      ids.push(group.id);
      members += Math.max(count, 0);
    }
    setFolderSelection(ids);
  };
  const toggleFolderGroup = (id: string) => {
    setFolderSelection((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };
  return (
    <div className="space-y-4">
      {section === "groups-approved" ? (
        <section className={panelClass("space-y-3")}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Total Approved Groups: {data?.groups?.length ?? 0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModal("ADD")}>
              <Plus className="mr-2 size-4" /> ADD GROUP
            </Button>
            <Button onClick={() => setModal("IMPORT")}>
              <Plus className="mr-2 size-4" /> IMPORT GROUPS
            </Button>
            <Button className="border-primary/25 bg-primary/10 text-primary hover:bg-primary/15" variant="secondary" onClick={() => setModal("SHARE")}>
              <FolderOpen className="mr-2 size-4" /> CREATE SHAREABLE FOLDER LINK
            </Button>
          </div>
          {(data?.folderLinks ?? []).length ? (
            <div className="space-y-2">
              {(data.folderLinks ?? []).map((link: any) => (
                <div key={link.id} className="border border-border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{link.title ?? "Telegram Folder Link"}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(link.created_at).toLocaleString()}
                        {link.revoked_at ? ` | Revoked ${new Date(link.revoked_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <span className={link.revoked_at ? "text-muted-foreground" : "text-success"}>
                      {link.revoked_at ? "REVOKED" : "ACTIVE"}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">{link.url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(link.url)}>
                      <Copy className="mr-2 size-4" /> Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (navigator.share) void navigator.share({ title: link.title, url: link.url });
                        else void copyText(link.url);
                      }}
                    >
                      Share
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setExpandedLinkId(expandedLinkId === link.id ? "" : link.id)}>
                      View Included Groups
                    </Button>
                    {!link.revoked_at ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={actionBusy === "revoke-folder-link"}
                        onClick={() =>
                          void runAction("revoke-folder-link", async () => {
                            await actions.revokeApprovedGroupFolderLink({ data: { auth, id: link.id } });
                            setNotice("Telegram folder link revoked.");
                            await reload();
                          })
                        }
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                  {expandedLinkId === link.id ? (
                    <div className="mt-3 max-h-48 space-y-1 overflow-auto border-t border-border pt-3">
                      {(link.included_groups ?? []).map((group: any) => (
                        <p key={group.id} className="text-xs text-muted-foreground">
                          {group.title ?? group.username ?? group.id} {group.username ? `@${group.username}` : ""}{" "}
                          {group.member_count ? `| ${group.member_count} members` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <GroupRows
        groups={data?.groups ?? []}
        connections={data?.connections ?? []}
        bulkJoin={data?.bulkJoin}
        auth={auth}
        actions={actions}
        reload={reload}
        setNotice={setNotice}
        actionBusy={actionBusy}
        runAction={runAction}
      />
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 sm:items-center sm:p-4">
          <form
            className={panelClass(`flex w-full ${modal === "SHARE" ? "h-[92dvh] max-w-2xl pb-[calc(var(--miniapp-bottom-nav-height,5rem)+env(safe-area-inset-bottom))] sm:h-[86dvh] sm:pb-0" : "max-w-sm"} flex-col overflow-hidden shadow-lg`)}
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === "ADD") {
                void runAction("add-approved-group", async () => {
                  await actions.addApprovedGroupByUsername({
                    data: { auth, username },
                  });
                  setNotice("Group approved successfully.");
                  setUsername("");
                  setModal("");
                  await reload();
                });
              } else {
                void runAction("import-groups", async () => {
                  const result = await actions.importApprovedGroups({
                    data: { auth, folderLink },
                  });
                  setNotice(
                    `Total Groups: ${result.totalGroups}. Duplicates: ${result.duplicates}. Blocked/Inaccessible: ${result.inaccessible}. Cannot Send Messages: ${result.notWritable}. Already Saved: ${result.alreadySaved}. Successfully Imported: ${result.imported}. Failed: ${result.failed}.`,
                  );
                  setFolderLink("");
                  setModal("");
                  await reload();
                });
              }
            }}
          >
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card pb-3">
              <div className="flex items-center gap-2">
                {modal === "SHARE" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setModal("")}>
                    BACK
                  </Button>
                ) : null}
                <p className="font-semibold">{modal === "ADD" ? "Add Group" : modal === "IMPORT" ? "Import Groups" : "Create Telegram Folder Link"}</p>
              </div>
              <button type="button" onClick={() => setModal("")} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className={`${modal === "SHARE" ? "min-h-0 flex-1 overflow-y-auto py-3 pr-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "space-y-3 py-3"}`}>
            {modal === "ADD" ? (
              <input
                className={inputClass()}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@groupname or https://t.me/groupname"
              />
            ) : modal === "IMPORT" ? (
              <input
                className={inputClass()}
                value={folderLink}
                onChange={(e) => setFolderLink(e.target.value)}
                placeholder="https://t.me/addlist/..."
              />
            ) : (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Telegram Session</span>
                  <select
                    className={inputClass()}
                    value={folderConnectionId}
                    onChange={(event) => {
                      setFolderConnectionId(event.target.value);
                      setFolderSelection([]);
                    }}
                  >
                    <option value="">Using: select connected account</option>
                    {folderConnections.map((connection: any) => {
                      const reconnect = connection.status !== "CONNECTED" ||
                        !connection.has_session ||
                        ["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(String(connection.health ?? "")) ||
                        connection.session_error_code === "AUTH_KEY_UNREGISTERED";
                      const label = connection.username ? `@${connection.username}` : (connection.account_name ?? connection.label ?? "Telegram account");
                      return (
                        <option key={connection.id} value={connection.id} disabled={reconnect}>
                          Using: {label} - {reconnect ? "Reconnect required" : "Connected"}{connection.telegram_premium ? " - Premium" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {!healthyFolderConnections.length ? (
                  <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">Reconnect a Telegram session before creating a shareable folder link.</p>
                ) : null}
                {folderReconnectRequired && selectedFolderConnection ? (
                  <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">Reconnect required</p>
                ) : null}
                {actionBusy === "create-folder-link" ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary" role="status" aria-live="polite">
                    <p className="flex items-center gap-2 font-semibold"><RefreshCw className="size-4 animate-spin" /> Creating Telegram folder link…</p>
                    <p className="mt-1 text-xs">Telegram is exporting the selected chats and the result will be saved here.</p>
                  </div>
                ) : null}
                {folderError ? (
                  <div className="border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 shrink-0" /> Folder link creation failed</p>
                    <p className="mt-1 break-words text-xs">{folderError}</p>
                  </div>
                ) : null}
                {latestFolderLink && !folderError ? (
                  <div className="border border-success/50 bg-success/10 p-3 text-sm" aria-live="polite">
                    <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-4 shrink-0" /> Telegram folder link created</p>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">Telegram folder link:</p>
                    <a className="mt-1 block break-all font-semibold text-primary underline" href={latestFolderLink.url} target="_blank" rel="noreferrer">{latestFolderLink.url}</a>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created {new Date(latestFolderLink.created_at).toLocaleString()} | Session {folderAccountLabel(latestFolderLink)} | {(latestFolderLink.included_groups ?? []).length} groups
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(latestFolderLink.url)}><Copy className="mr-1.5 size-3.5" /> COPY LINK</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => { if (navigator.share) void navigator.share({ title: latestFolderLink.title, url: latestFolderLink.url }); else void copyText(latestFolderLink.url); }}>SHARE</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setExpandedLinkId(expandedLinkId === latestFolderLink.id ? "" : latestFolderLink.id)}>VIEW INCLUDED GROUPS</Button>
                    </div>
                    {expandedLinkId === latestFolderLink.id ? (
                      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-success/30 pt-3">
                        {(latestFolderLink.included_groups ?? []).map((group: any) => <p key={group.id} className="break-words text-xs text-muted-foreground">{group.title ?? group.username ?? group.id}{group.username ? ` | @${group.username}` : ""}</p>)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {activeFolderLinks.length ? (
                  <div className="space-y-2 border border-border bg-background p-3">
                    <p className="font-semibold">Created Links</p>
                    {activeFolderLinks.map((link: any) => (
                      <div key={link.id} className="min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0">
                        <p className="truncate text-xs font-semibold text-primary">{link.url}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(link.created_at).toLocaleString()} | {(link.included_groups ?? []).length} groups</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button type="button" size="sm" variant="secondary" className="h-8 px-2 text-[11px]" onClick={() => void copyText(link.url)}>Copy</Button>
                          <Button type="button" size="sm" variant="secondary" className="h-8 px-2 text-[11px]" onClick={() => { if (navigator.share) void navigator.share({ title: link.title, url: link.url }); else void copyText(link.url); }}>Share</Button>
                          <Button type="button" size="sm" variant="secondary" className="h-8 px-2 text-[11px]" onClick={() => setExpandedLinkId(expandedLinkId === link.id ? "" : link.id)}>View groups</Button>
                          <Button type="button" size="sm" variant="secondary" className="h-8 px-2 text-[11px]" disabled={actionBusy === "revoke-folder-link"} onClick={() => void runAction("revoke-folder-link", async () => { await actions.revokeApprovedGroupFolderLink({ data: { auth, id: link.id } }); setFolderResult(null); setExpandedLinkId(""); setNotice("Telegram folder link revoked."); await reload(); })}>Revoke</Button>
                        </div>
                        {expandedLinkId === link.id ? <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">{(link.included_groups ?? []).map((group: any) => <p key={group.id} className="break-words text-[11px] text-muted-foreground">{group.title ?? group.username ?? group.id}{group.username ? ` | @${group.username}` : ""}</p>)}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[100, 500, 1000].map((limit) => (
                    <Button key={limit} type="button" size="sm" variant="secondary" disabled={folderReconnectRequired || !approvedGroups.length} onClick={() => selectFolderLimit(limit)}>
                      Up to {limit.toLocaleString()}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant="secondary" disabled={folderReconnectRequired || !approvedGroups.length} onClick={() => setFolderSelection(approvedGroups.map((g: any) => g.id))}>
                    Select All
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setFolderSelection([])}>
                    Clear Selection
                  </Button>
                </div>
                <p className="text-sm font-semibold">Selected Groups: {folderSelection.length}</p>
                <div className="space-y-2">
                  {approvedGroups.map((group: any) => {
                    return (
                      <label key={group.id} className={`flex gap-3 border p-3 text-sm transition-colors ${folderSelection.includes(group.id) ? "border-primary/50 bg-primary/10" : "border-border bg-background"}`}>
                        <input
                          type="checkbox"
                          checked={folderSelection.includes(group.id)}
                          onChange={() => toggleFolderGroup(group.id)}
                        />
                        <span className="min-w-0">
                          <span className="block break-words font-semibold">{group.title ?? group.username ?? group.id}</span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {group.username ? `@${group.username}` : "No public username"}
                            {" | "}
                            {group.member_count ? `${group.member_count} members` : "member count unknown"}
                            {" | "}
                            {group.username ? "public" : "private/unknown"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {!approvedGroups.length ? <p className="border border-border bg-background p-3 text-sm text-muted-foreground">No approved groups available.</p> : null}
                </div>
              </div>
            )}
            </div>
            <Button
              className={`${modal === "SHARE" ? "sticky bottom-0 z-10 mt-0 shrink-0 border-t border-border" : "w-full"}`}
              type={modal === "SHARE" ? "button" : "submit"}
              onClick={
                modal === "SHARE"
                  ? () =>
                      void runAction("create-folder-link", async () => {
                        try {
                          setFolderError("");
                          const created = await actions.createApprovedGroupFolderLink({
                            data: { auth, connectionId: folderConnectionId, groupIds: folderSelection },
                          });
                          setFolderResult(created);
                          setNotice("Telegram shareable folder link created.");
                          setFolderSelection([]);
                          await reload();
                        } catch (error) {
                          const message = error instanceof Error ? error.message : "Could not create Telegram folder link.";
                          setFolderError(message);
                          setNotice(message);
                        }
                      })
                  : undefined
              }
              disabled={
                (modal === "ADD"
                  ? !username
                  : modal === "IMPORT"
                    ? !folderLink
                    : !folderSelection.length ||
                      !folderConnectionId ||
                      folderReconnectRequired) ||
                actionBusy === "add-approved-group" ||
                actionBusy === "import-groups" ||
                actionBusy === "create-folder-link"
              }
            >
              {actionBusy === "add-approved-group" || actionBusy === "import-groups" || actionBusy === "create-folder-link"
                ? modal === "SHARE" ? "CREATING TELEGRAM FOLDER LINK…" : "Saving..."
                : modal === "ADD"
                  ? "ADD GROUP"
                  : modal === "IMPORT"
                    ? "IMPORT"
                    : "CREATE SHAREABLE LINK"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function GroupRows({ groups, connections, bulkJoin, auth, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [connectionId, setConnectionId] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<any>(null);
  const [testSelected, setTestSelected] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const needsJoinSession = groups.some((g: any) => ["APPROVED", "JOINED"].includes(g.status));
  const approvedNotJoined = groups.filter((g: any) => g.status === "APPROVED").length;
  const totalBulk = bulkJoin?.group_ids?.length ?? approvedNotJoined;
  const testableGroups = groups.filter(
    (g: any) =>
      ["APPROVED", "JOINED"].includes(g.status) &&
      (g.writable_status === "UNKNOWN" ||
        g.writable_status === "NOT_WRITABLE" ||
        g.writable_status === "INACCESSIBLE" ||
        !g.sendable_status ||
        g.sendable_status === "UNKNOWN" ||
        g.can_send_messages !== true),
  );
  async function startAll() {
    await runAction("join-all", async () => {
      await actions.startBulkJoin({ data: { auth, connectionId } });
      setNotice("Join all started.");
      await reload();
    });
  }
  async function testWritable() {
    await runAction("test-writable-groups", async () => {
      const joinIfRequired = confirm(
        "Some groups may require joining before testing. Continue with Join & Test where required?",
      );
      const result = await actions.testWritableGroups({
        data: { auth, groupIds: testSelected, joinIfRequired },
      });
      setTestResult(result);
      setNotice(
        `Tested: ${result.checked}/${result.total}. Writable: ${result.writable}. Not Writable: ${result.notWritable}. Unknown: ${result.unknown}. Inaccessible: ${result.inaccessible}.`,
      );
      await reload();
    });
  }
  async function testSendable() {
    await runAction("test-sendable-groups", async () => {
      const joinIfRequired = confirm(
        "Some groups may require joining before testing. Continue with Join & Test where required?",
      );
      const result = await actions.testSendableGroups({
        data: { auth, groupIds: testSelected, joinIfRequired },
      });
      setTestResult(result);
      setNotice(
        `Tested: ${result.checked}/${result.total}. Sendable: ${result.sendable}. Not Sendable: ${result.notSendable}. Unknown: ${result.unknown}. Join required: ${result.joinRequired}.`,
      );
      await reload();
    });
  }
  return (
    <div className="space-y-3">
      {needsJoinSession ? (
        <section className={panelClass("space-y-3")}>
          <SessionSelect
            label="Select Join Session"
            value={connectionId}
            onChange={setConnectionId}
            connections={connections}
          />
          {connectionId ? (
            <div className="space-y-3">
              <Button className="w-full" disabled={!approvedNotJoined || actionBusy === "join-all"} onClick={startAll}>
                {actionBusy === "join-all" ? "Starting..." : "JOIN ALL GROUPS"}
              </Button>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <Stat label="Joining" value={`${bulkJoin?.current_index ?? 0} / ${totalBulk}`} />
                <Stat label="Joined" value={bulkJoin?.joined ?? 0} />
                <Stat label="Already Joined" value={bulkJoin?.already_joined ?? 0} />
                <Stat label="Failed" value={bulkJoin?.failed ?? 0} />
                <Stat label="Inaccessible" value={bulkJoin?.inaccessible ?? 0} />
                <Stat label="Cooldown" value={bulkJoin?.cooldown ?? 0} />
                <Stat label="Status" value={bulkJoin?.status ?? "IDLE"} />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="secondary"
                  disabled={actionBusy === "pause-joining"}
                  onClick={() =>
                    runAction("pause-joining", async () => {
                      await actions.pauseBulkJoin({ data: { auth } });
                      setNotice("Join all paused.");
                      await reload();
                    })
                  }
                >
                  {actionBusy === "pause-joining" ? "Pausing..." : "PAUSE JOINING"}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  disabled={actionBusy === "resume-joining"}
                  onClick={() =>
                    runAction("resume-joining", async () => {
                      await actions.resumeBulkJoin({ data: { auth } });
                      setNotice("Join all resumed.");
                      await reload();
                    })
                  }
                >
                  {actionBusy === "resume-joining" ? "Resuming..." : "RESUME"}
                </Button>
              </div>
            </div>
          ) : null}
          {testableGroups.length ? (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Test selected groups with automatic session selection.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setTestSelected(testableGroups.map((g: any) => g.id))}
                  >
                    SELECT ALL
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setTestSelected([])}>
                    CLEAR ALL
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!testSelected.length || actionBusy === "test-writable-groups"}
                onClick={testWritable}
              >
                {actionBusy === "test-writable-groups" ? "Testing..." : "CHECK WRITABLE GROUPS"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                disabled={!testSelected.length || actionBusy === "test-sendable-groups"}
                onClick={testSendable}
              >
                {actionBusy === "test-sendable-groups" ? "Testing..." : "CHECK SENDABLE GROUPS"}
              </Button>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <Stat label="Tested" value={`${testResult?.checked ?? 0}/${testResult?.total ?? testSelected.length}`} />
                <Stat label="Writable" value={testResult?.writable ?? 0} />
                <Stat label="Sendable" value={testResult?.sendable ?? 0} />
                <Stat label="Not Writable" value={testResult?.notWritable ?? 0} />
                <Stat label="Unknown" value={testResult?.unknown ?? 0} />
                <Stat label="Inaccessible" value={testResult?.inaccessible ?? 0} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {groups.map((g: any) => (
        <article key={g.id} className={panelClass()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              {testableGroups.some((row: any) => row.id === g.id) ? (
                <input
                  type="checkbox"
                  checked={testSelected.includes(g.id)}
                  onChange={() =>
                    setTestSelected(
                      testSelected.includes(g.id)
                        ? testSelected.filter((id) => id !== g.id)
                        : [...testSelected, g.id],
                    )
                  }
                  aria-label={`Select ${g.title} for writable testing`}
                />
              ) : (
                <input type="checkbox" readOnly checked={["APPROVED", "JOINED"].includes(g.status)} />
              )}
              <div>
              <p className="font-medium">{g.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.username ? `@${g.username}` : "No username"} | {g.member_count ?? "unknown"}{" "}
                members
              </p>
              {["APPROVED", "JOINED"].includes(g.status) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Writable: {g.writable_status ?? "UNKNOWN"} | Can send:{" "}
                  {g.can_send_messages === true ? "yes" : g.can_send_messages === false ? "no" : "unknown"}
                  {" "} | Sendable: {g.sendable_status ?? "UNKNOWN"}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Matched: {(g.matched_keywords ?? []).join(", ") || "none"} | Found{" "}
                {new Date(g.discovered_at).toLocaleDateString()}
              </p>
              {g.join_error ? <p className="mt-2 text-xs text-warning">{g.join_error}</p> : null}
              </div>
            </div>
            <span className={`text-xs font-semibold ${statusTone(g.status)}`}>{g.status}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {g.username ? (
              <a
                className="border border-border px-3 py-2 text-xs font-semibold text-primary"
                href={`https://t.me/${g.username}`}
              >
                VIEW
              </a>
            ) : null}
            {g.status === "FOUND" ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionBusy === `approve-${g.id}`}
                  onClick={() =>
                    runAction(`approve-${g.id}`, async () => {
                      await actions.approveGroup({ data: { auth, id: g.id, connectionId: null } });
                      setNotice("Group approved successfully.");
                      await reload();
                    })
                  }
                >
                  {actionBusy === `approve-${g.id}` ? "Approving..." : "APPROVE"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionBusy === `reject-${g.id}`}
                  onClick={() =>
                    runAction(`reject-${g.id}`, async () => {
                      await actions.rejectGroup({ data: { auth, id: g.id } });
                      setNotice("Group rejected.");
                      await reload();
                    })
                  }
                >
                  {actionBusy === `reject-${g.id}` ? "Rejecting..." : "REJECT"}
                </Button>
              </>
            ) : null}
            {["APPROVED", "JOINED"].includes(g.status) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!connectionId || actionBusy === `join-${g.id}`}
                onClick={() =>
                  runAction(`join-${g.id}`, async () => {
                    const result = await actions.joinGroup({ data: { auth, id: g.id, connectionId } });
                    setNotice(result.status === "JOINED" ? "Group joined." : `Join result: ${result.status}.`);
                    await reload();
                  })
                }
              >
                {actionBusy === `join-${g.id}` ? "Joining..." : "JOIN"}
              </Button>
            ) : null}
            {["APPROVED", "JOINED"].includes(g.status) ? (
              <Button size="sm" variant="secondary" onClick={() => setConfirmRemove(g)}>
                REMOVE
              </Button>
            ) : null}
          </div>
        </article>
      ))}
      {!groups.length ? <Empty message="No groups in this view." /> : null}
      {confirmRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className={panelClass("w-full max-w-sm space-y-3 shadow-lg")}>
            <p className="font-semibold">Remove approval?</p>
            <p className="text-sm text-muted-foreground">
              Historical campaign and send records will be preserved.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmRemove(null)}>
                CANCEL
              </Button>
              <Button
                className="flex-1"
                disabled={actionBusy === `remove-${confirmRemove.id}`}
                onClick={() =>
                  runAction(`remove-${confirmRemove.id}`, async () => {
                    await actions.removeGroup({ data: { auth, id: confirmRemove.id } });
                    setConfirmRemove(null);
                    setNotice("Group approval removed.");
                    await reload();
                  })
                }
              >
                {actionBusy === `remove-${confirmRemove.id}` ? "Removing..." : "REMOVE"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupCategories({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const groups = data?.groups ?? [];
  const approvedGroups = groups.filter((g: any) => ["APPROVED", "JOINED"].includes(g.status));
  const writableGroups = groups.filter(
    (g: any) => g.can_send_messages === true && g.writable_status === "WRITABLE",
  );
  const sendableGroups = groups.filter((g: any) => g.sendable_status === "SENDABLE");
  const notWritableGroups = approvedGroups.filter((g: any) => g.writable_status === "NOT_WRITABLE");
  const testableGroups = groups.filter(
    (g: any) =>
      ["APPROVED", "JOINED"].includes(g.status) &&
      (g.writable_status === "UNKNOWN" ||
        g.writable_status === "NOT_WRITABLE" ||
        g.writable_status === "INACCESSIBLE" ||
        g.can_send_messages !== true),
  );
  const categories = data?.categories ?? [];
  const [writability, setWritability] = useState<any>(data?.writability ?? {});
  const [verification, setVerification] = useState<any>(null);
  const [testSelected, setTestSelected] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [categorySaveBusy, setCategorySaveBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const categorySaveRun = useRef(0);
  useEffect(() => {
    setWritability(data?.writability ?? {});
  }, [data?.writability]);

  async function verifyGroups() {
    const joinIfRequired = confirm(
      "Some groups may require joining before testing. Continue with Join & Test where required?",
    );
    if (!joinIfRequired) return;
    await runAction("verify-unknown", async () => {
      const response = await actions.verifyWritableGroups({ data: { auth, limit: 60, joinIfRequired } });
      setVerification(response);
      setWritability(response.summary ?? writability);
      setNotice(
        `Verify Unknown: ${response.checked}/${response.total}. Writable: ${response.writable}. Sendable: ${response.sendable}. Unknown: ${response.unknown}.`,
      );
      await reload();
    });
  }

  function typeLabel(value?: string) {
    return value === "NW_NS" || !value ? "NW/NS" : value;
  }

  async function runSelectedCheck(mode: "WRITABLE" | "SENDABLE") {
    const actionKey = mode === "SENDABLE" ? "check-sendable" : "check-writable";
    const joinIfRequired = confirm(
      "Some groups may require joining before testing. Continue with Join & Test where required?",
    );
    if (!joinIfRequired) return;
    await runAction(actionKey, async () => {
      const response =
        mode === "SENDABLE"
          ? await actions.testSendableGroups({ data: { auth, groupIds: testSelected, joinIfRequired } })
          : await actions.testWritableGroups({ data: { auth, groupIds: testSelected, joinIfRequired } });
      setTestResult({ ...response, mode });
      setWritability(response.summary ?? writability);
      setNotice(
        mode === "SENDABLE"
          ? `Tested: ${response.checked}/${response.total}. Sendable: ${response.sendable}. Not Sendable: ${response.notSendable}. Unknown: ${response.unknown}.`
          : `Tested: ${response.checked}/${response.total}. Writable: ${response.writable}. Not Writable: ${response.notWritable}. Unknown: ${response.unknown}.`,
      );
      await reload();
    });
  }

  async function checkOne(groupId: string, mode: "WRITABLE" | "SENDABLE") {
    await runAction(`${mode === "SENDABLE" ? "check-send" : "check-write"}-${groupId}`, async () => {
      let response = await (mode === "SENDABLE" ? actions.testSendableGroups : actions.testWritableGroups)({
        data: { auth, groupIds: [groupId], joinIfRequired: false },
      });
      if ((response.joinRequired ?? 0) > 0 && confirm("Join group to continue test?")) {
        response = await (mode === "SENDABLE" ? actions.testSendableGroups : actions.testWritableGroups)({
          data: { auth, groupIds: [groupId], joinIfRequired: true },
        });
      }
      setTestResult({ ...response, mode });
      setWritability(response.summary ?? writability);
      const error = response.errors?.[0]?.reason;
      setNotice(
        mode === "SENDABLE"
          ? response.sendable
            ? "Group is sendable."
            : `Group send status is ${error ? `unknown: ${error}` : "not sendable or unknown."}`
          : response.writable
            ? "Group is writable."
            : `Group write status is ${error ? `unknown: ${error}` : "not writable or unknown."}`,
      );
    });
  }

  function closeEditor() {
    categorySaveRun.current += 1;
    setEditing(null);
    setName("");
    setSelected([]);
    setCategorySaveBusy(false);
    setCategoryError("");
  }

  function openEditor(category?: any, categoryType: "NW_NS" | "WRITABLE" | "SENDABLE" = "NW_NS") {
    categorySaveRun.current += 1;
    const openRun = categorySaveRun.current;
    setDetail(null);
    setCategorySaveBusy(false);
    setCategoryError("");
    setEditing(category ?? { id: null, category_type: categoryType, modal_key: `${categoryType}-${Date.now()}` });
    setName(category?.name ?? "");
    setSelected(category?.groups?.map((g: any) => g.id) ?? []);
    if (category?.id) {
      void runAction(`open-category-${category.id}`, async () => {
        const response = await actions.getGroupCategoryDetail({ data: { auth, id: category.id } });
        if (categorySaveRun.current !== openRun) return;
        setSelected((response.groups ?? []).map((g: any) => g.id));
        setDetail(response);
      });
    }
  }

  async function openCheckedEditor(categoryType: "WRITABLE" | "SENDABLE") {
    const ids = approvedGroups.map((group: any) => group.id);
    if (!ids.length) {
      setNotice("Approve groups before creating a checked category.");
      return;
    }
    const joinIfRequired = confirm(
      "Some groups may require joining before testing. Continue with Join & Test where required?",
    );
    if (!joinIfRequired) return;
    await runAction(categoryType === "SENDABLE" ? "create-category-sendable" : "create-category-writable", async () => {
      const response =
        categoryType === "SENDABLE"
          ? await actions.testSendableGroups({ data: { auth, groupIds: ids, joinIfRequired } })
          : await actions.testWritableGroups({ data: { auth, groupIds: ids, joinIfRequired } });
      setTestResult({ ...response, mode: categoryType });
      setWritability(response.summary ?? writability);
      const passed = (response.groups ?? [])
        .filter((group: any) =>
          categoryType === "SENDABLE"
            ? group.sendable_status === "SENDABLE"
            : group.writable_status === "WRITABLE" && group.can_send_messages === true,
        )
        .map((group: any) => String(group.id));
      categorySaveRun.current += 1;
      setDetail(null);
      setCategorySaveBusy(false);
      setCategoryError("");
      setEditing({ id: null, category_type: categoryType, modal_key: `${categoryType}-${Date.now()}` });
      setName("");
      setSelected(passed);
      setNotice(
        `${categoryType === "SENDABLE" ? "Sendable" : "Writable"} check complete. ${passed.length} group(s) are ready for category save.`,
      );
      void reload();
    });
  }

  async function saveCategory() {
    if (!editing) return;
    const runId = categorySaveRun.current + 1;
    categorySaveRun.current = runId;
    setCategorySaveBusy(true);
    setCategoryError("");
    try {
      await actions.saveGroupCategory({
        data: {
          auth,
          id: editing.id,
          name,
          group_ids: selected,
          category_type: editorType,
        },
      });
      if (categorySaveRun.current !== runId) return;
      setNotice(editing.id ? "Category updated successfully." : "Category created successfully.");
      closeEditor();
      void reload();
    } catch (error) {
      if (categorySaveRun.current !== runId) return;
      setCategoryError(error instanceof Error ? error.message : "Category save failed.");
    } finally {
      if (categorySaveRun.current === runId) setCategorySaveBusy(false);
    }
  }

  const editorType = (editing?.category_type ?? "NW_NS") as "NW_NS" | "WRITABLE" | "SENDABLE";
  const editorGroups = editing?.id
    ? approvedGroups
    : editorType === "SENDABLE"
      ? sendableGroups
      : editorType === "WRITABLE"
        ? writableGroups
        : approvedGroups;

  return (
    <div className="space-y-4">
      <section className={panelClass("space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="min-h-10 flex-1 rounded-md text-xs font-semibold sm:flex-none" onClick={() => openEditor()}>
            <Plus className="mr-2 size-4" /> CREATE CATEGORY
          </Button>
          <Button
            className="min-h-10 flex-1 rounded-md text-xs font-semibold sm:flex-none"
            disabled={actionBusy === "create-category-writable"}
            onClick={() => void openCheckedEditor("WRITABLE")}
          >
            <Plus className="mr-2 size-4" />
            {actionBusy === "create-category-writable" ? "CHECKING..." : "CREATE CATEGORY WITH WRITABLE CHECK"}
          </Button>
          <Button
            className="min-h-10 flex-1 rounded-md text-xs font-semibold sm:flex-none"
            disabled={actionBusy === "create-category-sendable"}
            onClick={() => void openCheckedEditor("SENDABLE")}
          >
            <Plus className="mr-2 size-4" />
            {actionBusy === "create-category-sendable" ? "CHECKING..." : "CREATE CATEGORY WITH SENDABLE CHECK"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-10 rounded-md text-xs font-semibold"
            disabled={actionBusy === "verify-unknown"}
            onClick={() => void verifyGroups()}
          >
            {actionBusy === "verify-unknown" ? "Verifying..." : "VERIFY UNKNOWN GROUPS"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Verify Unknown" value={verification ? `${verification.checked}/${verification.total}` : (writability.unknown ?? 0)} />
          <Stat label="Writable" value={writability.writable ?? writableGroups.length} />
          <Stat label="Sendable" value={writability.sendable ?? sendableGroups.length} />
          <Stat label="Not Writable" value={writability.notWritable ?? 0} />
          <Stat label="Unknown" value={writability.unknown ?? 0} />
        </div>
        {testableGroups.length ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Testable Groups: {testableGroups.length} | Selected: {testSelected.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setTestSelected(testableGroups.map((g: any) => g.id))}
                >
                  SELECT ALL
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setTestSelected([])}>
                  CLEAR ALL
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              disabled={!testSelected.length || actionBusy === "check-writable"}
              onClick={() => runSelectedCheck("WRITABLE")}
            >
              {actionBusy === "check-writable" ? "Testing..." : "CHECK WRITABLE GROUPS"}
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              disabled={!testSelected.length || actionBusy === "check-sendable"}
              onClick={() => runSelectedCheck("SENDABLE")}
            >
              {actionBusy === "check-sendable" ? "Testing..." : "CHECK SENDABLE GROUPS"}
            </Button>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Stat
                label={
                  testResult?.mode === "SENDABLE"
                    ? "Sendable Check"
                    : testResult?.mode === "WRITABLE"
                      ? "Writable Check"
                      : "Selected"
                }
                value={testResult ? `${testResult.checked}/${testResult.total}` : testSelected.length}
              />
              <Stat label="Writable" value={testResult?.writable ?? 0} />
              <Stat label="Sendable" value={testResult?.sendable ?? 0} />
              <Stat label="Not Writable" value={testResult?.notWritable ?? 0} />
              <Stat label="Unknown" value={testResult?.unknown ?? 0} />
              <Stat label="Inaccessible" value={testResult?.inaccessible ?? 0} />
            </div>
          </div>
        ) : null}
        {notWritableGroups.length ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-semibold">NOT WRITABLE GROUPS</p>
            <div className="max-h-64 space-y-2 overflow-auto">
              {notWritableGroups.map((group: any) => (
                <div
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-border bg-background p-3 text-sm"
                >
                  <span>
                    {group.title} {group.username ? `@${group.username}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionBusy === `check-write-${group.id}`}
                    onClick={() => void checkOne(group.id, "WRITABLE")}
                  >
                    {actionBusy === `check-write-${group.id}` ? "Checking..." : "CHECK WRITE"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionBusy === `check-send-${group.id}`}
                    onClick={() => void checkOne(group.id, "SENDABLE")}
                  >
                    {actionBusy === `check-send-${group.id}` ? "Checking..." : "CHECK SEND"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <div className="space-y-3">
        {categories.map((category: any) => (
          <article key={category.id} className={panelClass()}>
            <p className="font-semibold">{category.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {category.group_count ?? 0} groups ({typeLabel(category.category_type)})
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  runAction(`open-${category.id}`, async () => {
                    const response = await actions.getGroupCategoryDetail({
                      data: { auth, id: category.id },
                    });
                    setDetail(response);
                  })
                }
              >
                <Eye className="mr-1 size-3" /> OPEN
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEditor(category)}>
                EDIT
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={actionBusy === `delete-category-${category.id}`}
                onClick={() => {
                  if (!confirm("Delete this category? Groups will not be deleted.")) return;
                  void runAction(`delete-category-${category.id}`, async () => {
                    await actions.deleteGroupCategory({ data: { auth, id: category.id } });
                    setNotice("Category deleted.");
                    await reload();
                  });
                }}
              >
                DELETE
              </Button>
            </div>
          </article>
        ))}
        {!categories.length ? <Empty message="No group categories yet." /> : null}
      </div>
      {detail ? (
        <section className={panelClass("space-y-3")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{detail.category.name}</p>
              <p className="text-sm text-muted-foreground">
                Total Groups: {detail.groups.length} | {detail.usable_count ?? 0} usable |{" "}
                {detail.unavailable_count ?? 0} unavailable
              </p>
            </div>
            <button type="button" onClick={() => setDetail(null)} aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2">
            {detail.groups.map((g: any) => (
              <p key={g.id} className="border border-border bg-background p-2 text-sm">
                {g.title} {g.username ? `@${g.username}` : ""}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openEditor(detail.category)}>
              EDIT GROUPS
            </Button>
            <Button variant="secondary" onClick={() => openEditor(detail.category)}>
              RENAME
            </Button>
          </div>
        </section>
      ) : null}
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <form
            className={panelClass("max-h-[88vh] w-full max-w-lg space-y-3 overflow-auto shadow-lg")}
            onSubmit={(e) => {
              e.preventDefault();
              void saveCategory();
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">
                {editing.id ? "Edit Category" : editorType === "SENDABLE" ? "Create Category With Sendable Check" : editorType === "WRITABLE" ? "Create Category With Writable Check" : "Create Category"}
              </p>
              <button type="button" onClick={closeEditor} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {categoryError ? <p className="text-sm text-destructive">{categoryError}</p> : null}
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Category Name</span>
              <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {editing.id ? `Saved Groups: ${selected.length}` : editorType === "SENDABLE" ? `Sendable Groups: ${sendableGroups.length}` : editorType === "WRITABLE" ? `Writable Groups: ${writableGroups.length}` : `Approved Groups: ${approvedGroups.length}`}{" "}
                | Selected Groups: {selected.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected(editorGroups.map((g: any) => g.id))}
                >
                  SELECT ALL
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setSelected([])}>
                  CLEAR ALL
                </Button>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto">
              {editorGroups.map((g: any) => (
                <label key={g.id} className="flex items-center gap-3 border border-border bg-background p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(g.id)}
                    onChange={() =>
                      setSelected(
                        selected.includes(g.id)
                          ? selected.filter((id) => id !== g.id)
                          : [...selected, g.id],
                      )
                    }
                  />
                  <span>{g.title}</span>
                </label>
              ))}
              {!editorGroups.length ? (
                <p className="text-sm text-muted-foreground">
                  {editorType === "SENDABLE"
                    ? "No confirmed sendable groups available. Run CHECK SENDABLE GROUPS first."
                    : editorType === "WRITABLE"
                      ? "No confirmed writable groups available. Run CHECK WRITABLE GROUPS first."
                      : "No approved groups available."}
                </p>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={!name || categorySaveBusy}>
              {categorySaveBusy ? "Saving..." : editing.id ? "SAVE" : "CREATE CATEGORY"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function presenceLabel(value?: string | null) {
  if (value === "ONLINE") return "Online";
  if (value === "RECENTLY") return "Recently";
  if (value === "WITHIN_WEEK") return "Within Week";
  if (value === "WITHIN_MONTH") return "Within Month";
  if (value === "LONG_AGO") return "Long Ago";
  return "Unknown";
}

function sourceGroupLabel(row: any) {
  const group = Array.isArray(row.discovered_groups) ? row.discovered_groups[0] : row.discovered_groups;
  if (!group) return "Unknown source";
  return group.username ? `@${group.username}` : (group.title ?? "Source group");
}

function DMAudience({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [filter, setFilter] = useState("ALL_ELIGIBLE");
  const [excludeInactive, setExcludeInactive] = useState(true);
  const [audienceTab, setAudienceTab] = useState<"GROUPS" | "USERS">("USERS");
  const [audiencePage, setAudiencePage] = useState<any>(data?.discovery?.audience ?? { users: [] });
  const discovery = data?.discovery ?? {};
  const state = discovery.state ?? {};
  const audience = audiencePage ?? { users: [] };
  const issues = discovery.issues ?? [];
  const processed = state.processed_group_ids?.length ?? 0;
  const selectedCount = selectedGroups.length || state.group_ids?.length || 0;
  useEffect(() => {
    setAudiencePage(data?.discovery?.audience ?? { users: [] });
  }, [data?.discovery?.audience]);
  async function loadAudience(nextPage = 1, append = false, nextFilter = filter, nextExclude = excludeInactive) {
    await runAction(append ? "load-more-audience" : "filter-audience", async () => {
      const response = await actions.findAudience({
        data: {
          auth,
          groupIds: [],
          onlyNew: true,
          filter: nextFilter,
          excludeInactive: nextExclude,
          page: nextPage,
          pageSize: 100,
        },
      });
      setAudiencePage((current: any) =>
        append ? { ...response, users: [...(current?.users ?? []), ...(response.users ?? [])] } : response,
      );
    });
  }
  async function changeFilter(nextFilter: string) {
    setFilter(nextFilter);
    await loadAudience(1, false, nextFilter, excludeInactive);
  }
  async function changeExcludeInactive(nextValue: boolean) {
    setExcludeInactive(nextValue);
    await loadAudience(1, false, filter, nextValue);
  }
  async function start() {
    await runAction("start-finding", async () => {
      await actions.startAudienceDiscovery({ data: { auth, groupIds: selectedGroups } });
      setNotice("Find Users started.");
      await reload();
    });
  }
  async function pause() {
    await runAction("pause-finding", async () => {
      await actions.pauseAudienceDiscovery({ data: { auth } });
      setNotice("Find Users paused.");
      await reload();
    });
  }
  return (
    <div className="space-y-4">
      <section className={panelClass()}>
        <p className="text-lg font-semibold">Find Users</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Select approved source groups and save legitimately discoverable/contactable users to your
          audience database.
        </p>
      </section>
      <section className={panelClass("flex gap-2")}>
        <Button className="flex-1" disabled={!selectedGroups.length || actionBusy === "start-finding"} onClick={start}>
          {actionBusy === "start-finding" ? "Starting..." : "START FINDING"}
        </Button>
        <Button className="flex-1" variant="secondary" disabled={actionBusy === "pause-finding"} onClick={pause}>
          {actionBusy === "pause-finding" ? "Pausing..." : "PAUSE FINDING"}
        </Button>
      </section>
      <section className={panelClass("space-y-3")}>
        <div className="flex flex-wrap gap-2">
          {[
            ["ALL_ELIGIBLE", "ALL ELIGIBLE"],
            ["ACTIVE_POSTERS", "ACTIVE POSTERS"],
            ["ACTIVE_30_DAYS", "ACTIVE < 30 DAYS"],
            ["RECENTLY_ONLINE", "RECENTLY ONLINE"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "default" : "secondary"}
              disabled={actionBusy === "filter-audience"}
              onClick={() => void changeFilter(String(value))}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeInactive}
            onChange={(e) => void changeExcludeInactive(e.target.checked)}
          />
          Exclude inactive &gt;30 days
        </label>
      </section>
      <section className={panelClass("space-y-3")}>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Status" value={state.status ?? "IDLE"} />
          <Stat label="Selected Groups" value={selectedCount} />
          <Stat label="Processed" value={processed} />
          <Stat label="Remaining" value={Math.max(selectedCount - processed, 0)} />
          <Stat label="Users Found" value={audience.totalFound ?? 0} />
          <Stat label="New Users" value={state.new_users ?? 0} />
          <Stat label="With Username" value={audience.withUsername ?? 0} />
          <Stat label="Excluded Inactive" value={audience.excludedInactive ?? 0} />
          <Stat label="Active Posters" value={audience.activePosters ?? 0} />
          <Stat label="Previously Saved" value={state.previously_saved ?? 0} />
          <Stat label="Next Search" value={state.next_search_at ? new Date(state.next_search_at).toLocaleString() : "not scheduled"} />
          <Stat label="Errors" value={(state.errors ?? []).length} />
        </div>
        {state.status === "RUNNING" ? (
          <p className="text-xs text-success">Running in the background. You can close the app and return later.</p>
        ) : null}
        {state.last_error ? <p className="text-sm text-warning">{state.last_error}</p> : null}
        {(state.errors ?? []).length ? (
          <details className="text-xs text-muted-foreground">
            <summary>Recent Worker Errors ({(state.errors ?? []).length})</summary>
            <div className="mt-2 space-y-1">
              {(state.errors ?? []).slice(0, 5).map((item: any, index: number) => (
                <p key={`${item.time ?? "error"}-${index}`}>{item.message ?? "Discovery failed."}</p>
              ))}
            </div>
          </details>
        ) : null}
      </section>
      <details className={panelClass("space-y-3")}>
        <summary className="cursor-pointer font-semibold">DISCOVERY ISSUES ({issues.length})</summary>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {issues.map((row: any) => {
            const group = Array.isArray(row.discovered_groups) ? row.discovered_groups[0] : row.discovered_groups;
            return (
            <div key={row.id} className="border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{group?.title ?? "Source group"}</p>
                <span className={statusTone(row.status)}>
                  {row.status === "FOUND" ? `FOUND: ${row.users_found}` : row.status}
                </span>
              </div>
              {row.reason ? <p className="mt-2 text-xs text-warning">{row.reason}</p> : null}
            </div>
          )})}
          {!issues.length ? <p className="text-sm text-muted-foreground">No discovery issues yet.</p> : null}
        </div>
      </details>
      <section className={panelClass("space-y-3")}>
        <div className="grid grid-cols-2 gap-2">
          {(["GROUPS", "USERS"] as const).map((tab) => (
            <Button key={tab} variant={audienceTab === tab ? "default" : "secondary"} onClick={() => setAudienceTab(tab)}>
              {tab}
            </Button>
          ))}
        </div>
        {audienceTab === "GROUPS" ? (
          <div className="max-h-[52vh] overflow-auto">
          <GroupPicker
            groups={data?.groups ?? []}
            selected={selectedGroups}
            setSelected={setSelectedGroups}
            allowAll
          />
          </div>
        ) : (
          <div className="max-h-[52vh] space-y-2 overflow-auto">
            {(audience.users ?? []).map((user: any, index: number) => (
              <p key={user.id} className="border border-border bg-background p-2 text-sm">
                {index + 1}. {user.username ? `@${user.username}` : (user.display_name ?? user.telegram_user_id)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Source: {sourceGroupLabel(user)}
                  {" | "}
                  Presence: {presenceLabel(user.presence_status)}{" "}
                  {user.last_seen_at ? `| Last seen ${new Date(user.last_seen_at).toLocaleDateString()}` : ""}
                  {user.recent_activity_at ? `| Recent group activity ${new Date(user.recent_activity_at).toLocaleDateString()}` : ""}
                  {` | Messages observed ${user.messages_observed ?? 0}`}
                </span>
              </p>
            ))}
            {!audience.users?.length ? <p className="text-sm text-muted-foreground">No saved users yet.</p> : null}
          </div>
        )}
          {audience.hasMore ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={actionBusy === "load-more-audience"}
              onClick={() => void loadAudience((audience.page ?? 1) + 1, true)}
            >
              {actionBusy === "load-more-audience" ? "Loading..." : "LOAD MORE"}
            </Button>
          ) : null}
      </section>
    </div>
  );
}

function AddUsersPage({ auth, data, actions, reload, setNotice, actionBusy, runAction, appLanguage }: any) {
  const [audience, setAudience] = useState<any>(data?.audience ?? { users: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const [usernameFilter, setUsernameFilter] = useState<"ALL" | "WITH_USERNAME" | "WITHOUT_USERNAME">("ALL");
  const [activityFilter, setActivityFilter] = useState<"ALL" | "ACTIVE_RECENTLY" | "AROUND_MONTH" | "LONG_TIME_AGO">("ALL");
  const [connectionId, setConnectionId] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationCheck, setDestinationCheck] = useState<any>(null);
  const [addUsers, setAddUsers] = useState<any>(data?.addUsers ?? { jobs: [], results: [] });
  const [resultTab, setResultTab] = useState<"ALL" | "PENDING" | "PROCESSING" | "SUCCESSFUL" | "FAILED">("ALL");
  const connections = data?.connections ?? [];
  const selectedConnection = connections.find((connection: any) => connection.id === connectionId);
  const healthySession = selectedConnection &&
    selectedConnection.status === "CONNECTED" &&
    selectedConnection.has_session &&
    !["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(String(selectedConnection.health ?? "")) &&
    selectedConnection.session_error_code !== "AUTH_KEY_UNREGISTERED";
  const currentJob = addUsers?.job;
  const results = addUsers?.results ?? [];
  const credits = addUsers?.credits ?? data?.billing?.addons?.addUsersCredits?.balance ?? {};
  const t = (text: string) => miniT(appLanguage ?? "en", text);
  const filteredResults = resultTab === "ALL" ? results : results.filter((row: any) => row.status === resultTab);
  useEffect(() => {
    setAudience(data?.audience ?? { users: [] });
    setAddUsers(data?.addUsers ?? { jobs: [], results: [] });
  }, [data?.audience, data?.addUsers]);

  async function loadFilteredAudience(nextUsername = usernameFilter, nextActivity = activityFilter) {
    await runAction("filter-add-users", async () => {
      const response = await actions.findAudience({
        data: {
          auth,
          groupIds: [],
          onlyNew: true,
          usernameFilter: nextUsername,
          activityFilter: nextActivity,
          excludeInactive: nextActivity === "ALL",
        },
      });
      setAudience(response);
      setSelected([]);
    });
  }

  async function selectAllMatching() {
    await runAction("select-add-users", async () => {
      const response = await actions.selectAudienceIds({
        data: {
          auth,
          groupIds: [],
          onlyNew: true,
          usernameFilter,
          activityFilter,
          excludeInactive: activityFilter === "ALL",
        },
      });
      setSelected(response.ids ?? []);
    });
  }

  async function checkDestination() {
    await runAction("check-add-users-destination", async () => {
      const response = await actions.checkAddUsersDestination({ data: { auth, connectionId, destination } });
      setDestinationCheck(response);
    });
  }

  async function startJob() {
    await runAction("start-add-users", async () => {
      const response = await actions.startAddUsersJob({
        data: { auth, connectionId, destination, contactIds: selected },
      });
      setAddUsers(response);
      setNotice(t("Add Users job started."));
      await reload();
    });
  }

  async function controlJob(action: "PAUSE" | "RESUME" | "CANCEL") {
    if (!currentJob?.id) return;
    await runAction(`add-users-${action.toLowerCase()}`, async () => {
      const response = await actions.controlAddUsersJob({ data: { auth, id: currentJob.id, action } });
      setAddUsers(response);
      setNotice(`Add Users job ${action.toLowerCase()}.`);
      await reload();
    });
  }

  async function openJob(id: string) {
    await runAction("open-add-users-job", async () => {
      const response = await actions.getAddUsersState({ data: { auth, jobId: id } });
      setAddUsers(response);
    });
  }

  const toggleUser = (id: string) =>
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const actionLabel = destinationCheck?.destinationType === "CHANNEL" ? "ADD USERS TO CHANNEL" : "ADD USERS TO GROUP";
  const canStart = healthySession && selected.length > 0 && destinationCheck?.ok === true && !["RUNNING", "COOLDOWN"].includes(String(currentJob?.status ?? ""));
  return (
    <div className="min-w-0 space-y-3 overflow-x-clip pb-[calc(var(--miniapp-bottom-nav-height,5rem)+env(safe-area-inset-bottom)+1rem)]">
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("User Filters")}</p>
        <p className="text-xs font-semibold uppercase text-muted-foreground">{t("Username")}</p>
        <div className="grid grid-cols-1 gap-1 rounded-md border border-border bg-muted/40 p-1 min-[360px]:grid-cols-3">
          {[
            ["ALL", "All"],
            ["WITH_USERNAME", "With Username"],
            ["WITHOUT_USERNAME", "Without Username"],
          ].map(([value, label]) => (
            <button key={value} type="button" className={`min-h-9 min-w-0 whitespace-normal break-words rounded-lg px-1.5 text-[11px] font-semibold sm:px-2 sm:text-xs ${usernameFilter === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => { setUsernameFilter(value as any); void loadFilteredAudience(value as any, activityFilter); }}>
              {t(String(label))}
            </button>
          ))}
        </div>
        <p className="pt-1 text-xs font-semibold uppercase text-muted-foreground">{t("Activity")}</p>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1 sm:grid-cols-4">
          {[
            ["ALL", "All"],
            ["ACTIVE_RECENTLY", "Active / Recently"],
            ["AROUND_MONTH", "Around a Month"],
            ["LONG_TIME_AGO", "Long Time Ago"],
          ].map(([value, label]) => (
            <button key={value} type="button" className={`min-h-9 min-w-0 whitespace-normal break-words rounded-lg px-1.5 text-[11px] font-semibold sm:px-2 sm:text-xs ${activityFilter === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => { setActivityFilter(value as any); void loadFilteredAudience(usernameFilter, value as any); }}>
              {t(String(label))}
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold">{t("Matching Users")}: {audience?.totalFound ?? 0}</p>
      </section>

      <section className={panelClass("space-y-3")}>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-muted-foreground">{t("Telegram Session")}</span>
          <select className={inputClass()} value={connectionId} onChange={(event) => { setConnectionId(event.target.value); setDestinationCheck(null); }}>
            <option value="">{t("Select session")}</option>
            {connections.map((connection: any) => {
            const reconnect = connection.status !== "CONNECTED" ||
              !connection.has_session ||
              ["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(String(connection.health ?? "")) ||
              connection.session_error_code === "AUTH_KEY_UNREGISTERED";
            return (
              <option key={connection.id} value={connection.id} disabled={reconnect}>
                {connection.username ? `@${connection.username}` : (connection.account_name ?? connection.label ?? "Telegram account")} - {reconnect ? "Reconnect Required" : "Connected"} - Health {connection.health_score ?? "-"}%{connection.telegram_premium ? " - Premium" : ""}
              </option>
            );
          })}
          </select>
        </label>
        {!healthySession && connectionId ? <p className="text-xs font-semibold text-destructive">{t("Reconnect required")}</p> : null}
      </section>

      <section className={panelClass("space-y-3")}>
        <p className="text-xs font-semibold uppercase text-muted-foreground">{t("Paste Group or Channel Link")}</p>
        <input
          className={inputClass("appearance-none text-foreground caret-cyan-500")}
          name="add-users-destination"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={destination}
          onChange={(event) => { setDestination(event.currentTarget.value); setDestinationCheck(null); }}
          placeholder="@groupname or https://t.me/channel"
        />
        <Button type="button" className="w-full disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground" disabled={!healthySession || !destination.trim() || actionBusy === "check-add-users-destination"} onClick={() => void checkDestination()}>
          {actionBusy === "check-add-users-destination" ? t("Checking...") : t("RESOLVE / CHECK")}
        </Button>
        {!healthySession ? <p className="text-xs text-muted-foreground">{t("Select a connected, healthy Telegram session to resolve this destination.")}</p> : !destination.trim() ? <p className="text-xs text-muted-foreground">{t("Enter a group or channel username/link to continue.")}</p> : null}
        {destinationCheck ? (
          <div className={`border p-3 text-sm ${destinationCheck.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            <p className="font-semibold">{destinationCheck.ok ? (destinationCheck.title ?? destinationCheck.username ?? destination) : destinationCheck.reason}</p>
            {destinationCheck.ok ? (
              <p className="mt-1 text-xs">
                {t("Type")}: {destinationCheck.destinationType === "CHANNEL" ? t("Channel") : t("Group")} | {t("Session access")}: {destinationCheck.destinationType === "CHANNEL" ? t("Admin + Invite permission") : t("Member")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Add Users Credits")}</p>
        <div className="grid grid-cols-1 gap-2 text-xs min-[340px]:grid-cols-3">
          <Stat label={t("Current balance")} value={credits.purchased_balance ?? 0} />
          <Stat label={t("Free trial remaining")} value={credits.free_trial_remaining ?? 5} />
          <Stat label={t("Available")} value={credits.available_capacity ?? 5} />
        </div>
      </section>

      <section className={panelClass("min-w-0 space-y-3")}>
        <div className="flex min-w-0 flex-col gap-2 min-[340px]:grid min-[340px]:grid-cols-3">
          <Button type="button" size="sm" variant="secondary" className="h-auto min-h-9 min-w-0 whitespace-normal break-words px-2 py-2 text-[11px] leading-tight sm:text-xs" onClick={() => void selectAllMatching()}>{t("Select All Matching")}</Button>
          <Button type="button" size="sm" variant="secondary" className="h-auto min-h-9 min-w-0 whitespace-normal break-words px-2 py-2 text-[11px] leading-tight sm:text-xs" onClick={() => setSelected((audience.users ?? []).map((user: any) => user.id))}>{t("Select Visible")}</Button>
          <Button type="button" size="sm" variant="secondary" className="h-auto min-h-9 min-w-0 whitespace-normal break-words px-2 py-2 text-[11px] leading-tight sm:text-xs" onClick={() => setSelected([])}>{t("Clear Selection")}</Button>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 font-semibold">{t("Selected Users")}</p>
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">{selected.length}</span>
        </div>
        <div className="max-h-[44vh] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {(audience.users ?? []).map((user: any) => (
            <label key={user.id} className={`flex min-w-0 gap-3 border p-2.5 text-sm ${selected.includes(user.id) ? "border-primary/50 bg-primary/10" : "border-border bg-background"}`}>
              <input className="shrink-0" type="checkbox" checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} />
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block truncate font-semibold">{user.username ? `@${user.username}` : (user.display_name ?? user.telegram_user_id)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {presenceLabel(user.presence_status)}{user.last_seen_at ? ` | ${new Date(user.last_seen_at).toLocaleDateString()}` : ""}
                </span>
              </span>
            </label>
          ))}
          {!audience.users?.length ? <p className="text-sm text-muted-foreground">{t("No matching users.")}</p> : null}
        </div>
      </section>

      <section className="border border-cyan-400/40 bg-card p-3 shadow-sm">
        <Button type="button" className="w-full" disabled={!canStart || actionBusy === "start-add-users"} onClick={() => void startJob()}>
          {actionBusy === "start-add-users" ? t("Starting...") : t(actionLabel)}
        </Button>
        {currentJob?.last_error === "Add Users credits exhausted" ? (
          <Button type="button" className="mt-2 w-full" variant="secondary" onClick={() => { window.location.href = "/mini-app/billing"; }}>
            {t("TOP UP")}
          </Button>
        ) : null}
      </section>

      {currentJob ? (
        <section className={panelClass("space-y-3")}>
          <div className="grid grid-cols-2 gap-1 text-xs min-[380px]:grid-cols-5">
            <Stat label={t("Selected")} value={currentJob.selected_count ?? selected.length} />
            <Stat label={t("Pending")} value={currentJob.pending_count ?? 0} />
            <Stat label={t("Processing")} value={currentJob.processing_count ?? 0} />
            <Stat label={t("Successful")} value={currentJob.successful_count ?? 0} />
            <Stat label={t("Failed")} value={currentJob.failed_count ?? 0} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{t("Current Add Users Job")}</p>
              <p className="text-xs text-muted-foreground">
                {currentJob.destination_title ?? currentJob.destination_username ?? currentJob.destination_input} | {currentJob.status}
              </p>
              {currentJob.cooldown_until ? <p className="text-xs font-semibold text-warning">Paused until {new Date(currentJob.cooldown_until).toLocaleString()}</p> : null}
              {currentJob.last_error ? <p className="text-xs font-semibold text-destructive">{currentJob.last_error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={currentJob.status !== "RUNNING"} onClick={() => void controlJob("PAUSE")}>{t("Pause")}</Button>
              <Button type="button" size="sm" variant="secondary" disabled={!["PAUSED", "COOLDOWN"].includes(currentJob.status)} onClick={() => void controlJob("RESUME")}>{t("Resume")}</Button>
              <Button type="button" size="sm" variant="secondary" disabled={["COMPLETED", "CANCELLED"].includes(currentJob.status)} onClick={() => void controlJob("CANCEL")}>{t("Cancel")}</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1 min-[380px]:grid-cols-5">
            {(["ALL", "PENDING", "PROCESSING", "SUCCESSFUL", "FAILED"] as const).map((tab) => (
              <button key={tab} type="button" className={`min-h-8 rounded-lg px-1 text-[11px] font-semibold ${resultTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setResultTab(tab)}>
                {t(tab)}
              </button>
            ))}
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            {filteredResults.map((row: any) => (
              <div key={row.id} className="border border-border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{row.username ? `@${row.username}` : (row.display_name ?? row.telegram_user_id)}</p>
                  <span className={row.status === "SUCCESSFUL" ? "text-success" : row.status === "FAILED" ? "text-destructive" : "text-warning"}>{row.status}</span>
                </div>
                {row.reason ? <p className="mt-1 text-xs text-destructive">{row.reason}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Recent Add Users Jobs")}</p>
        <div className="space-y-2">
          {(addUsers?.jobs ?? []).map((job: any) => (
            <button key={job.id} type="button" className="w-full border border-border bg-background p-3 text-left text-sm" onClick={() => void openJob(job.id)}>
              <span className="font-semibold">{job.destination_title ?? job.destination_username ?? job.destination_input}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {job.destination_type} | Selected {job.selected_count} | Successful {job.successful_count} | Failed {job.failed_count} | Pending {job.pending_count} | {job.status} | Created {new Date(job.created_at).toLocaleString()}
              </span>
            </button>
          ))}
          {!addUsers?.jobs?.length ? <p className="text-sm text-muted-foreground">{t("No Add Users jobs yet.")}</p> : null}
        </div>
      </section>
    </div>
  );
}

function CampaignsPage({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [filter, setFilter] = useState("ALL");
  const rows = data?.campaigns ?? [];
  const filtered = rows.filter((c: any) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ["RUNNING", "SCHEDULED"].includes(c.status);
    if (filter === "GROUP" || filter === "DM") return c.type === filter;
    return c.status === filter;
  });
  return (
    <div className="space-y-4">
      <section className="relative space-y-3 overflow-hidden rounded-xl border border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_13%,var(--card)),color-mix(in_oklch,var(--chart-5)_9%,var(--card)))] p-3 shadow-[0_12px_32px_-26px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
        <span className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-chart-5/10 blur-3xl" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Create a campaign</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">Who do you want to promote to?</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CampaignChoice href="/mini-app/dm-create" label="Direct Users" body="Create a private DM Promotion campaign." visual="direct" />
          <CampaignChoice href="/mini-app/group-create" label="Groups" body="Create a Group Promotion campaign." visual="groups" />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2.5 text-xs">
          <a className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card/75 px-3 py-1.5 font-medium shadow-sm hover:border-primary/30 hover:bg-card" href="/mini-app/dm-history"><Clock className="size-3.5 text-primary" /> DM History</a>
          <a className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card/75 px-3 py-1.5 font-medium shadow-sm hover:border-primary/30 hover:bg-card" href="/mini-app/group-history"><Clock className="size-3.5 text-primary" /> Group History</a>
        </div>
      </section>
      <div>
        <h2 className="text-sm font-semibold">Campaign management</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Monitor and control existing DM and group campaigns.</p>
      </div>
      <section className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/35 p-1.5">
        {["ALL", "GROUP", "DM", "ACTIVE", "PAUSED", "COMPLETED"].map((f) => (
          <Button key={f} size="sm" className="min-h-8 h-8 rounded-full px-2.5 text-[11px] shadow-none" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </section>
      <CampaignCards
        rows={filtered}
        auth={auth}
        actions={actions}
        reload={reload}
        setNotice={setNotice}
        actionBusy={actionBusy}
        runAction={runAction}
      />
    </div>
  );
}

function CampaignChoice({ href, label, body, visual }: { href: string; label: string; body: string; visual: ProductIconName }) {
  return (
    <a href={href} className="group relative flex min-h-24 min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-white/60 bg-card/80 p-3 shadow-[0_8px_24px_-22px_color-mix(in_oklch,var(--primary)_50%,transparent)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-card/75">
      <ProductIcon name={visual} className="size-14 shrink-0 drop-shadow-md transition-transform duration-200 group-hover:scale-105" />
      <span className="min-w-0"><span className="block text-sm font-semibold tracking-tight">{label}</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{body}</span><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Create campaign <ArrowRight className="size-3" /></span></span>
    </a>
  );
}

function DMCampaign({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [createMode, setCreateMode] = useState(false);
  const [audience, setAudience] = useState<any>(data?.audience ?? null);
  const [selected, setSelected] = useState<string[]>([]);
  const [usernameFilter, setUsernameFilter] = useState<"ALL" | "WITH_USERNAME" | "WITHOUT_USERNAME">("ALL");
  const [activityFilter, setActivityFilter] = useState<"ALL" | "ACTIVE_RECENTLY" | "AROUND_MONTH" | "LONG_TIME_AGO">("ALL");
  const [connectionId, setConnectionId] = useState("");
  const [message, setMessage] = useState("");
  const [messageEntities, setMessageEntities] = useState<any[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [name, setName] = useState("DM Promotion");
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  useEffect(() => {
    setAudience(data?.audience ?? null);
  }, [data?.audience]);
  async function loadFilteredAudience(nextUsername = usernameFilter, nextActivity = activityFilter) {
    await runAction("filter-dm-audience", async () => {
      const response = await actions.findAudience({
        data: {
          auth,
          groupIds: [],
          onlyNew: true,
          usernameFilter: nextUsername,
          activityFilter: nextActivity,
          excludeInactive: nextActivity === "ALL",
        },
      });
      setAudience(response);
      setSelected([]);
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const buttons = buttonText && buttonUrl ? [{ text: buttonText, url: buttonUrl }] : [];
    await runAction("create-dm-campaign", async () => {
      await actions.createCampaign({
        data: {
          auth,
          name,
          type: "DM",
          connection_id: connectionId,
          message: {
            text: message,
            entities: messageEntities,
            media_type: mediaType || null,
            media_url: mediaUrl || null,
            buttons,
          },
          group_ids: [],
          contact_ids: selected,
          audience_filters: {
            usernameFilter,
            activityFilter,
            filter: audience?.filter ?? "ALL_ELIGIBLE",
            onlyNew: true,
            excludeInactive: activityFilter === "ALL",
          },
          start_now: true,
          exclude_previously_contacted: true,
          min_delay_seconds: minDelay,
          max_delay_seconds: maxDelay,
        },
      });
      setNotice("DM campaign queued. Worker will process due jobs.");
      await reload();
      setCreateMode(false);
    });
  }
  if (!createMode) {
    const rows = data?.campaigns ?? [];
    return (
      <div className="space-y-4">
        <CampaignSummary rows={rows} />
        <Button className="w-full" onClick={() => setCreateMode(true)}>
          <Plus className="mr-2 size-4" /> CREATE CAMPAIGN
        </Button>
        <CampaignCards
          rows={rows}
          auth={auth}
          actions={actions}
          reload={reload}
          setNotice={setNotice}
          actionBusy={actionBusy}
          runAction={runAction}
        />
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Button type="button" variant="secondary" onClick={() => setCreateMode(false)}>
        BACK TO DM CAMPAIGNS
      </Button>
      {audience ? (
        <>
          <section className={panelClass("space-y-3")}>
            <p className="font-semibold">Audience Filters</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Username</span>
                <select
                  className={inputClass()}
                  value={usernameFilter}
                  onChange={(e) => {
                    const next = e.target.value as "ALL" | "WITH_USERNAME" | "WITHOUT_USERNAME";
                    setUsernameFilter(next);
                    void loadFilteredAudience(next, activityFilter);
                  }}
                >
                  <option value="ALL">All</option>
                  <option value="WITH_USERNAME">With Username</option>
                  <option value="WITHOUT_USERNAME">Without Username</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Activity</span>
                <select
                  className={inputClass()}
                  value={activityFilter}
                  onChange={(e) => {
                    const next = e.target.value as "ALL" | "ACTIVE_RECENTLY" | "AROUND_MONTH" | "LONG_TIME_AGO";
                    setActivityFilter(next);
                    void loadFilteredAudience(usernameFilter, next);
                  }}
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE_RECENTLY">Active / Recently</option>
                  <option value="AROUND_MONTH">Around a Month</option>
                  <option value="LONG_TIME_AGO">Long Time Ago</option>
                </select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">Matching Users: {audience.totalFound ?? 0}</p>
          </section>
          <AudienceSummary
            result={audience}
            selectable
            selected={selected}
            setSelected={setSelected}
            auth={auth}
            actions={actions}
            actionBusy={actionBusy}
            runAction={runAction}
          />
        </>
      ) : (
        <Empty message="No saved audience yet. Use Find Users before creating a DM campaign." />
      )}
      <SessionSelect
        label="Select Sending Session"
        value={connectionId}
        onChange={setConnectionId}
        connections={data?.connections}
      />
      <MessageForm
        auth={auth}
        actions={actions}
        connectionId={connectionId}
        sendingConnection={(data?.connections ?? []).find((connection: any) => connection.id === connectionId)}
        name={name}
        setName={setName}
        message={message}
        setMessage={setMessage}
        entities={messageEntities}
        setEntities={setMessageEntities}
        premiumEmojiActive={data?.billing?.addons?.premiumEmoji?.active ?? data?.addons?.premiumEmoji?.active}
        mediaType={mediaType}
        setMediaType={setMediaType}
        mediaUrl={mediaUrl}
        setMediaUrl={setMediaUrl}
        buttonText={buttonText}
        setButtonText={setButtonText}
        buttonUrl={buttonUrl}
        setButtonUrl={setButtonUrl}
      />
      <section className={panelClass("grid grid-cols-2 gap-3")}>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Min Delay Between Users</span>
          <input className={inputClass()} type="number" min={1} value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Max Delay Between Users</span>
          <input className={inputClass()} type="number" min={1} value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
        </label>
      </section>
      <Button
        className="w-full"
        type="submit"
        disabled={!connectionId || !selected.length || (!message && !mediaUrl) || minDelay > maxDelay || actionBusy === "create-dm-campaign"}
      >
        {actionBusy === "create-dm-campaign" ? "Queuing..." : "APPROVE AND QUEUE"}
      </Button>
    </form>
  );
}

function GroupCampaign({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [createMode, setCreateMode] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [message, setMessage] = useState("");
  const [messageEntities, setMessageEntities] = useState<any[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [name, setName] = useState("Group Promotion");
  const [scheduledAt, setScheduledAt] = useState("");
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  const [cycleDelay, setCycleDelay] = useState(20);
  async function submitCampaign() {
    const buttons = buttonText && buttonUrl ? [{ text: buttonText, url: buttonUrl }] : [];
    await runAction("create-group-campaign", async () => {
      await actions.createCampaign({
        data: {
          auth,
          name,
          type: "GROUP",
          connection_id: connectionId,
          message: {
            text: message,
            entities: messageEntities,
            media_type: mediaType || null,
            media_url: mediaUrl || null,
            buttons,
          },
          group_ids: [],
          group_category_id: categoryId,
          contact_ids: [],
          scheduled_at: scheduledAt || null,
          start_now: !scheduledAt,
          min_delay_seconds: minDelay,
          max_delay_seconds: maxDelay,
          cycle_delay_minutes: cycleDelay,
        },
      });
      setNotice(
        scheduledAt ? "Group campaign scheduled." : "Group campaign queued.",
      );
      await reload();
      setCreateMode(false);
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await submitCampaign();
  }
  if (!createMode) {
    const rows = data?.campaigns ?? [];
    return (
      <div className="space-y-4">
        <CampaignSummary rows={rows} />
        <Button className="w-full" onClick={() => setCreateMode(true)}>
          <Plus className="mr-2 size-4" /> CREATE CAMPAIGN
        </Button>
        <CampaignCards
          rows={rows}
          auth={auth}
          actions={actions}
          reload={reload}
          setNotice={setNotice}
          actionBusy={actionBusy}
          runAction={runAction}
        />
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Button type="button" variant="secondary" onClick={() => setCreateMode(false)}>
        BACK TO GROUP PROMOTION CAMPAIGNS
      </Button>
      <SessionSelect
        label="Select Sending Session"
        value={connectionId}
        onChange={setConnectionId}
        connections={data?.connections}
      />
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Group Category</span>
        <select className={inputClass()} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select category</option>
          {(data?.categories ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name} - {c.group_count ?? 0} groups ({c.category_type === "NW_NS" || !c.category_type ? "NW/NS" : c.category_type})
            </option>
          ))}
        </select>
      </label>
      <MessageForm
        auth={auth}
        actions={actions}
        connectionId={connectionId}
        sendingConnection={(data?.connections ?? []).find((connection: any) => connection.id === connectionId)}
        name={name}
        setName={setName}
        message={message}
        setMessage={setMessage}
        entities={messageEntities}
        setEntities={setMessageEntities}
        premiumEmojiActive={data?.billing?.addons?.premiumEmoji?.active ?? data?.addons?.premiumEmoji?.active}
        mediaType={mediaType}
        setMediaType={setMediaType}
        mediaUrl={mediaUrl}
        setMediaUrl={setMediaUrl}
        buttonText={buttonText}
        setButtonText={setButtonText}
        buttonUrl={buttonUrl}
        setButtonUrl={setButtonUrl}
      />
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Schedule</span>
        <input
          className={inputClass()}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </label>
      <section className={panelClass("grid grid-cols-2 gap-3")}>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Minimum Delay Seconds</span>
          <input className={inputClass()} type="number" min={1} value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Maximum Delay Seconds</span>
          <input className={inputClass()} type="number" min={1} value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
        </label>
        <label className="col-span-2 space-y-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Delay Between Cycles Minutes</span>
          <input className={inputClass()} type="number" min={1} value={cycleDelay} onChange={(e) => setCycleDelay(Number(e.target.value))} />
        </label>
      </section>
      <Button
        className="w-full"
        type="submit"
        disabled={!connectionId || !categoryId || (!message && !mediaUrl) || minDelay > maxDelay || actionBusy === "create-group-campaign"}
      >
        {actionBusy === "create-group-campaign" ? "Queuing..." : "APPROVE AND QUEUE"}
      </Button>
    </form>
  );
}

function jobStats(row: any) {
  const stats = row?.job_stats ?? {};
  const sent = Number(stats.sent_messages ?? row?.completed_count ?? 0);
  const failed = Number(stats.failed_messages ?? row?.failed_count ?? 0);
  const pending = Number(
    stats.pending_messages ??
      Math.max(Number(row?.total_targets ?? 0) - sent - failed, 0),
  );
  const groupsPerCycle = Number(stats.groups_per_cycle ?? row?.total_targets ?? 0);
  const completedCycles = Number(stats.completed_cycles ?? row?.cycles_completed ?? 0);
  const currentCycleAttempted = Number(stats.current_cycle_attempted ?? Math.max(sent + failed - completedCycles * groupsPerCycle, 0));
  const totalAttempted = Number(stats.total_attempted ?? sent + failed);
  const total = Number(stats.total_messages ?? totalAttempted);
  return { total, sent, pending, failed, groupsPerCycle, completedCycles, currentCycleAttempted, totalAttempted };
}

function CampaignDonut({ stats, compact = false }: { stats: any; compact?: boolean }) {
  const total = Math.max(Number(stats.total ?? 0), 0);
  const sent = Math.max(Number(stats.sent ?? 0), 0);
  const pending = Math.max(Number(stats.pending ?? 0), 0);
  const failed = Math.max(Number(stats.failed ?? 0), 0);
  const safeTotal = Math.max(total, sent + pending + failed);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = [
    { label: "Sent", value: sent, color: "var(--success)" },
    { label: "Pending", value: pending, color: "var(--warning)" },
    { label: "Failed", value: failed, color: "var(--destructive)" },
  ].map((segment) => {
    const length = safeTotal > 0 ? (segment.value / safeTotal) * circumference : 0;
    const row = { ...segment, length, offset };
    offset += length;
    return row;
  });
  const size = compact ? "size-32" : "size-44";
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg className={`${size} shrink-0`} viewBox="0 0 120 120" role="img" aria-label={`Total ${total}, Sent ${sent}, Pending ${pending}, Failed ${failed}`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="18" />
        {segments.map((segment) =>
          segment.length > 0 ? (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 60 60)"
            />
          ) : null,
        )}
        <circle cx="60" cy="60" r="28" fill="var(--card)" />
        <text x="60" y="56" textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase">
          Total
        </text>
        <text x="60" y="74" textAnchor="middle" className="fill-foreground text-lg font-semibold">
          {total}
        </text>
      </svg>
      <div className="grid w-full flex-1 grid-cols-3 gap-2 text-xs sm:grid-cols-1">
        <p className="flex items-center justify-center gap-2 sm:justify-start"><span className="size-2 rounded-full bg-success" /> Sent: {sent}</p>
        <p className="flex items-center justify-center gap-2 sm:justify-start"><span className="size-2 rounded-full bg-warning" /> Pending: {pending}</p>
        <p className="flex items-center justify-center gap-2 sm:justify-start"><span className="size-2 rounded-full bg-destructive" /> Failed: {failed}</p>
      </div>
    </div>
  );
}

function CampaignSummary({ rows }: { rows: any[] }) {
  const total = rows.length;
  const running = rows.filter((r) => r.status === "RUNNING").length;
  const paused = rows.filter((r) => r.status === "PAUSED").length;
  const completed = rows.filter((r) => String(r.status).startsWith("COMPLETED")).length;
  return (
    <section className={panelClass("grid grid-cols-4 gap-2 text-center")}>
      <Stat label="Total" value={total} />
      <Stat label="Running" value={running} />
      <Stat label="Paused" value={paused} />
      <Stat label="Completed" value={completed} />
    </section>
  );
}

function campaignLogTitle(log: any) {
  const details = log.details ?? {};
  if (details.compacted) return log.message;
  const group = details.group_title
    ? `${details.group_title}${details.group_username ? ` (@${details.group_username})` : ""}`
    : details.target
      ? String(details.target)
      : "Target unavailable";
  return `${log.level}: ${group}`;
}

function CampaignLogEntry({ log }: { log: any }) {
  const details = log.details ?? {};
  if (details.compacted) {
    return (
      <p className="border border-border bg-background p-2 text-xs">
        {log.message}
      </p>
    );
  }
  const session =
    details.session_account_name ||
    details.session_label ||
    details.session_username ||
    details.session_telegram_user_id ||
    "Unknown session";
  const reason = details.human_reason || log.message;
  const raw = details.raw_error || details.telegram_code;
  return (
    <article className="space-y-1 border border-border bg-background p-3 text-xs">
      <p className="font-semibold">{campaignLogTitle(log)}</p>
      {details.group_title || details.group_username ? (
        <p>
          Group: {details.group_title ?? "Unknown"} {details.group_username ? `(@${details.group_username})` : ""}
        </p>
      ) : null}
      <p>Session: {String(session)}</p>
      <p>Result: {log.level === "ERROR" ? "Failed" : log.level}</p>
      <p>Reason: {String(reason)}</p>
      {raw ? <p>Telegram Error: {String(raw)}</p> : null}
      {details.classification || details.telegram_scope ? (
        <p>
          Classification: {String(details.classification ?? details.telegram_scope)}
        </p>
      ) : null}
      {details.group_status || details.writable_status || details.sendable_status ? (
        <p>
          State: group {String(details.group_status ?? "unknown")}, writable{" "}
          {String(details.writable_status ?? "unknown")}, sendable {String(details.sendable_status ?? "unknown")}
        </p>
      ) : null}
      {details.test_type ? <p>Test Type: {String(details.test_type)}</p> : null}
      <p>Time: {new Date(log.created_at).toLocaleString()}</p>
    </article>
  );
}

function CampaignCards({ rows, auth, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [detail, setDetail] = useState<any>(null);
  async function control(id: string, action: "START" | "PAUSE" | "RESTART" | "STOP") {
    await runAction?.(`${action}-${id}`, async () => {
      await actions.controlCampaign({ data: { auth, id, action } });
      setNotice?.(action === "PAUSE" ? "Campaign paused." : "Campaign started.");
      await reload?.();
    });
  }
  return (
    <div className="space-y-3">
      {rows.map((c: any) => (
        <article key={c.id} className={panelClass()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.type} | {c.connection_id ? "Session selected" : "No session"} |{" "}
                {new Date(c.created_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Completed Cycles {jobStats(c).completedCycles} | Current Cycle{" "}
                {Number(c.cycles_completed ?? 0) + 1} | Groups per Cycle {jobStats(c).groupsPerCycle} |
                Current Cycle Progress {jobStats(c).currentCycleAttempted} / {jobStats(c).groupsPerCycle} |
                Total Messages Attempted {jobStats(c).totalAttempted} | Sent {jobStats(c).sent} | Pending Current Cycle{" "}
                {jobStats(c).pending} | Failed {jobStats(c).failed} | Last run{" "}
                {c.last_run_at ? new Date(c.last_run_at).toLocaleString() : "never"} | Next run{" "}
                {c.next_run_at ? new Date(c.next_run_at).toLocaleString() : "not scheduled"}
              </p>
            </div>
            <span className={`text-xs font-semibold ${statusTone(c.status)}`}>{c.status}</span>
          </div>
          <div className="mt-4">
            <CampaignDonut stats={jobStats(c)} compact />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!!actionBusy} onClick={() => control(c.id, "START")}>
              <Play className="mr-1 size-3" /> START
            </Button>
            <Button size="sm" variant="secondary" disabled={!!actionBusy} onClick={() => control(c.id, "PAUSE")}>
              <Pause className="mr-1 size-3" /> PAUSE
            </Button>
            <Button size="sm" variant="secondary" disabled={!!actionBusy} onClick={() => control(c.id, "RESTART")}>
              <RotateCcw className="mr-1 size-3" /> RESTART
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                runAction?.(`details-${c.id}`, async () => {
                  const response = await actions.getCampaignDetail({ data: { auth, id: c.id } });
                  setDetail(response);
                })
              }
            >
              DETAILS
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!actionBusy}
              onClick={() => {
                if (!confirm("Delete this campaign? Historical send/audit data is preserved.")) return;
                void runAction?.(`delete-campaign-${c.id}`, async () => {
                  await actions.deleteCampaign({ data: { auth, id: c.id } });
                  setNotice?.("Campaign deleted.");
                  await reload?.();
                });
              }}
            >
              <Trash2 className="mr-1 size-3" /> DELETE
            </Button>
          </div>
        </article>
      ))}
      {!rows.length ? <Empty message="No campaigns yet." /> : null}
      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <section className={panelClass("max-h-[88vh] w-full max-w-lg space-y-3 overflow-auto shadow-lg")}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{detail.campaign.name}</p>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Status" value={detail.campaign.status} />
              <Stat label="Selected Users" value={detail.recipients?.length ?? 0} />
              <Stat label="Groups" value={detail.groups?.length ?? 0} />
              <Stat label="Completed Cycles" value={jobStats(detail.campaign).completedCycles} />
              <Stat label="Current Cycle" value={Number(detail.campaign.cycles_completed ?? 0) + 1} />
              <Stat label="Groups per Cycle" value={jobStats(detail.campaign).groupsPerCycle} />
              <Stat label="Current Cycle Progress" value={`${jobStats(detail.campaign).currentCycleAttempted} / ${jobStats(detail.campaign).groupsPerCycle}`} />
              <Stat label="Total Messages Attempted" value={jobStats(detail.campaign).totalAttempted} />
              <Stat label="Sent" value={jobStats(detail.campaign).sent} />
              <Stat label="Pending Current Cycle" value={jobStats(detail.campaign).pending} />
              <Stat label="Failed" value={jobStats(detail.campaign).failed} />
              <Stat
                label="Next Cycle"
                value={
                  detail.campaign.next_run_at
                    ? new Date(detail.campaign.next_run_at).toLocaleString()
                    : "not scheduled"
                }
              />
            </div>
            <CampaignDonut stats={jobStats(detail.campaign)} />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent errors/logs</p>
              {(detail.logs ?? []).map((log: any) => (
                <CampaignLogEntry key={log.id} log={log} />
              ))}
              {!detail.logs?.length ? <p className="text-sm text-muted-foreground">No logs yet.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function GroupPicker({ groups, selected, setSelected, allowAll }: any) {
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id) ? selected.filter((x: string) => x !== id) : [...selected, id],
    );
  return (
    <section className={panelClass("space-y-3")}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Approved Groups</p>
        {allowAll ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setSelected(groups.map((g: any) => g.id))}
            >
              SELECT ALL
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setSelected([])}>
              CLEAR ALL
            </Button>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        {groups.map((g: any) => (
          <button
            type="button"
            key={g.id}
            onClick={() => toggle(g.id)}
            className="flex w-full items-center gap-3 border border-border bg-background p-3 text-left text-sm"
          >
            {selected.includes(g.id) ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            <span>{g.title}</span>
          </button>
        ))}
        {!groups.length ? (
          <p className="text-sm text-muted-foreground">Approve groups before using this flow.</p>
        ) : null}
      </div>
    </section>
  );
}

function AudienceSummary({ result, selectable, selected, setSelected, auth, actions, actionBusy, runAction }: any) {
  const users = result.users ?? [];
  const choose = (count: number) => setSelected(users.slice(0, count).map((u: any) => u.id));
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(Math.min(10, users.length || 10));
  const selectionRequest = {
    auth,
    groupIds: [],
    onlyNew: true,
    filter: result.filter ?? "ALL_ELIGIBLE",
    usernameFilter: result.usernameFilter ?? "ALL",
    activityFilter: result.activityFilter ?? "ALL",
    excludeInactive: result.excludeInactive ?? true,
  };
  const selectAll = async () => {
    if (!actions?.selectAudienceIds) {
      setSelected(users.map((u: any) => u.id));
      return;
    }
    await runAction?.("select-all-audience", async () => {
      const response = await actions.selectAudienceIds({ data: selectionRequest });
      setSelected(response.ids ?? []);
    });
  };
  const selectRange = async () => {
    const from = Math.max(1, rangeFrom);
    const to = Math.max(from, rangeTo);
    if (!actions?.selectAudienceIds) {
      setSelected(users.slice(from - 1, to).map((u: any) => u.id));
      return;
    }
    await runAction?.("select-range-audience", async () => {
      const response = await actions.selectAudienceIds({
        data: { ...selectionRequest, rangeFrom: from, rangeTo: to },
      });
      setSelected(response.ids ?? []);
    });
  };
  return (
    <section className={panelClass("space-y-3")}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Total Found" value={result.totalFound} />
        <Stat label="Showing" value={`${result.showingFrom ?? 0}-${result.showingTo ?? users.length}`} />
        <Stat label="Eligible" value={result.eligible} />
        <Stat label="Excluded Inactive" value={result.excludedInactive ?? 0} />
        <Stat label="With Username" value={result.withUsername ?? 0} />
        <Stat label="Active Posters" value={result.activePosters ?? 0} />
        <Stat label="Previously Contacted" value={result.previouslyContacted} />
        <Stat label="Duplicates" value={result.duplicates} />
        <Stat label="Excluded" value={result.excluded} />
      </div>
      {selectable ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={actionBusy === "select-all-audience"}
              onClick={() => void selectAll()}
            >
              {actionBusy === "select-all-audience" ? "Selecting..." : "SELECT ALL"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setSelected([])}>
              SELECT NONE
            </Button>
            {[10, 15, 25, 50].map((n) => (
              <Button key={n} type="button" size="sm" variant="secondary" onClick={() => choose(n)}>
                Select {n}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className={inputClass()} type="number" min={1} value={rangeFrom} onChange={(e) => setRangeFrom(Number(e.target.value))} placeholder="From" />
            <input className={inputClass()} type="number" min={1} value={rangeTo} onChange={(e) => setRangeTo(Number(e.target.value))} placeholder="To" />
            <Button type="button" variant="secondary" disabled={actionBusy === "select-range-audience"} onClick={() => void selectRange()}>
              {actionBusy === "select-range-audience" ? "Selecting..." : "SELECT RANGE"}
            </Button>
          </div>
          <p className="text-sm font-semibold">Selected Users: {selected.length}</p>
        </div>
      ) : null}
      <div className="max-h-72 space-y-2 overflow-auto">
        {users.map((u: any, index: number) => (
          <button
            type="button"
            key={u.id}
            onClick={() =>
              selectable &&
              setSelected(
                selected.includes(u.id)
                  ? selected.filter((x: string) => x !== u.id)
                  : [...selected, u.id],
              )
            }
            className="flex w-full items-center justify-between gap-3 border border-border bg-background p-3 text-left text-sm"
          >
            <span className="flex min-w-0 items-start gap-3">
              {selectable ? <input type="checkbox" readOnly checked={selected.includes(u.id)} /> : null}
              <span className="min-w-0">
                {index + 1}. {u.username ? `@${u.username}` : (u.display_name ?? u.telegram_user_id)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Presence: {presenceLabel(u.presence_status)}
                  {u.last_seen_at ? ` | Last seen ${new Date(u.last_seen_at).toLocaleDateString()}` : ""}
                  {" | "}Source: {sourceGroupLabel(u)}
                  {u.recent_activity_at ? ` | Recent group activity ${new Date(u.recent_activity_at).toLocaleDateString()}` : ""}
                  {` | Messages observed ${u.messages_observed ?? 0}`}
                </span>
              </span>
            </span>
            <span className={statusTone(u.eligibility)}>
              {selectable && selected.includes(u.id) ? "SELECTED" : u.eligibility}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MessageForm(props: any) {
  const emojiPageSize = 48;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"recent" | "installed" | "featured" | "search" | "categories">("recent");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCatalog, setEmojiCatalog] = useState<any>(null);
  const [emojiLoading, setEmojiLoading] = useState(false);
  const [emojiError, setEmojiError] = useState("");
  const [emojiVisibleCount, setEmojiVisibleCount] = useState(emojiPageSize);
  const [selectedEmojiPack, setSelectedEmojiPack] = useState<string | null>(null);
  const [emojiPreviewLoading, setEmojiPreviewLoading] = useState<Record<string, boolean>>({});
  const [emojiPackErrors, setEmojiPackErrors] = useState<Record<string, string>>({});
  const [selectedEmojiIds, setSelectedEmojiIds] = useState<Record<string, boolean>>({});
  const [composerPreviews, setComposerPreviews] = useState<Record<string, any>>({});
  const [composerPreviewLoading, setComposerPreviewLoading] = useState<Record<string, boolean>>({});
  const emojiRequestRef = useRef(0);
  const emojiCatalogCacheRef = useRef<Record<string, any>>({});
  const composerPreviewCacheRef = useRef<Record<string, any>>({});
  const pickerTabRef = useRef(pickerTab);
  const selectedEmojiPackRef = useRef<string | null>(selectedEmojiPack);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    pickerTabRef.current = pickerTab;
  }, [pickerTab]);
  useEffect(() => {
    selectedEmojiPackRef.current = selectedEmojiPack;
  }, [selectedEmojiPack]);
  useEffect(() => {
    const entities = normalizeMessageEntities(props.entities ?? [], props.message ?? "");
    const ids = [...new Set(entities.filter((entity) => entity.type === "custom_emoji" && entity.document_id).map((entity) => String(entity.document_id)))];
    const missing = ids.filter((id) => !composerPreviewCacheRef.current[id] && !composerPreviewLoading[id]);
    if (!missing.length) return;
    setComposerPreviewLoading((current) => ({ ...current, ...Object.fromEntries(missing.map((id) => [id, true])) }));
    void props.actions.getCustomEmojiPreviews({
      data: { auth: props.auth, connectionId: props.connectionId || null, documentIds: missing },
    }).then((response: any) => {
      const previews = Object.fromEntries((response?.previews ?? []).map((preview: any) => [String(preview.document_id), preview]));
      composerPreviewCacheRef.current = { ...composerPreviewCacheRef.current, ...previews };
      setComposerPreviews((current) => ({ ...current, ...previews }));
    }).catch((error: unknown) => {
      console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", { stage: "composer_preview", error: error instanceof Error ? error.message : "Composer preview failed" });
    }).finally(() => {
      setComposerPreviewLoading((current) => {
        const next = { ...current };
        missing.forEach((id) => delete next[id]);
        return next;
      });
    });
  }, [props.message, props.entities, props.connectionId]);
  function packKeyFor(tab: string) {
    return `${tab}Packs`;
  }
  function emojiCatalogCacheKey(tab: string) {
    return `${props.connectionId || "auto"}:${tab}:${tab === "search" ? emojiSearch.trim().toLowerCase() : ""}`;
  }
  function tabItems(catalog: any, tab: string, packId?: string | null) {
    if (tab === "categories") return [];
    const packs = catalog?.[packKeyFor(tab)] ?? [];
    if (packId && packs.length) {
      const pack = packs.find((entry: any) => String(entry.id) === String(packId));
      return pack?.items ?? [];
    }
    return catalog?.[tab] ?? [];
  }
  async function loadEmojiCatalog(nextTab = pickerTab) {
    const requestId = ++emojiRequestRef.current;
    const cachedCatalog = emojiCatalogCacheRef.current[emojiCatalogCacheKey(nextTab)];
    if (cachedCatalog) {
      const packs = cachedCatalog?.[packKeyFor(nextTab)] ?? [];
      const packId = packs[0]?.id ?? null;
      selectedEmojiPackRef.current = packId;
      setSelectedEmojiPack(packId);
      setEmojiCatalog(cachedCatalog);
      setEmojiLoading(false);
      setEmojiError("");
      setEmojiVisibleCount(emojiPageSize);
      void hydrateEmojiPreviews(cachedCatalog, nextTab, emojiPageSize, requestId, packId, true);
      return;
    }
    setEmojiLoading(true);
    setEmojiError("");
    setEmojiVisibleCount(emojiPageSize);
    setSelectedEmojiPack(null);
    try {
      const result = await props.actions.getCustomEmojiCatalog({
        data: { auth: props.auth, connectionId: props.connectionId || null, query: nextTab === "search" ? emojiSearch : "", tab: nextTab },
      });
      if (requestId !== emojiRequestRef.current) return;
      const packs = result?.[packKeyFor(nextTab)] ?? [];
      const packId = packs[0]?.id ?? null;
      selectedEmojiPackRef.current = packId;
      setSelectedEmojiPack(packId);
      emojiCatalogCacheRef.current[emojiCatalogCacheKey(nextTab)] = result;
      setEmojiCatalog(result);
      setEmojiLoading(false);
      void hydrateEmojiPreviews(result, nextTab, emojiPageSize, requestId, packId, true);
    } catch (error) {
      if (requestId !== emojiRequestRef.current) return;
      setEmojiError(error instanceof Error ? error.message : "Custom emoji could not be loaded.");
      setEmojiLoading(false);
    }
  }
  function mergePreview(catalog: any, nextTab: string, itemId: string, preview: any) {
    const patchItem = (item: any) => {
      if (String(item.document_id) !== itemId) return item;
      return preview
        ? { ...item, preview_url: preview.data_url, mime_type: preview.mime_type, preview_format: preview.format, fallback: preview.fallback ?? item.fallback }
        : { ...item, preview_unavailable: true };
    };
    const packKey = `${nextTab}Packs`;
    return {
      ...catalog,
      [nextTab]: (catalog?.[nextTab] ?? []).map(patchItem),
      [packKey]: (catalog?.[packKey] ?? []).map((pack: any) => ({
        ...pack,
        items: (pack.items ?? []).map(patchItem),
      })),
    };
  }
  async function hydrateEmojiPreviews(result: any, nextTab: string, limit = emojiPageSize, requestId = emojiRequestRef.current, packId = selectedEmojiPack, prefetch = false) {
    if (!result || nextTab === "categories") return result;
    const sourceItems = tabItems(result, nextTab, packId);
    const items = sourceItems.slice(0, limit).filter((item: any) => !item.preview_url && !item.preview_unavailable);
    if (!items.length) return result;
    const ids = items.map((item: any) => String(item.document_id));
    setEmojiPreviewLoading((current) => ({ ...current, ...Object.fromEntries(ids.map((id: string) => [id, true])) }));
    try {
      const response = await props.actions.getCustomEmojiPreviews({
        data: { auth: props.auth, connectionId: props.connectionId || null, documentIds: ids },
      });
      if (requestId !== emojiRequestRef.current || nextTab !== pickerTabRef.current || packId !== selectedEmojiPackRef.current) return result;
      const byId = new Map((response?.previews ?? []).map((preview: any) => [String(preview.document_id), preview]));
      const nextCatalog = ids.reduce((catalog: any, id: string) => mergePreview(catalog, nextTab, id, byId.get(id) ?? null), result);
      emojiCatalogCacheRef.current[emojiCatalogCacheKey(nextTab)] = nextCatalog;
      setEmojiCatalog(nextCatalog);
      if (prefetch) {
        window.setTimeout(() => {
          if (requestId === emojiRequestRef.current) void hydrateEmojiPreviews(nextCatalog, nextTab, Math.min(sourceItems.length, limit + emojiPageSize), requestId, packId, false);
        }, 150);
      }
      return nextCatalog;
    } finally {
      setEmojiPreviewLoading((current) => {
        const next = { ...current };
        ids.forEach((id: string) => delete next[id]);
        return next;
      });
    }
  }
  async function loadMoreEmoji() {
    if (emojiLoading || pickerTab === "categories" || !emojiCatalog) return;
    const total = tabItems(emojiCatalog, pickerTab, selectedEmojiPack).length;
    if (emojiVisibleCount >= total) return;
    const nextCount = Math.min(total, emojiVisibleCount + emojiPageSize);
    setEmojiVisibleCount(nextCount);
    setEmojiLoading(true);
    try {
      await hydrateEmojiPreviews(emojiCatalog, pickerTab, nextCount);
    } finally {
      setEmojiLoading(false);
    }
  }
  function selectEmojiPack(packId: string | null) {
    const started = performance.now();
    emojiRequestRef.current += 1;
    selectedEmojiPackRef.current = packId;
    setSelectedEmojiPack(packId);
    setEmojiVisibleCount(emojiPageSize);
    setEmojiError("");
    requestAnimationFrame(() => {
      const requestId = emojiRequestRef.current;
      console.info("CUSTOM_EMOJI_PACK_SWITCH_MS", { tab: pickerTab, pack_id: packId, ms: Math.round(performance.now() - started) });
      void hydrateEmojiPreviews(emojiCatalog, pickerTab, emojiPageSize, requestId, packId, true);
    });
  }
  useEffect(() => {
    if (!pickerOpen || pickerTab !== "search") return;
    const timer = window.setTimeout(() => void loadEmojiCatalog("search"), 350);
    return () => window.clearTimeout(timer);
  }, [emojiSearch, pickerOpen, pickerTab]);
  function insertCustomEmoji(item: any) {
    const fallback = item.fallback || "⭐";
    const node = textareaRef.current;
    const current = props.message ?? "";
    const start = node ? node.selectionStart : current.length;
    const end = node ? node.selectionEnd : current.length;
    const replaced = replaceTextAndShiftEntities({
      text: current,
      entities: props.entities ?? [],
      start,
      end,
      insertText: fallback,
    });
    props.setMessage(replaced.text);
    props.setEntities([...replaced.entities, {
      type: "custom_emoji",
      offset: replaced.startOffset,
      length: replaced.insertedLength,
      document_id: String(item.document_id),
      fallback,
      premium_required: item.premium_required === true,
    }]);
    if (item.preview_url) {
      const preview = {
        document_id: String(item.document_id),
        data_url: item.preview_url,
        format: item.preview_format,
        mime_type: item.mime_type,
        fallback,
      };
      composerPreviewCacheRef.current[String(item.document_id)] = preview;
      setComposerPreviews((current) => ({ ...current, [String(item.document_id)]: preview }));
    }
    setSelectedEmojiIds((currentIds) => ({ ...currentIds, [String(item.document_id)]: true }));
    setPickerOpen(false);
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(start + fallback.length, start + fallback.length);
    });
  }
  function applyEntity(type: "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_url") {
    const node = textareaRef.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    if (start === end) return;
    const entity: any = { type, offset: utf16Offset(props.message ?? "", start), length: utf16Length((props.message ?? "").slice(start, end)) };
    if (type === "text_url") {
      const url = prompt("Link URL");
      if (!url) return;
      entity.url = url;
    }
    props.setEntities(normalizeMessageEntities([...(props.entities ?? []), entity], props.message ?? ""));
  }
  function addCustomEmoji() {
    if (!props.premiumEmojiActive) {
      window.location.href = "/mini-app/billing";
      return;
    }
    setPickerOpen(true);
    void loadEmojiCatalog();
    return;
  }
  return (
    <section className={panelClass("space-y-3")}>
      <input
        className={inputClass()}
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
        placeholder="Campaign name"
      />
      <textarea
        ref={textareaRef}
        className={inputClass("min-h-28")}
        value={props.message}
        onChange={(e) => {
          const nextText = e.target.value;
          props.setEntities(reconcileEntitiesAfterTextChange(props.message ?? "", nextText, props.entities ?? []));
          props.setMessage(nextText);
        }}
        placeholder="Message text"
      />
      <TelegramMessagePreview
        text={props.message ?? ""}
        entities={props.entities ?? []}
        emojiPreviews={composerPreviews}
        emojiLoading={composerPreviewLoading}
        mediaUrl={props.mediaUrl}
        buttonText={props.buttonText}
        buttonUrl={props.buttonUrl}
      />
      <div className="flex flex-wrap gap-2">
        {[
          ["bold", "B"],
          ["italic", "I"],
          ["underline", "U"],
          ["strikethrough", "S"],
          ["spoiler", "Spoiler"],
          ["text_url", "Link"],
        ].map(([type, label]) => (
          <Button key={type} type="button" size="sm" variant="secondary" onClick={() => applyEntity(type as any)}>
            {label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={addCustomEmoji}>
          <Sparkles className="size-4" />
          {props.premiumEmojiActive ? "CUSTOM EMOJI" : "Premium Emoji - $20 add-on"}
        </Button>
        {props.sendingConnection ? (
          <span className={`self-center text-xs font-semibold ${props.sendingConnection.telegram_premium === true ? "text-success" : "text-warning"}`}>
            Sending account: {props.sendingConnection.username ? `@${props.sendingConnection.username}` : props.sendingConnection.account_name ?? "selected"} - {props.sendingConnection.telegram_premium === true ? "Telegram Premium ✓" : props.sendingConnection.telegram_premium === false ? "Telegram Premium required" : "Telegram Premium unknown"}
          </span>
        ) : null}
        {(props.entities ?? []).length ? (
          <span className="self-center text-xs text-muted-foreground">{props.entities.length} custom entity saved</span>
        ) : null}
      </div>
      {pickerOpen ? (
        <CustomEmojiPicker
          catalog={emojiCatalog}
          error={emojiError}
          loading={emojiLoading}
          query={emojiSearch}
          setQuery={setEmojiSearch}
          tab={pickerTab}
          visibleCount={emojiVisibleCount}
          selectedPack={selectedEmojiPack}
          previewLoading={emojiPreviewLoading}
          packErrors={emojiPackErrors}
          selectedEmojiIds={selectedEmojiIds}
          setTab={setPickerTab}
          selectPack={selectEmojiPack}
          load={loadEmojiCatalog}
          loadMore={loadMoreEmoji}
          insert={insertCustomEmoji}
          close={() => setPickerOpen(false)}
        />
      ) : null}
      <select
        className={inputClass()}
        value={props.mediaType}
        onChange={(e) => props.setMediaType(e.target.value)}
      >
        <option value="">No media</option>
        <option value="photo">Image</option>
        <option value="video">Video</option>
      </select>
      <input
        className={inputClass()}
        value={props.mediaUrl}
        onChange={(e) => props.setMediaUrl(e.target.value)}
        placeholder="Image/video URL"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputClass()}
          value={props.buttonText}
          onChange={(e) => props.setButtonText(e.target.value)}
          placeholder="Button text"
        />
        <input
          className={inputClass()}
          value={props.buttonUrl}
          onChange={(e) => props.setButtonUrl(e.target.value)}
          placeholder="Button URL"
        />
      </div>
    </section>
  );
}

function CustomEmojiPicker({
  catalog,
  error,
  loading,
  query,
  setQuery,
  tab,
  visibleCount,
  selectedPack,
  previewLoading,
  packErrors,
  selectedEmojiIds,
  setTab,
  selectPack,
  load,
  loadMore,
  insert,
  close,
}: any) {
  const packKey = `${tab}Packs`;
  const allPacks = catalog?.[packKey] ?? [];
  const activePack = selectedPack ? allPacks.find((pack: any) => String(pack.id) === String(selectedPack)) : allPacks[0];
  const allItems = tab === "categories" ? [] : activePack ? (activePack.items ?? []) : (catalog?.[tab] ?? []);
  const items = allItems.slice(0, visibleCount ?? 48);
  const tabs = ["recent", "installed", "featured", "search", "categories"];
  const onGridScroll = (event: any) => {
    const node = event.currentTarget;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 80) void loadMore();
  };
  const renderEmojiButton = (item: any) => (
    <button
      key={`${item.source}-${item.document_id}`}
      type="button"
      className={`relative flex aspect-square min-h-0 items-center justify-center border bg-transparent p-1 hover:border-primary hover:bg-primary/10 ${selectedEmojiIds?.[String(item.document_id)] ? "border-primary bg-primary/10" : "border-transparent"}`}
      onClick={() => insert(item)}
      title={item.set_title || item.fallback || "Custom emoji"}
      aria-label={item.set_title || item.fallback || "Custom emoji"}
    >
      {item.preview_url ? (
        item.preview_format === "tgs" ? (
          <TgsPlayer className="size-9" src={item.preview_url} fallback={item.fallback || "*"} />
        ) : item.preview_format === "webm" || item.mime_type === "video/webm" ? (
          <video
            className="size-9 object-contain"
            src={item.preview_url}
            muted
            playsInline
            autoPlay
            loop
            onLoadedData={() => console.info("CUSTOM_EMOJI_RENDER_FORMAT", { format: "webm", document_id: String(item.document_id) })}
            onError={() => console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", { stage: "webm_render", document_id: String(item.document_id) })}
          />
        ) : (
          <img
            className="size-9 object-contain"
            src={item.preview_url}
            alt={item.fallback || "custom emoji"}
            onLoad={() => console.info("CUSTOM_EMOJI_RENDER_FORMAT", { format: "image", document_id: String(item.document_id) })}
            onError={() => console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", { stage: "image_render", document_id: String(item.document_id) })}
          />
        )
      ) : item.preview_unavailable ? (
        <span className="text-2xl leading-none">{item.fallback || "*"}</span>
      ) : (
        <span className={`size-8 rounded-full bg-muted ${previewLoading?.[String(item.document_id)] ? "animate-pulse" : ""}`} />
      )}
      {item.premium_required ? <span className="pointer-events-none absolute right-0 top-0 size-1.5 rounded-full bg-primary" /> : null}
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg border border-border bg-card p-3 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Custom Emoji</p>
            <p className="text-xs text-muted-foreground">
              {catalog?.previewConnectionId ? "Preview uses a healthy linked Telegram session. Sending still depends on the selected campaign account." : "Preview session is selected automatically."}
            </p>
          </div>
          <Button type="button" size="icon" variant="secondary" onClick={close} aria-label="Close custom emoji picker">
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={tab === name ? "default" : "secondary"}
              onClick={() => {
                setTab(name);
                void load(name);
              }}
            >
              {name.toUpperCase()}
            </Button>
          ))}
        </div>
        {tab === "search" ? (
          <div className="mt-3 flex gap-2">
            <input className={inputClass()} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search custom emoji sets" />
            <Button type="button" variant="secondary" onClick={() => load("search")}>SEARCH</Button>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading custom emoji...</p> : null}
        {tab === "categories" ? (
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {(catalog?.categories ?? []).map((group: any) => (
              <div key={`${group.title}-${group.icon_document_id}`} className="border border-border bg-background p-3">
                <p className="text-sm font-semibold">{group.title}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{(group.emoticons ?? []).join(" ") || "No category keywords returned."}</p>
              </div>
            ))}
            {!loading && !(catalog?.categories ?? []).length ? <Empty message="No custom emoji categories returned by Telegram." /> : null}
          </div>
        ) : (
          <div className="mt-3 max-h-80 overflow-y-auto pr-1" onScroll={onGridScroll}>
            {allPacks.length ? (
              <div className="sticky top-0 z-10 mb-2 border-b border-border bg-card pb-2">
                <div className="flex gap-1 overflow-x-auto">
                  {allPacks.map((pack: any) => {
                    const icon = (pack.items ?? []).find((item: any) => item.preview_url) ?? (pack.items ?? [])[0];
                    const active = String(activePack?.id) === String(pack.id);
                    return (
                      <button
                        key={`${pack.source}-${pack.id}`}
                        type="button"
                        className={`flex size-10 shrink-0 items-center justify-center border ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                        title={pack.title}
                        aria-label={pack.title}
                        onClick={() => selectPack(String(pack.id))}
                      >
                        {icon?.preview_url ? (
                          icon.preview_format === "tgs" ? (
                            <TgsPlayer className="size-7" src={icon.preview_url} fallback={icon.fallback || "*"} />
                          ) : icon.preview_format === "webm" || icon.mime_type === "video/webm" ? (
                            <video className="size-7 object-contain" src={icon.preview_url} muted playsInline autoPlay loop />
                          ) : (
                            <img className="size-7 object-contain" src={icon.preview_url} alt={pack.title} />
                          )
                        ) : (
                          <Sparkles className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {activePack ? <p className="mt-1 truncate text-xs text-muted-foreground">{activePack.title}</p> : null}
              </div>
            ) : null}
            {packErrors?.[selectedPack ?? tab] ? (
              <div className="mb-2 flex items-center justify-between gap-2 border border-warning/40 bg-warning/10 p-2 text-xs">
                <span>{packErrors[selectedPack ?? tab]}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => load(tab)}>Retry</Button>
              </div>
            ) : null}
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
              {items.map(renderEmojiButton)}
            </div>
            {!loading && !items.length ? <div className="col-span-full"><Empty message="No custom emoji returned for this tab." /></div> : null}
            {items.length < allItems.length ? <p className="py-2 text-center text-xs text-muted-foreground">Loading more...</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TelegramMessagePreview({ text, entities, emojiPreviews, emojiLoading, mediaUrl, buttonText, buttonUrl }: any) {
  const normalized = normalizeMessageEntities(entities ?? [], text ?? "");
  return (
    <section className="rounded-none border border-border bg-[#d7e6f3] p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-slate-700">Telegram Preview</p>
      <div className="max-w-[92%] rounded-lg rounded-bl-sm bg-white px-3 py-2 text-sm leading-relaxed text-slate-950 shadow-sm">
        {text ? (
          <RenderedTelegramText
            text={text}
            entities={normalized}
            emojiPreviews={emojiPreviews ?? {}}
            emojiLoading={emojiLoading ?? {}}
          />
        ) : (
          <span className="text-slate-500">No text</span>
        )}
        {mediaUrl ? <p className="mt-2 break-all text-xs text-sky-700">{mediaUrl}</p> : null}
        {buttonText && buttonUrl ? (
          <a className="mt-2 block rounded border border-sky-200 px-2 py-1 text-center text-xs font-semibold text-sky-700" href={buttonUrl} target="_blank" rel="noreferrer">
            {buttonText}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function RenderedTelegramText({ text, entities, emojiPreviews, emojiLoading }: any) {
  const out: any[] = [];
  const custom = (entities ?? []).filter((entity: any) => entity.type === "custom_emoji" && entity.document_id);
  let pos = 0;
  let key = 0;
  while (pos < text.length) {
    const emoji = custom.find((entity: any) => entity.offset === pos);
    if (emoji) {
      out.push(
        <TelegramCustomEmoji
          key={`emoji-${key++}`}
          entity={emoji}
          preview={emojiPreviews?.[String(emoji.document_id)]}
          loading={emojiLoading?.[String(emoji.document_id)]}
        />,
      );
      pos += emoji.length;
      continue;
    }
    const nextEmoji = custom.filter((entity: any) => entity.offset > pos).sort((a: any, b: any) => a.offset - b.offset)[0];
    const boundary = Math.min(nextEmoji?.offset ?? text.length, nextEntityBoundary(text, entities, pos));
    const chunk = text.slice(pos, boundary);
    out.push(
      <TelegramFormattedSpan key={`span-${key++}`} text={chunk} active={activeEntities(entities, pos, boundary)} />,
    );
    pos = boundary;
  }
  return <p className="whitespace-pre-wrap break-words">{out}</p>;
}

function nextEntityBoundary(text: string, entities: any[], pos: number) {
  const points = [text.length];
  for (const entity of entities ?? []) {
    if (entity.type === "custom_emoji") continue;
    const start = Number(entity.offset ?? 0);
    const end = start + Number(entity.length ?? 0);
    if (start > pos) points.push(start);
    if (end > pos) points.push(end);
  }
  return Math.min(...points);
}

function activeEntities(entities: any[], start: number, end: number) {
  return (entities ?? []).filter((entity) => entity.type !== "custom_emoji" && entity.offset <= start && entity.offset + entity.length >= end);
}

function TelegramFormattedSpan({ text, active }: any) {
  const classes = [
    active.some((entity: any) => entity.type === "bold") ? "font-bold" : "",
    active.some((entity: any) => entity.type === "italic") ? "italic" : "",
    active.some((entity: any) => entity.type === "underline") ? "underline underline-offset-2" : "",
    active.some((entity: any) => entity.type === "strikethrough") ? "line-through" : "",
    active.some((entity: any) => entity.type === "text_url") ? "text-sky-700 underline underline-offset-2" : "",
  ].filter(Boolean).join(" ");
  const link = active.find((entity: any) => entity.type === "text_url" && entity.url);
  const content = active.some((entity: any) => entity.type === "spoiler") ? <TelegramSpoiler>{text}</TelegramSpoiler> : text;
  if (link) {
    return (
      <a className={classes} href={link.url} target="_blank" rel="noreferrer" onClick={(event) => event.preventDefault()}>
        {content}
      </a>
    );
  }
  return <span className={classes}>{content}</span>;
}

function TelegramSpoiler({ children }: any) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      className={`rounded px-0.5 ${revealed ? "bg-slate-200 text-slate-950" : "bg-slate-800 text-transparent"}`}
      onClick={() => setRevealed((value) => !value)}
      aria-label={revealed ? "Hide spoiler" : "Reveal spoiler"}
    >
      {children}
    </button>
  );
}

function TelegramCustomEmoji({ entity, preview, loading }: any) {
  const fallback = entity.fallback || "*";
  if (preview?.data_url && preview.format === "tgs") {
    return <TgsPlayer className="mx-0.5 inline-block size-5 align-[-0.25em]" src={preview.data_url} fallback={fallback} />;
  }
  if (preview?.data_url && (preview.format === "webm" || preview.mime_type === "video/webm")) {
    return <video className="mx-0.5 inline-block size-5 align-[-0.25em]" src={preview.data_url} muted playsInline autoPlay loop />;
  }
  if (preview?.data_url) {
    return <img className="mx-0.5 inline-block size-5 object-contain align-[-0.25em]" src={preview.data_url} alt={fallback} />;
  }
  return (
    <span className={`mx-0.5 inline-flex items-center gap-0.5 align-[-0.15em] ${loading ? "opacity-60" : "text-warning"}`} title={loading ? "Loading premium emoji preview" : "Premium emoji preview unavailable"}>
      <span>{fallback}</span>
      {!loading ? <AlertTriangle className="size-3" aria-hidden="true" /> : null}
    </span>
  );
}

function CampaignHistory({ auth, data, actions, reload }: any) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="space-y-3">
      {rows.map((c: any) => (
        <article key={c.id} className={panelClass()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.type} | {c.completed_count ?? 0}/{c.total_targets ?? 0} sent |{" "}
                {c.failed_count ?? 0} failed
              </p>
            </div>
            <span className={`text-xs font-semibold ${statusTone(c.status)}`}>{c.status}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["START", "PAUSE", "RESUME", "STOP"].map((action) => (
              <Button
                key={action}
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await actions.controlCampaign({ data: { auth, id: c.id, action } });
                  await reload();
                }}
              >
                {action}
              </Button>
            ))}
          </div>
        </article>
      ))}
      {!rows.length ? <Empty message="No campaigns yet." /> : null}
    </div>
  );
}

function GrowthIntelligence({ auth, data, actions, reload, runAction, actionBusy }: any) {
  const [view, setView] = useState(data);
  useEffect(() => setView(data), [data]);
  const [connectionId, setConnectionId] = useState(data?.connections?.find((row: any) => row.status === "CONNECTED")?.id ?? "");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [chartSeries, setChartSeries] = useState(["memberCount", "joins", "leaves", "netGrowth"]);
  const toggleChartSeries = (series: string) => setChartSeries((current) => current.includes(series) ? current.filter((item) => item !== series) : [...current, series]);
  const detail = view?.destinations?.find((row: any) => row.id === detailId);
  const summary = view?.summary ?? {};
  const cards = [["Admin Groups", summary.adminGroups], ["Admin Channels", summary.adminChannels], ["Total Members/Subscribers", summary.totalMembers], ["New Joins", summary.joins], ["Leaves", summary.leaves], ["Net Growth", summary.netGrowth], ["Engagement", summary.engagement]];
  return <div className="min-w-0 space-y-3 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section className={panelClass("space-y-3")}>
      <p className="text-sm font-semibold">Telegram Session</p>
      <select className={inputClass()} value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
        <option value="">Select connected admin account</option>
        {(view?.connections ?? []).map((row: any) => <option key={row.id} value={row.id} disabled={row.status !== "CONNECTED"}>{row.username ? `@${row.username}` : row.label} · {row.health}</option>)}
      </select>
      <Button className="w-full" disabled={!connectionId || actionBusy === "growth-discover"} onClick={() => runAction("growth-discover", async () => { await actions.discoverGrowthDestinations({ data: { auth, connectionId } }); await reload(); })}>{actionBusy === "growth-discover" ? "DISCOVERING ADMIN CHATS..." : "DISCOVER / REFRESH ADMIN CHATS"}</Button>
      <p className="text-xs text-muted-foreground">Collection uses only this selected session. Background checks run incrementally.</p>
    </section>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{cards.map(([label, value]) => <section key={String(label)} className={panelClass("min-w-0 p-3")}><p className="break-words text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value ?? 0}</p></section>)}</div>
    <section className={panelClass("space-y-2")}><div className="flex flex-wrap gap-2">{["24H", "7D", "30D", "90D"].map((range) => <Button key={range} size="sm" variant={range === view?.range ? "default" : "secondary"} onClick={() => void runAction(`growth-range-${range}`, async () => setView(await actions.getGrowthIntelligence({ data: { auth, range } })))}>{range}</Button>)}</div><div className="grid min-w-0 grid-cols-2 gap-2"><input className={inputClass()} type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}/><input className={inputClass()} type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}/></div><Button size="sm" variant="secondary" disabled={!customStart || !customEnd} onClick={() => void runAction("growth-custom", async () => setView(await actions.getGrowthIntelligence({ data: { auth, range: "30D", customStart, customEnd } })))}>CUSTOM RANGE</Button><p className="text-xs text-muted-foreground">Visitor data unavailable from Telegram</p></section>
    {view?.destinations?.length ? <section className={panelClass("space-y-2")}><h2 className="font-semibold">Rankings</h2><div className="grid gap-2 text-xs sm:grid-cols-2">{[["Fastest Growing", [...view.destinations].sort((a:any,b:any) => b.netGrowth-a.netGrowth)[0]], ["Most Members Gained", [...view.destinations].sort((a:any,b:any) => b.joins-a.joins)[0]], ["Most Members Lost", [...view.destinations].sort((a:any,b:any) => b.leaves-a.leaves)[0]], ["Best Engagement", [...view.destinations].sort((a:any,b:any) => Number(b.engagementRate ?? -1)-Number(a.engagementRate ?? -1))[0]], ["Most Active", [...view.destinations].sort((a:any,b:any) => b.messages-a.messages)[0]], ["Needs Attention", [...view.destinations].filter((row:any) => row.health).sort((a:any,b:any) => a.health.score-b.health.score)[0]]].map(([label,row]:any) => <p key={label} className="min-w-0 border border-border p-2"><span className="text-muted-foreground">{label}</span><br/><span className="block truncate font-semibold">{row?.title ?? "Not enough data yet"}</span></p>)}</div></section> : null}
    {(view?.destinations ?? []).map((row: any) => <button type="button" key={row.id} onClick={() => setDetailId(detailId === row.id ? null : row.id)} className="block w-full min-w-0 border border-border bg-card p-3 text-left">
      <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{row.title}</p><p className="truncate text-xs text-muted-foreground">{row.username ? `@${row.username}` : row.destination_type} · {row.admin_status}</p></div><span className={statusTone(row.status)}>{row.status}</span></div>
      <div className="mt-3 border-y border-border py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current Members</p><p className="text-2xl font-semibold">{row.member_count == null ? "Unavailable" : Number(row.member_count).toLocaleString()}</p></div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs"><span>+{row.joins}<br/>joins</span><span>-{row.leaves}<br/>leaves</span><span>{row.netGrowth}<br/>net</span><span>{row.engagementRate == null ? "—" : `${row.engagementRate.toFixed(1)}%`}<br/>engage</span></div>
      <div className="mt-3 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>{([[["memberCount","Member Count"],["joins","Joins"],["leaves","Leaves"],["netGrowth","Net Growth"]]] as const)[0].map(([series,label]) => <Button key={series} type="button" size="sm" variant={chartSeries.includes(series) ? "default" : "secondary"} className="h-7 px-2 text-[10px]" onClick={() => toggleChartSeries(series)}>{label}</Button>)}</div>
      <div className="mt-2 h-44 min-w-0 rounded-lg bg-muted/20 p-1" onClick={(event) => event.stopPropagation()}><ResponsiveContainer width="100%" height="100%"><LineChart data={row.chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/><XAxis dataKey="bucket" axisLine={false} tickLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined,{month:"short",day:"numeric"})} minTickGap={24} tick={{fontSize:10,fill:"var(--muted-foreground)"}}/><YAxis axisLine={false} tickLine={false} width={42} tick={{fontSize:10,fill:"var(--muted-foreground)"}}/><Tooltip contentStyle={{borderRadius:10,border:"1px solid var(--border)",background:"var(--popover)",color:"var(--popover-foreground)",fontSize:12}} labelFormatter={(v) => new Date(v).toLocaleString()}/>{chartSeries.includes("memberCount") ? <Line type="linear" dataKey="memberCount" name="Members" stroke="var(--chart-1)" strokeWidth={2.25} connectNulls={false} dot={row.chart?.length < 12}/> : null}{chartSeries.includes("joins") ? <Line type="linear" dataKey="joins" name="Joins" stroke="var(--success)" strokeWidth={2} connectNulls={false} dot={false}/> : null}{chartSeries.includes("leaves") ? <Line type="linear" dataKey="leaves" name="Leaves" stroke="var(--destructive)" strokeWidth={2} connectNulls={false} dot={false}/> : null}{chartSeries.includes("netGrowth") ? <Line type="linear" dataKey="netGrowth" name="Net Growth" stroke="var(--chart-2)" strokeWidth={2} connectNulls={false} dot={false}/> : null}</LineChart></ResponsiveContainer></div>
      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground"><p>Live tracking: {row.status === "ACTIVE" ? "Active" : row.status}</p><p>Admin log history: {row.coverage?.adminLog?.error ?? (row.coverage?.adminLog?.complete ? "Complete" : "In progress")}</p><p>Membership message history: {row.coverage?.membershipHistory?.error ?? (!row.coverage?.membershipHistory?.started ? "Pending" : row.coverage?.membershipHistory?.complete ? "Complete" : "In progress")}</p>{row.coverage?.oldestEventAt ? <p>Oldest membership event collected: {new Date(row.coverage.oldestEventAt).toLocaleString()}</p> : null}<p>Last sync: {row.coverage?.lastSync ? new Date(row.coverage.lastSync).toLocaleString() : "Pending"}</p></div>
      <div className="mt-2 text-xs">Health: {row.health ? `${row.health.score}/100` : "Not enough data yet"}</div>
    </button>)}
    {!view?.destinations?.length ? <Empty message="No admin groups or channels collected yet. Select a session and discover." /> : null}
    {detail ? <section className={panelClass("space-y-3")}><h2 className="break-words font-semibold">{detail.title}</h2><div className="flex flex-wrap gap-2 text-xs">{["Overview","Growth","Engagement","Join/Leave Events","Content/Post Performance","Health","History"].map((label) => <span key={label} className="border border-border px-2 py-1">{label}</span>)}</div>{detail.health ? <div className="grid grid-cols-2 gap-2 text-sm"><p>Growth {detail.health.growth}/30</p><p>Engagement {detail.health.engagement}/30</p><p>Retention {detail.health.retention}/20</p><p>Activity {detail.health.activity}/20</p></div> : <p className="text-sm text-muted-foreground">Not enough data yet</p>}{["JOINED","LEFT"].map((kind) => <div key={kind} className="space-y-2"><h3 className="text-xs font-semibold">RECENT {kind === "JOINED" ? "JOINS" : "LEAVES"}</h3>{(view.events ?? []).filter((event: any) => event.destination_id === detail.id && event.event_type === kind).map((event: any) => <div key={event.id} className="border border-border p-2 text-xs"><p>{event.display_name || (event.username ? `@${event.username}` : `Telegram ${event.telegram_user_id}`)}</p><p className="text-muted-foreground">Telegram ID: {event.telegram_user_id} · {event.source_type === "ADMIN_LOG" ? "Admin Log" : "Telegram Service Event"}</p>{kind === "LEFT" ? <p className="text-muted-foreground">{String(event.previous_chat_status ?? "UNABLE_TO_VERIFY").replaceAll("_", " ")}</p> : null}<p className="text-muted-foreground">{new Date(event.event_at).toLocaleString()}</p></div>)}</div>)}</section> : null}
  </div>;
}

function productVisual(label: string): ProductIconName | null {
  const key = label.toLowerCase();
  if (key.includes("direct") || key.includes("dm promotion")) return "direct";
  if (key.includes("find users")) return "search-users";
  if (key.includes("find groups") || key.includes("group discovery")) return "search-groups";
  if (key.includes("approved")) return "approved";
  if (key.includes("joined")) return "joined";
  if (key.includes("categor")) return "categories";
  if (key.includes("growth")) return "growth";
  if (key.includes("billing") || key.includes("coin")) return "billing";
  if (key.includes("refer")) return "referral";
  if (key.includes("connected") || key.includes("session")) return "sessions";
  if (key.includes("group")) return "groups";
  if (key.includes("audience") || key.includes("user")) return "audience";
  if (key.includes("campaign") || key.includes("promotion")) return "campaigns";
  return null;
}

function ReferEarn({ data }: any) {
  const [copied, setCopied] = useState(false);
  const share = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent("Join Telegram Promotion")}`;
    openExternalLink(url, true);
  };
  return <div className="min-w-0 space-y-3 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section className={panelClass("space-y-3 border-l-2 border-l-primary")}><p className="text-sm font-semibold">My Referral Link</p><p className="break-all bg-background p-3 text-xs">{data?.link}</p><div className="grid grid-cols-2 gap-2"><Button onClick={async () => setCopied(await copyText(data.link))}>{copied ? "COPIED" : "COPY"}</Button><Button variant="secondary" onClick={share}>SHARE</Button></div><p className="text-xs text-muted-foreground">Direct referrals only. A reward is issued after the referred customer’s first verified paid purchase.</p></section>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(data?.summary ?? {}).map(([key,value]) => <section key={key} className={panelClass("min-w-0 p-3")}><p className="break-words text-[11px] capitalize text-muted-foreground">{key.replace(/([A-Z])/g," $1")}</p><p className="text-xl font-semibold">{String(value)}</p></section>)}</div>
    <section className={panelClass("grid grid-cols-2 gap-3 text-center")}><div><p className="text-xs text-muted-foreground">Coin Balance</p><p className="text-2xl font-semibold">{data?.wallet?.balance ?? 0}</p></div><div><p className="text-xs text-muted-foreground">USDT Value</p><p className="text-2xl font-semibold">{Number(data?.usdtValue ?? 0).toFixed(2)}</p></div><p className="col-span-2 text-xs text-muted-foreground">100 Coins = 1 USDT platform credit. No withdrawal.</p></section>
    <section className={panelClass("space-y-2")}><h2 className="font-semibold">Direct Referrals</h2>{(data?.referrals ?? []).map((row: any) => <div key={row.id} className="min-w-0 border border-border p-2 text-xs"><div className="flex justify-between gap-2"><p className="min-w-0 truncate">{row.telegram_username ? `@${row.telegram_username}` : row.telegram_user_id ?? "Registered customer"}</p><span className="font-semibold text-primary">{row.status}</span></div><p className="text-muted-foreground">{new Date(row.registered_at ?? row.clicked_at).toLocaleString()}</p></div>)}{!data?.referrals?.length ? <Empty message="No direct referrals yet." /> : null}</section>
    <section className={panelClass("space-y-2")}><h2 className="font-semibold">Coin Ledger</h2>{(data?.ledger ?? []).map((row: any) => <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border py-2 text-xs"><div className="min-w-0"><p className="break-words font-medium">{row.entry_type}</p><p className="break-words text-muted-foreground">{row.reason}</p></div><p className={row.delta > 0 ? "text-success" : "text-destructive"}>{row.delta > 0 ? "+" : ""}{row.delta} · {row.balance_after}</p></div>)}</section>
  </div>;
}

function Analytics({ data }: { data: any }) {
  const totals = data?.totals ?? {};
  const campaignOverview = data?.campaignOverview ?? {};
  const campaignStatus = data?.campaignStatus ?? {};
  const dm = data?.dmPromotion ?? {};
  const group = data?.groupPromotion ?? {};
  const users = data?.users ?? {};
  const groups = data?.groups ?? {};
  return (
    <div className="space-y-4">
      <section className={panelClass("flex min-w-0 items-center justify-between gap-3 bg-gradient-to-r from-primary/10 to-card") }>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Reporting overview</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Campaign, audience, and delivery metrics from existing production data.</p>
        </div>
        <a href="/mini-app/growth-intelligence" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-accent">
          Growth <ArrowRight className="size-3.5" />
        </a>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total Users", totals.totalUsers],
          ["Total Groups", totals.totalGroups],
          ["Approved Groups", totals.approvedGroups],
          ["Writable Groups", totals.writableGroups],
          ["Total Campaigns", totals.totalCampaigns],
          ["Messages Sent", totals.messagesSent],
          ["Failed", totals.failed],
          ["Pending", totals.pending],
        ].map(([label, value]) => (
          <Stat key={String(label)} label={label as string} value={Number(value ?? 0)} />
        ))}
      </div>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">Campaign Overview</p>
        <CampaignDonut
          stats={{
            total: campaignOverview.total_messages ?? 0,
            sent: campaignOverview.sent_messages ?? 0,
            pending: campaignOverview.pending_messages ?? 0,
            failed: campaignOverview.failed_messages ?? 0,
          }}
        />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsSection
          title="DM Promotion"
          donutStats={{
            total: Number(dm.messagesSent ?? 0) + Number(dm.pending ?? 0) + Number(dm.failed ?? 0),
            sent: dm.messagesSent,
            pending: dm.pending,
            failed: dm.failed,
          }}
          stats={[
            ["Total DM Campaigns", dm.totalCampaigns],
            ["Active", dm.active],
            ["Completed", dm.completed],
            ["Messages Sent", dm.messagesSent],
            ["Failed", dm.failed],
            ["Pending", dm.pending],
            ["Success Rate", `${dm.successRate ?? 0}%`],
          ]}
          bars={[
            ["Sent", dm.messagesSent, "bg-success"],
            ["Pending", dm.pending, "bg-warning"],
            ["Failed", dm.failed, "bg-destructive"],
          ]}
        />
        <AnalyticsSection
          title="Group Promotion"
          donutStats={{
            total: Number(group.messagesSent ?? 0) + Number(group.pending ?? 0) + Number(group.failed ?? 0),
            sent: group.messagesSent,
            pending: group.pending,
            failed: group.failed,
          }}
          stats={[
            ["Total Group Campaigns", group.totalCampaigns],
            ["Active", group.active],
            ["Completed", group.completed],
            ["Messages Sent", group.messagesSent],
            ["Failed", group.failed],
            ["Pending", group.pending],
            ["Success Rate", `${group.successRate ?? 0}%`],
          ]}
          bars={[
            ["Sent", group.messagesSent, "bg-success"],
            ["Pending", group.pending, "bg-warning"],
            ["Failed", group.failed, "bg-destructive"],
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsSection
          title="Users"
          stats={[
            ["Total discovered", users.totalDiscovered],
            ["Eligible", users.eligible],
            ["Active <30 days", users.active30],
            ["Active Posters", users.activePosters],
            ["Inactive", users.inactive],
            ["Unknown Presence", users.unknownPresence],
          ]}
          bars={[
            ["Eligible", users.eligible, "bg-success"],
            ["Active", users.active30, "bg-primary"],
            ["Unknown", users.unknownPresence, "bg-muted-foreground"],
            ["Inactive", users.inactive, "bg-destructive"],
          ]}
        />
        <AnalyticsSection
          title="Groups"
          stats={[
            ["Discovered", groups.discovered],
            ["Approved", groups.approved],
            ["Writable", groups.writable],
            ["Sendable", groups.sendable],
            ["Not Writable", groups.notWritable],
            ["Joined", groups.joined],
          ]}
          bars={[
            ["Approved", groups.approved, "bg-primary"],
            ["Writable", groups.writable, "bg-success"],
            ["Sendable", groups.sendable, "bg-primary"],
            ["Not Writable", groups.notWritable, "bg-destructive"],
            ["Joined", groups.joined, "bg-warning"],
          ]}
        />
      </div>
      <AnalyticsSection
        title="Campaigns"
        stats={[
          ["Active", campaignStatus.active],
          ["Paused", campaignStatus.paused],
          ["Completed", campaignStatus.completed],
        ]}
        bars={[
          ["Active", campaignStatus.active, "bg-success"],
          ["Paused", campaignStatus.paused, "bg-warning"],
          ["Completed", campaignStatus.completed, "bg-primary"],
        ]}
      />
    </div>
  );
}

function AnalyticsSection({
  title,
  stats,
  bars,
  donutStats,
}: {
  title: string;
  stats: [string, number | string | undefined][];
  bars: [string, number | undefined, string][];
  donutStats?: { total: number; sent: number; pending: number; failed: number };
}) {
  const max = Math.max(1, ...bars.map(([, value]) => Number(value ?? 0)));
  return (
    <section className={panelClass("space-y-3")}>
      <p className="font-semibold">{title}</p>
      {donutStats ? <CampaignDonut stats={donutStats} /> : null}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {stats.map(([label, value]) => (
          <Stat key={label} label={label} value={value ?? 0} />
        ))}
      </div>
      <div className="space-y-2">
        {bars.map(([label, value, color]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{label}</span>
              <span>{Number(value ?? 0)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${color}`} style={{ width: `${(Number(value ?? 0) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Billing({ auth, data, actions, setNotice, actionBusy, runAction, reload, appLanguage }: any) {
  const language = appLanguage ?? localStorage.getItem("wpay-language") ?? "en";
  const usage = data?.usage ?? {};
  const currentPlan = usage.plan ?? data?.tenant?.plans ?? data?.subscription?.plans ?? {};
  const currentCode = currentPlan?.code ?? "";
  const [invoice, setInvoice] = useState<any>(data?.activeInvoice ?? null);
  const [coinAmount, setCoinAmount] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => setInvoice(data?.activeInvoice ?? null), [data?.activeInvoice?.id, data?.activeInvoice?.status]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!invoice?.id || ["PAID", "EXPIRED", "CANCELLED", "UNDERPAID", "OVERPAID", "LATE_PAYMENT", "REVIEW_REQUIRED"].includes(String(invoice.status))) return;
    const timer = window.setInterval(() => {
      void getInvoiceStatus({ data: { auth, invoiceId: invoice.id } })
        .then((next: any) => {
          setInvoice(next);
          if (next?.status === "PAID") {
            setNotice("Payment confirmed. Your product is active.");
            void reload();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [invoice?.id, invoice?.status, auth]);
  const usageRows = [
    ["Sessions", usage.counts?.sessions ?? 0, usage.limits?.max_connections ?? null],
    ["Campaigns", usage.counts?.active_campaigns ?? 0, usage.limits?.max_active_campaigns ?? null],
    ["Groups", usage.counts?.saved_groups ?? 0, usage.limits?.max_saved_groups ?? null],
    ["Groups Found", usage.counts?.groups_found ?? 0, usage.limits?.monthly_groups_found_limit ?? null],
    ["Users Found", usage.counts?.audience_found ?? 0, usage.limits?.monthly_audience_found_limit ?? null],
    ["Messages", usage.counts?.promotion_messages ?? 0, usage.limits?.monthly_message_limit ?? null],
    ["DM", usage.counts?.dm_messages ?? 0, usage.limits?.monthly_dm_message_limit ?? null],
    ["Categories", usage.counts?.categories ?? 0, usage.limits?.max_categories ?? null],
  ];
  const paymentsEnabled = Boolean(data?.payments?.enabled);
  const invoiceCountdown = invoice?.expires_at ? Math.max(0, Math.floor((new Date(invoice.expires_at).getTime() - now) / 1000)) : 0;
  const countdownText = `${String(Math.floor(invoiceCountdown / 60)).padStart(2, "0")}:${String(invoiceCountdown % 60).padStart(2, "0")}`;
  const exactAmount = formatUsdtAmount(invoice?.payable_amount);
  async function createOrReplaceInvoice(productLabel: string, create: (replace?: boolean) => Promise<any>) {
    try {
      const next = await create(false);
      setInvoice(next);
      setNotice("Payment invoice created.");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create invoice.";
      if (message.includes("You already have an active") && confirm(`${message}\n\nCancel keeps the current invoice. OK replaces it.`)) {
        const next = await create(true);
        setInvoice(next);
        setNotice(`${productLabel} invoice created.`);
        await reload();
        return;
      }
      throw error;
    }
  }
  const requestPlan = async (plan: any) => {
    const price = Number(plan.price_usd ?? 0);
    if (price > 0 && !paymentsEnabled) {
      setNotice("Online payments are not available yet. Contact support to activate this plan.");
      return;
    }
    await runAction(`billing-${plan.id}`, async () => {
      await createOrReplaceInvoice(plan.name, (replace) => requestPayment({ data: { auth, planId: plan.id, replace } }));
    });
  };
  const requestPremiumEmoji = async () => {
    if (!paymentsEnabled) {
      setNotice("Online payments are not available yet. Contact support to activate this add-on.");
      return;
    }
    await runAction("billing-premium-emoji", async () => {
      await createOrReplaceInvoice("Premium Emoji", (replace) => requestPremiumEmojiPayment({ data: { auth, replace } }));
    });
  };
  const requestAddUsersCredits = async () => {
    if (!paymentsEnabled) {
      setNotice("Online payments are not available yet. Contact support to activate this add-on.");
      return;
    }
    await runAction("billing-add-users-credits", async () => {
      await createOrReplaceInvoice("Add Users Credits", (replace) => actions.requestAddUsersCreditsPayment({ data: { auth, replace } }));
    });
  };
  const history = [...(data?.invoices ?? []), ...(data?.transactions ?? []).filter((t: any) => !t.invoice_id)];
  const addUsersCredits = data?.addons?.addUsersCredits?.balance ?? {};
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_15%,var(--card)),color-mix(in_oklch,var(--chart-5)_8%,var(--card)))] p-4 shadow-[0_14px_36px_-25px_color-mix(in_oklch,var(--primary)_45%,transparent)]">
        <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5"><ProductIcon name="billing" className="size-9 shrink-0 drop-shadow-sm" /><div><p className="text-[11px] font-semibold text-primary">Current Plan</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{currentPlan?.name ?? "TEST"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-lg font-bold text-foreground">${Number(currentPlan?.price_usd ?? 0)}</span> / month
            </p>
            </div></div>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage.expired ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
              {usage.expired ? "TEST limits" : "Active"}
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              Renews: {data?.tenant?.plan_expires_at ? new Date(data.tenant.plan_expires_at).toLocaleDateString() : "No expiry"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {usageRows.map(([label, used, limit]) => (
            <MiniUsageBar key={String(label)} label={String(label)} used={Number(used ?? 0)} limit={limit as number | null} />
          ))}
        </div>
      </section>
      {!paymentsEnabled && (data?.plans ?? []).some((plan: any) => Number(plan.price_usd ?? 0) > 0) ? (
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          Online payments are not available yet. Contact support to activate paid plans.
        </div>
      ) : null}
      {invoice ? (
        <section className="rounded-xl border border-success/25 bg-card p-3 shadow-[0_10px_28px_-24px_color-mix(in_oklch,var(--success)_45%,transparent)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-success">Active Invoice</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{invoice.product_code === "PREMIUM_EMOJI" ? "Premium Emoji" : invoice.product_code === "ADD_USERS_CREDITS" ? "Add Users Credits" : invoice.product_code}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Invoice ID: {invoice.invoice_number ?? invoice.id}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(invoice.status)}`}>{invoice.status}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[128px_1fr]">
            <img
              className="size-32 rounded-md bg-white p-2"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(invoice.qr_payload ?? invoice.receiving_address ?? "")}`}
              alt="USDT TRC20 payment QR"
            />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">USDT TRC20</p>
              <p className="text-muted-foreground">Exact Payable Amount</p>
              <p className="break-all text-xl font-semibold text-success">{exactAmount} USDT</p>
              <p className="text-muted-foreground">Receiving Address</p>
              <p className="break-all rounded-lg border border-border bg-muted/35 p-2 font-mono text-xs text-foreground">{invoice.receiving_address}</p>
              <p className="text-muted-foreground">Countdown: <span className="font-semibold text-foreground">{invoice.status === "EXPIRED" ? "Expired" : countdownText}</span></p>
              <p className="text-muted-foreground">Status: {invoice.status === "PENDING" ? "Waiting for payment..." : invoice.status}</p>
              {invoice.status === "PENDING" && !invoice.coin_discount ? <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3"><p className="text-xs text-primary">Coin Balance: {data?.coins?.balance ?? 0} · 100 Coins = 1 USDT</p><div className="flex min-w-0 flex-wrap gap-2"><input className={inputClass("min-w-0 flex-1")} inputMode="numeric" value={coinAmount} onChange={(event) => setCoinAmount(event.target.value.replace(/\D/g, ""))} placeholder="Coins to use"/><Button size="sm" disabled={!coinAmount || actionBusy === `use-coins-${invoice.id}`} onClick={() => void runAction(`use-coins-${invoice.id}`, async () => { const next = await actions.useCoinsForInvoice({ data: { auth, invoiceId: invoice.id, coins: Number(coinAmount) } }); setInvoice(next); setNotice("Coins applied as platform credit."); await reload(); })}>USE COINS</Button></div></div> : null}
              {Number(invoice.coin_discount ?? 0) > 0 ? <p className="text-xs text-primary">Platform credit applied: {invoice.coin_discount} Coins = {(Number(invoice.coin_discount) / 100).toFixed(2)} USDT</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => void copyText(String(invoice.receiving_address ?? "")).then((ok) => setNotice(ok ? miniT(language, "Address copied") : miniT(language, "Copy failed")))}
                >
                  <Copy className="mr-2 size-4" />
                  COPY ADDRESS
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void copyText(exactAmount).then((ok) => setNotice(ok ? miniT(language, "Amount copied") : miniT(language, "Copy failed")))}
                >
                  <Copy className="mr-2 size-4" />
                  COPY AMOUNT
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={() => openExternalLink(invoice.tronlink_url)}>OPEN TRONLINK</Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  disabled={actionBusy === `check-invoice-${invoice.id}`}
                  onClick={() => void runAction(`check-invoice-${invoice.id}`, async () => {
                    const next = await checkInvoicePaymentStatus({ data: { auth, invoiceId: invoice.id } }) as any;
                    setInvoice(next);
                    setNotice(next?.status === "PAID" ? miniT(language, "Payment confirmed. Your product is active.") : miniT(language, "Payment not found yet."));
                    await reload();
                  })}
                >
                  {actionBusy === `check-invoice-${invoice.id}` ? "Checking..." : "CHECK PAYMENT STATUS"}
                </Button>
                {invoice.tx_hash ? (
                  <Button size="sm" type="button" variant="secondary" onClick={() => openExternalLink(invoice.tronscan_url)}>
                    VIEW ON TRONSCAN
                  </Button>
                ) : invoice.receiving_address ? (
                  <Button size="sm" type="button" variant="secondary" onClick={() => openExternalLink(`https://tronscan.org/#/address/${encodeURIComponent(invoice.receiving_address)}`)}>
                    VIEW RECEIVING ADDRESS ON TRONSCAN
                  </Button>
                ) : null}
              </div>
              {invoice.status === "EXPIRED" ? (
                <Button size="sm" type="button" onClick={() => setInvoice(null)}>CREATE NEW INVOICE</Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      <section className={panelClass("space-y-3")}>
        <div>
          <p className="text-xs font-semibold uppercase text-primary">ADD USERS CREDITS</p>
          <h2 className="mt-1 text-lg font-semibold">Add Users Credits</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Current balance" value={addUsersCredits.purchased_balance ?? 0} />
          <Stat label="Free trial remaining" value={addUsersCredits.free_trial_remaining ?? 5} />
          <Stat label="Successful additions" value={addUsersCredits.successful_additions ?? 0} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-3">
          <div>
            <p className="font-semibold">1,000 adds</p>
            <p className="text-sm text-muted-foreground">$5 USDT</p>
          </div>
          <Button disabled={actionBusy === "billing-add-users-credits"} onClick={() => void requestAddUsersCredits()}>
            {actionBusy === "billing-add-users-credits" ? "Creating..." : "BUY / TOP UP"}
          </Button>
        </div>
      </section>
      <section className={panelClass("space-y-3")}>
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Add-ons</p>
          <h2 className="mt-1 text-lg font-semibold">Premium Emoji</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Unlock Telegram Promotion custom emoji composer capability. This does not buy Telegram Premium for your linked account.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">$20 / 30 days</p>
            <p className={data?.addons?.premiumEmoji?.active ? "text-sm text-success" : "text-sm text-muted-foreground"}>
              {data?.addons?.premiumEmoji?.active
                ? `Active until ${data.addons.premiumEmoji.entitlement?.expires_at ? new Date(data.addons.premiumEmoji.entitlement.expires_at).toLocaleDateString() : "No expiry"}`
                : "Inactive"}
            </p>
          </div>
          <Button disabled={data?.addons?.premiumEmoji?.active || actionBusy === "billing-premium-emoji"} onClick={() => void requestPremiumEmoji()}>
            {data?.addons?.premiumEmoji?.active ? "ACTIVE" : "BUY ADD-ON"}
          </Button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {(data?.plans ?? []).map((plan: any) => {
          const isCurrent = String(plan.code) === String(currentCode);
          const accent = planAccent(plan.code);
          return (
            <article key={plan.id} className={`rounded-xl border ${accent.border} bg-card p-3 shadow-sm`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-foreground">{plan.name}</p>
                    {String(plan.code).toUpperCase() === "PRO" ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">Popular</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description || planDescription(plan.code)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">${Number(plan.price_usd ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">/ month</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {planFeatures(plan).map(({ label, value, Icon }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
                    <div className={`flex items-center gap-1.5 text-[11px] ${accent.text}`}>
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <Button
                className={`mt-4 w-full ${!isCurrent ? accent.button : ""}`}
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent || actionBusy === `billing-${plan.id}`}
                onClick={() => void requestPlan(plan)}
              >
                {isCurrent ? "CURRENT PLAN" : Number(plan.price_usd ?? 0) > 0 ? "UPGRADE" : "SELECT PLAN"}
              </Button>
            </article>
          );
        })}
      </section>
      <section className={panelClass("space-y-2")}>
        <p className="font-semibold">Payment History</p>
      {history.map((t: any) => (
        <article key={t.id} className={panelClass()}>
          <p className="font-medium">
            {t.product_code ?? t.plans?.name ?? t.plan_id ?? "Payment"} - {formatUsdtAmount(t.payable_amount ?? t.invoice_payable_amount ?? t.amount)} {t.currency ?? "USDT"}
          </p>
          <p className={`mt-1 text-xs font-semibold ${statusTone(t.status)}`}>{t.status}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleString() : ""}</p>
          {t.tx_hash ? <a className="text-xs text-primary hover:underline" href={`https://tronscan.org/#/transaction/${encodeURIComponent(t.tx_hash)}`} target="_blank" rel="noreferrer">TronScan</a> : null}
        </article>
      ))}
      {!history.length ? <p className="text-sm text-muted-foreground">No payments yet.</p> : null}
      </section>
    </div>
  );
}

function limitLabel(value: unknown) {
  return value === null || value === undefined ? "Unlimited" : Number(value).toLocaleString();
}

function MiniUsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const rawPct = limit == null ? 0 : Math.round((used / Math.max(limit, 1)) * 100);
  const pct = Math.min(100, rawPct);
  const over = limit != null && used > limit;
  const tone = over || pct >= 90 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-foreground/80">{label}</span>
        <span className={over ? "font-semibold text-destructive" : "text-muted-foreground"}>{used.toLocaleString()} / {limitLabel(limit)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${limit == null ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

function planAccent(code: string) {
  const key = String(code).toUpperCase();
  if (key === "PRO") return { border: "border-primary/50 ring-1 ring-primary/15", text: "text-primary", button: "" };
  if (key === "PLUS" || key === "ENTERPRISE") return { border: "border-primary/25", text: "text-primary", button: "" };
  return { border: "border-border", text: "text-muted-foreground", button: "" };
}

function planDescription(code: string) {
  const key = String(code).toUpperCase();
  if (key === "TEST") return "Product testing with tight limits.";
  if (key === "PLUS") return "Core growth plan for regular use.";
  if (key === "PRO") return "Higher volume promotion operations.";
  if (key === "ENTERPRISE") return "Unlimited quotas with a 20-session maximum.";
  return "Custom platform plan.";
}

function planFeatures(plan: any) {
  return [
    { label: "Sessions", value: `${limitLabel(plan.max_connections)}${String(plan.code).toUpperCase() === "ENTERPRISE" ? " max" : ""}`, Icon: ShieldCheck },
    { label: "Campaigns", value: limitLabel(plan.max_active_campaigns), Icon: Megaphone },
    { label: "Saved Groups", value: limitLabel(plan.max_saved_groups), Icon: FolderOpen },
    { label: "Groups Found", value: limitLabel(plan.monthly_groups_found_limit), Icon: Search },
    { label: "Users Found", value: limitLabel(plan.monthly_audience_found_limit), Icon: Users },
    { label: "Messages", value: limitLabel(plan.monthly_message_limit), Icon: Send },
    { label: "DM", value: limitLabel(plan.monthly_dm_message_limit), Icon: UserCircle },
    { label: "Categories", value: limitLabel(plan.max_categories), Icon: CreditCard },
    { label: "Analytics", value: String(plan.analytics_level ?? "basic") === "full" ? "Full" : "Basic", Icon: BarChart3 },
    { label: "Scheduling", value: plan.scheduling_enabled ? "Enabled" : "Disabled", Icon: CalendarDays },
    { label: "Session Health", value: String(plan.session_health_level ?? "basic") === "full" ? "Full" : "Basic", Icon: Gauge },
    { label: "Checks", value: `${limitLabel(plan.monthly_writable_check_limit)} / ${limitLabel(plan.monthly_sendable_check_limit)}`, Icon: Sparkles },
  ];
}

function SettingsPanel({ auth, data, actions, setNotice, actionBusy, runAction, appLanguage, setAppLanguage }: any) {
  const profile = data?.profile ?? {};
  const support = data?.support ?? {};
  const [name, setName] = useState(profile.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const prefs = data?.preferences ?? { language: "en", theme: "system" };
  const [theme, setTheme] = useState(prefs.theme ?? "system");
  const language = normalizeMiniLanguage(appLanguage ?? prefs.language ?? "en");
  const t = (text: string) => miniT(appLanguage ?? language, text);
  useEffect(() => {
    setTheme(prefs.theme ?? "system");
  }, [prefs.theme]);
  return (
    <div className="settings-control-center space-y-5">
      <HubSection title="Telegram" description="Connected accounts and operational session health." items={[
        { href: "/mini-app/sessions", label: "Connected Accounts", body: "Manage sessions, reconnect state, and Premium status.", icon: Bot },
      ]} />
      <HubSection title="Product & billing" description="Manage plan value, payments, Coins, and rewards." items={[
        { href: "/mini-app/billing", label: "Billing & Coins", body: "Plans, invoices, add-ons, and Coin redemption.", icon: CreditCard },
        { href: "/mini-app/refer-earn", label: "Refer & Earn", body: "Share your link and track direct referral rewards.", icon: Users },
      ]} />
      <div>
        <h2 className="text-sm font-semibold">Account & preferences</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Profile, appearance, language, security, notifications, and support.</p>
      </div>
      <section className={panelClass("space-y-3")}>
        <Settings className="size-5 text-primary" />
        <p className="mt-3 font-semibold">{t("Account Settings")}</p>
        <div className="text-sm text-muted-foreground">
          <p>{profile.name ?? "User001"}</p>
          <p>{profile.email}</p>
          <p>{profile.status ?? "ACTIVE"}</p>
        </div>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Appearance")}</p>
        <select className={inputClass()} value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="light">{t("Light")}</option>
          <option value="dark">{t("Dark")}</option>
          <option value="system">{t("System")}</option>
        </select>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Language")}</p>
        <select
          className={inputClass()}
          value={language}
          onChange={(e) => {
            const nextLanguage = normalizeMiniLanguage(e.target.value);
            setAppLanguage?.(nextLanguage, "settings-select", true);
            void runAction("save-language", async () => {
              await actions.saveCustomerPreferenceSettings({ data: { auth, language: nextLanguage } });
              setNotice(miniT(nextLanguage, "Settings saved."));
            });
          }}
        >
          <option value="en">{MINI_LANGUAGE_LABELS.en}</option>
          <option value="zh-CN">{MINI_LANGUAGE_LABELS["zh-CN"]}</option>
          <option value="ru">{MINI_LANGUAGE_LABELS.ru}</option>
          <option value="fa">{MINI_LANGUAGE_LABELS.fa}</option>
        </select>
        <Button
          type="button"
          disabled={actionBusy === "save-preferences"}
          onClick={() =>
            runAction("save-preferences", async () => {
              await actions.saveCustomerPreferenceSettings({ data: { auth, theme } });
              applyThemePreference(theme);
              setNotice(miniT(language, "Settings saved."));
            })
          }
        >
          {actionBusy === "save-preferences" ? "Saving..." : t("SAVE PREFERENCES")}
        </Button>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Edit Name")}</p>
        <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          type="button"
          disabled={!name || actionBusy === "update-name"}
          onClick={() =>
            runAction("update-name", async () => {
              await actions.updateAccountName({ data: { auth, name } });
              setNotice(t("Name updated."));
            })
          }
        >
          {actionBusy === "update-name" ? "Saving..." : t("SAVE NAME")}
        </Button>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">{t("Change Password")}</p>
        <input
          className={inputClass()}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t("Current password")}
        />
        <input
          className={inputClass()}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t("New password")}
        />
        <Button
          type="button"
          disabled={!currentPassword || !newPassword || actionBusy === "change-password"}
          onClick={() =>
            runAction("change-password", async () => {
              await actions.changeAccountPassword({ data: { auth, currentPassword, newPassword } });
              setCurrentPassword("");
              setNewPassword("");
              setNotice(t("Password changed."));
            })
          }
        >
          {actionBusy === "change-password" ? "Saving..." : t("Change Password")}
        </Button>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">Notifications</p>
        <p className="text-sm text-muted-foreground">In-app notifications stay enabled for billing, campaign and account events.</p>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">Billing</p>
        <p className="text-sm text-muted-foreground">Manage plan, invoices and Premium Emoji from Billing.</p>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">Support</p>
        <p className="text-sm text-muted-foreground">Contact platform support from Telegram if you need account or payment review.</p>
        {support.telegramUrl ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const telegram = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
              if (telegram?.openTelegramLink) telegram.openTelegramLink(support.telegramUrl);
              else window.open(support.telegramUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <Send className="mr-2 size-4" />
            OPEN @{support.telegramUsername}
          </Button>
        ) : (
          <p className="text-sm text-warning">Telegram support is not configured.</p>
        )}
      </section>
      <section className={panelClass("space-y-3")}>
        <Button
          type="button"
          variant="secondary"
          disabled={actionBusy === "logout"}
          onClick={() =>
            runAction("logout", async () => {
              await actions.logout({ data: { auth } });
              sessionStorage.removeItem("customer-session");
              window.location.href = "/mini-app/dashboard";
            })
          }
        >
          <LogOut className="mr-2 size-4" />
          {actionBusy === "logout" ? "Signing out..." : "LOGOUT"}
        </Button>
      </section>
      <section className={panelClass("space-y-3")}>
        <p className="font-semibold">History / Logs</p>
        {(data?.logs ?? []).map((log: any) => (
          <div key={log.id} className="border-t border-border pt-3 text-xs">
            <p className="font-semibold">{log.action}</p>
            <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
          </div>
        ))}
        {!data?.logs?.length ? (
          <p className="text-sm text-muted-foreground">No activity logs yet.</p>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <section className={panelClass()}>
      <p className="text-xs capitalize text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? 0}</p>
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-9 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground"><Bot className="size-5" /></span>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading workspace">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
