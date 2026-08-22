/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
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
import { TgsPlayer } from "@/components/tgs-player";
import { Button } from "@/components/ui/button";
import {
  addConnection,
  addApprovedGroupByUsername,
  addGroupByUsername,
  addKeyword,
  approveGroup,
  checkConnection,
  controlCampaign,
  createCampaign,
  deleteCampaign,
  deleteGroupCategory,
  discoverAudience,
  disconnectConnection,
  findAudience,
  getAudienceDiscoveryState,
  getAnalytics,
  getAccountProfile,
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
  getNotifications,
  getOwnActivity,
  rejectGroup,
  reconnectConnection,
  removeKeyword,
  removeConnection,
  removeGroup,
  getInvoiceStatus,
  checkInvoicePaymentStatus,
  requestPayment,
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
  startAudienceDiscovery,
  startBulkJoin,
  startGroupDiscovery,
  startConnectionLogin,
  updateCampaign,
  updateAccountName,
  changeAccountPassword,
  verifyConnectionCode,
  verifyConnectionPassword,
  testWritableGroups,
  verifyWritableGroups,
} from "@/lib/customer.functions";
import { applyThemePreference } from "@/lib/theme";
import { MINI_LANGUAGE_LABELS, applyMiniAppTranslations, miniT, normalizeMiniLanguage } from "@/lib/mini-i18n";

const valid = new Set([
  "dashboard",
  "sessions",
  "groups-find",
  "groups-found",
  "groups-approved",
  "groups-joined",
  "group-categories",
  "dm-audience",
  "dm-create",
  "dm-history",
  "campaigns",
  "group-create",
  "group-history",
  "analytics",
  "billing",
  "settings",
]);

const titles: Record<string, string> = {
  dashboard: "Home",
  sessions: "Sessions",
  "groups-find": "Find Groups",
  "groups-found": "Found Groups",
  "groups-approved": "Approved Groups",
  "groups-joined": "Joined Groups",
  "group-categories": "Group Categories",
  "dm-audience": "DM Audience",
  "dm-create": "DM Promotion",
  "dm-history": "DM History",
  campaigns: "Campaigns",
  "group-create": "Group Promotion",
  "group-history": "Group History",
  analytics: "Analytics",
  billing: "Billing",
  settings: "Settings",
};

const AUTH_REQUIRED_MESSAGE = "Please login or register in @wpaypromotionbot first.";

export const Route = createFileRoute("/mini-app/$section")({
  head: ({ params }: { params: { section: string } }) => ({
    meta: [
      { title: `${titles[params.section] ?? "Mini App"} | WPAY Mini App` },
      { name: "description", content: "Telegram-native campaign and audience control panel." },
      { property: "og:title", content: "WPAY Telegram Mini App" },
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
  return `w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${extra}`;
}

function panelClass(extra = "") {
  return `border border-border bg-card p-4 ${extra}`;
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

  const actions = {
    addConnection: useServerFn(addConnection),
    startConnectionLogin: useServerFn(startConnectionLogin),
    verifyConnectionCode: useServerFn(verifyConnectionCode),
    verifyConnectionPassword: useServerFn(verifyConnectionPassword),
    checkConnection: useServerFn(checkConnection),
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
    setPreferredPremiumEmojiSession: useServerFn(setPreferredPremiumEmojiSession),
    saveCustomerPreferenceSettings: useServerFn(saveCustomerPreferenceSettings),
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
      sessions: (a) => connectionsFn({ data: { auth: a } }),
      "groups-find": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        keywords: await keywordsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "AUTO_PENDING" } }),
        discovery: await discoveryStateFn({ data: { auth: a } }),
      }),
      "groups-found": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "FOUND" } }),
      }),
      "groups-approved": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
        bulkJoin: await bulkJoinStateFn({ data: { auth: a } }),
      }),
      "groups-joined": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "JOINED" } }),
      }),
      "dm-audience": async (a) => ({
        groups: await groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
        discovery: await audienceDiscoveryFn({ data: { auth: a } }),
      }),
      "dm-create": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        audience: await audienceFn({ data: { auth: a, groupIds: [], onlyNew: true } }),
        campaigns: await campaignsFn({ data: { auth: a, filter: "DM" } }),
        billing: await billingFn({ data: { auth: a } }),
      }),
      "dm-history": (a) => campaignsFn({ data: { auth: a, filter: "DM" } }),
      campaigns: async (a) => ({
        campaigns: await campaignsFn({ data: { auth: a, filter: "ALL" } }),
        connections: await connectionsFn({ data: { auth: a } }),
      }),
      "group-create": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
        categories: await groupCategoriesFn({ data: { auth: a } }),
        campaigns: await campaignsFn({ data: { auth: a, filter: "GROUP" } }),
        billing: await billingFn({ data: { auth: a } }),
      }),
      "group-history": (a) => campaignsFn({ data: { auth: a, filter: "GROUP" } }),
      "group-categories": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
        categories: await groupCategoriesFn({ data: { auth: a } }),
        writability: await groupWritabilitySummaryFn({ data: { auth: a } }),
      }),
      analytics: (a) => analyticsFn({ data: { auth: a } }),
      billing: (a) => billingFn({ data: { auth: a } }),
      settings: async (a) => ({
        logs: await logsFn({ data: { auth: a } }),
        profile: await profileFn({ data: { auth: a } }),
        preferences: await actions.getCustomerPreferences({ data: { auth: a } }),
        support: await actions.getSupportSettings({ data: { auth: a } }),
      }),
    }),
    [],
  );

  async function load(force = false) {
    const targetSection = section;
    const requestLanguageVersion = languageVersionRef.current;
    const nextAuth = await telegramAuthReady();
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
      setBusy(true);
      setLoadedSection("");
      setData(null);
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
    setError("You have signed out. Return to the bot to open a secure session.");
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
    sectionRef.current = section;
    void load(false);
  }, [section]);

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
  const guardedNotice = (origin: string) => (value: string) => {
    if (sectionRef.current === origin) setNotice(value);
  };

  if (error === AUTH_REQUIRED_MESSAGE) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5 text-center text-foreground">
        <p className="max-w-xs text-base font-medium">{AUTH_REQUIRED_MESSAGE}</p>
      </main>
    );
  }

  return (
    <MiniAppShell active={section}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">{miniT(appLanguage, titles[section] ?? section)}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" aria-label="Refresh" onClick={() => load(true)} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            aria-label="Notifications"
            className="relative"
            onClick={() => setShowNotifications(true)}
          >
            <Bell />
            {unread ? (
              <span className="absolute -right-1 -top-1 min-w-5 border border-background bg-primary px-1 text-[10px] text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </Button>
          <Button size="icon" variant="secondary" aria-label="Profile" onClick={() => setShowProfile(true)}>
            <UserCircle />
          </Button>
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
        <p className="py-10 text-center text-muted-foreground">Loading workspace...</p>
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
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{profile?.name ?? "User001"}</p>
              <p className="text-muted-foreground">{profile?.email ?? ""}</p>
              <p className="text-xs uppercase text-primary">{profile?.status ?? "ACTIVE"}</p>
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
  if (section === "sessions") return <Sessions {...props} />;
  if (section === "groups-find") return <GroupFinder {...props} />;
  if (["groups-found", "groups-approved", "groups-joined"].includes(section))
    return <GroupList {...props} />;
  if (section === "group-categories") return <GroupCategories {...props} />;
  if (section === "dm-audience") return <DMAudience {...props} />;
  if (section === "dm-create") return <DMCampaign {...props} />;
  if (section === "campaigns") return <CampaignsPage {...props} />;
  if (section === "dm-history" || section === "group-history")
    return <CampaignHistory {...props} />;
  if (section === "group-create") return <GroupCampaign {...props} />;
  if (section === "analytics") return <Analytics data={props.data} />;
  if (section === "billing") return <Billing {...props} />;
  if (section === "settings") return <SettingsPanel {...props} />;
  return null;
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
      <section className={panelClass("space-y-4")}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 text-xl font-semibold">{data?.subscription?.planName}</p>
          </div>
          <Bell className="size-5 text-primary" />
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {quick.map(([href, label, body, Icon]) => (
          <QuickLink key={String(href)} href={href as string} label={label as string} body={body as string} icon={Icon as any} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <section className={panelClass("min-h-28")}>
      <Icon className="size-4 text-primary" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </section>
  );
}

function QuickLink({ href, label, body, icon: Icon }: { href: string; label: string; body: string; icon: any }) {
  return (
    <a
      className="flex min-h-28 items-start gap-3 border border-border bg-card p-4 text-left transition-colors hover:border-primary"
      href={href}
    >
      <Icon className="mt-1 size-5 text-primary" />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{body}</span>
      </span>
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
            placeholder="USDT, P2P, Gaming"
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
  const [modal, setModal] = useState<"" | "ADD" | "IMPORT">("");
  const [username, setUsername] = useState("");
  const [folderLink, setFolderLink] = useState("");
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
            <Button variant="secondary" onClick={() => setModal("IMPORT")}>
              <FolderOpen className="mr-2 size-4" /> IMPORT GROUPS
            </Button>
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <form
            className={panelClass("w-full max-w-sm space-y-3 shadow-lg")}
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
            <div className="flex items-center justify-between">
              <p className="font-semibold">{modal === "ADD" ? "Add Group" : "Import Groups"}</p>
              <button type="button" onClick={() => setModal("")} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {modal === "ADD" ? (
              <input
                className={inputClass()}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@groupname or https://t.me/groupname"
              />
            ) : (
              <input
                className={inputClass()}
                value={folderLink}
                onChange={(e) => setFolderLink(e.target.value)}
                placeholder="https://t.me/addlist/..."
              />
            )}
            <Button
              className="w-full"
              type="submit"
              disabled={
                (modal === "ADD" ? !username : !folderLink) ||
                actionBusy === "add-approved-group" ||
                actionBusy === "import-groups"
              }
            >
              {actionBusy === "add-approved-group" || actionBusy === "import-groups"
                ? "Saving..."
                : modal === "ADD"
                  ? "ADD GROUP"
                  : "IMPORT"}
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
            <Button className="w-full" type="submit" disabled={!name || !selected.length || categorySaveBusy}>
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
          <Stat label="Selected Groups" value={selectedCount} />
          <Stat label="Processed" value={processed} />
          <Stat label="Remaining" value={Math.max(selectedCount - processed, 0)} />
          <Stat label="Users Found" value={audience.totalFound ?? 0} />
          <Stat label="New Users" value={state.new_users ?? 0} />
          <Stat label="With Username" value={audience.withUsername ?? 0} />
          <Stat label="Excluded Inactive" value={audience.excludedInactive ?? 0} />
          <Stat label="Active Posters" value={audience.activePosters ?? 0} />
          <Stat label="Previously Saved" value={state.previously_saved ?? 0} />
        </div>
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
      <section className={panelClass("flex flex-wrap gap-2")}>
        {["ALL", "GROUP", "DM", "ACTIVE", "PAUSED", "COMPLETED"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
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

function DMCampaign({ auth, data, actions, reload, setNotice, actionBusy, runAction }: any) {
  const [createMode, setCreateMode] = useState(false);
  const audience = data?.audience ?? null;
  const [selected, setSelected] = useState<string[]>([]);
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
      <Preview
        message={message}
        mediaUrl={mediaUrl}
        buttonText={buttonText}
        buttonUrl={buttonUrl}
      />
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
      <Preview
        message={message}
        mediaUrl={mediaUrl}
        buttonText={buttonText}
        buttonUrl={buttonUrl}
      />
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
            className="flex w-full items-center justify-between border border-border bg-background p-3 text-left text-sm"
          >
            <span>
              {index + 1}. {u.username ? `@${u.username}` : (u.display_name ?? u.telegram_user_id)}
              <span className="mt-1 block text-xs text-muted-foreground">
                Presence: {presenceLabel(u.presence_status)}
                {" | "}Source: {sourceGroupLabel(u)}
                {u.recent_activity_at ? ` | Recent group activity ${new Date(u.recent_activity_at).toLocaleDateString()}` : ""}
                {` | Messages observed ${u.messages_observed ?? 0}`}
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  function utf16Length(value: string) {
    return [...value].reduce((sum, char) => sum + (char.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  }
  async function loadEmojiCatalog(nextTab = pickerTab) {
    setEmojiLoading(true);
    setEmojiError("");
    setEmojiVisibleCount(emojiPageSize);
    try {
      const result = await props.actions.getCustomEmojiCatalog({
        data: { auth: props.auth, connectionId: props.connectionId || null, query: nextTab === "search" ? emojiSearch : "" },
      });
      const hydrated = await hydrateEmojiPreviews(result, nextTab, emojiPageSize);
      setEmojiCatalog(hydrated);
    } catch (error) {
      setEmojiError(error instanceof Error ? error.message : "Custom emoji could not be loaded.");
    } finally {
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
  async function hydrateEmojiPreviews(result: any, nextTab: string, limit = emojiPageSize) {
    if (!result || nextTab === "categories") return result;
    const items = (result[nextTab] ?? []).slice(0, limit).filter((item: any) => !item.preview_url && !item.preview_unavailable);
    const previews = await Promise.all(items.map(async (item: any) => {
      try {
        const preview = await props.actions.getCustomEmojiPreview({
          data: { auth: props.auth, connectionId: props.connectionId || null, documentId: String(item.document_id) },
        });
        console.info("CUSTOM_EMOJI_PREVIEW_RESULT", {
          document_id: String(item.document_id),
          mime_type: preview?.mime_type,
          preview_format: preview?.format,
          has_data_url: Boolean(preview?.data_url),
        });
        return preview;
      } catch {
        console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", { document_id: String(item.document_id), stage: "client_hydrate" });
        return null;
      }
    }));
    return items.reduce((catalog: any, item: any, index: number) => {
      const preview = previews[index];
      return mergePreview(catalog, nextTab, String(item.document_id), preview);
    }, result);
  }
  async function loadMoreEmoji() {
    if (emojiLoading || pickerTab === "categories" || !emojiCatalog) return;
    const total = (emojiCatalog[pickerTab] ?? []).length;
    if (emojiVisibleCount >= total) return;
    const nextCount = Math.min(total, emojiVisibleCount + emojiPageSize);
    setEmojiVisibleCount(nextCount);
    setEmojiLoading(true);
    try {
      setEmojiCatalog(await hydrateEmojiPreviews(emojiCatalog, pickerTab, nextCount));
    } finally {
      setEmojiLoading(false);
    }
  }
  function insertCustomEmoji(item: any) {
    const fallback = item.fallback || "⭐";
    const node = textareaRef.current;
    const current = props.message ?? "";
    const start = node ? node.selectionStart : current.length;
    const end = node ? node.selectionEnd : current.length;
    const nextText = `${current.slice(0, start)}${fallback}${current.slice(end)}`;
    const utf16Offset = utf16Length(current.slice(0, start));
    const replacedLength = utf16Length(current.slice(start, end));
    const insertedLength = utf16Length(fallback);
    const shifted = (props.entities ?? [])
      .filter((entity: any) => entity.offset + entity.length <= utf16Offset || entity.offset >= utf16Offset + replacedLength)
      .map((entity: any) => entity.offset >= utf16Offset + replacedLength ? { ...entity, offset: entity.offset - replacedLength + insertedLength } : entity);
    props.setMessage(nextText);
    props.setEntities([...shifted, {
      type: "custom_emoji",
      offset: utf16Offset,
      length: insertedLength,
      document_id: String(item.document_id),
      fallback,
      premium_required: item.premium_required === true,
    }]);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(start + fallback.length, start + fallback.length);
    });
  }
  function applyEntity(type: "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_link") {
    const node = textareaRef.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    if (start === end) return;
    const entity: any = { type, offset: utf16Length((props.message ?? "").slice(0, start)), length: utf16Length((props.message ?? "").slice(start, end)) };
    if (type === "text_link") {
      const url = prompt("Link URL");
      if (!url) return;
      entity.url = url;
    }
    props.setEntities([...(props.entities ?? []), entity]);
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
          props.setMessage(e.target.value);
          if ((props.entities ?? []).length) props.setEntities([]);
        }}
        placeholder="Message text"
      />
      <div className="flex flex-wrap gap-2">
        {[
          ["bold", "B"],
          ["italic", "I"],
          ["underline", "U"],
          ["strikethrough", "S"],
          ["spoiler", "Spoiler"],
          ["text_link", "Link"],
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
          setTab={setPickerTab}
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
  setTab,
  load,
  loadMore,
  insert,
  close,
}: any) {
  const allItems = tab === "categories" ? [] : (catalog?.[tab] ?? []);
  const items = allItems.slice(0, visibleCount ?? 48);
  const packKey = `${tab}Packs`;
  const packs = (catalog?.[packKey] ?? [])
    .map((pack: any) => ({
      ...pack,
      items: (pack.items ?? []).filter((item: any) =>
        items.some((visible: any) => String(visible.document_id) === String(item.document_id)),
      ),
    }))
    .filter((pack: any) => pack.items.length);
  const tabs = ["recent", "installed", "featured", "search", "categories"];
  const onGridScroll = (event: any) => {
    const node = event.currentTarget;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 80) void loadMore();
  };
  const renderEmojiButton = (item: any) => (
    <button
      key={`${item.source}-${item.document_id}`}
      type="button"
      className="flex aspect-square min-h-0 items-center justify-center border border-transparent bg-transparent p-1 hover:border-primary hover:bg-primary/10"
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
      ) : (
        <span className="text-2xl leading-none">{item.fallback || "*"}</span>
      )}
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
            {packs.length ? (
              <div className="space-y-3">
                {packs.map((pack: any) => (
                  <section key={`${pack.source}-${pack.id}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <p className="truncate font-semibold">{pack.title}</p>
                      {pack.short_name ? <p className="truncate text-muted-foreground">@{pack.short_name}</p> : null}
                    </div>
                    <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
                      {pack.items.map(renderEmojiButton)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {items.map((item: any) => {
              return (
                <button
                  key={`${item.source}-${item.document_id}`}
                  type="button"
                  className="flex aspect-square min-h-0 items-center justify-center border border-transparent bg-transparent p-1 text-center hover:border-primary hover:bg-primary/10"
                  onClick={() => insert(item)}
                >
                  {item.preview_url ? (
                    item.preview_format === "tgs" ? (
                      <TgsPlayer className="mx-auto size-9" src={item.preview_url} fallback={item.fallback || "⭐"} />
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
                  ) : (
                    <span className="block text-2xl">{item.fallback || "⭐"}</span>
                  )}
                </button>
              );
            })}
              </div>
            )}
            {!loading && !items.length ? <div className="col-span-full"><Empty message="No custom emoji returned for this tab." /></div> : null}
            {items.length < allItems.length ? <p className="py-2 text-center text-xs text-muted-foreground">Scroll to load more</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({ message, mediaUrl, buttonText, buttonUrl }: any) {
  return (
    <section className={panelClass()}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Preview</p>
      <p className="mt-3 whitespace-pre-wrap text-sm">{message || "No text"}</p>
      {mediaUrl ? <p className="mt-2 break-all text-xs text-primary">{mediaUrl}</p> : null}
      {buttonText && buttonUrl ? (
        <p className="mt-2 text-xs text-primary">{`${buttonText} -> ${buttonUrl}`}</p>
      ) : null}
    </section>
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

function Billing({ auth, data, setNotice, actionBusy, runAction, reload, appLanguage }: any) {
  const language = appLanguage ?? localStorage.getItem("wpay-language") ?? "en";
  const usage = data?.usage ?? {};
  const currentPlan = usage.plan ?? data?.tenant?.plans ?? data?.subscription?.plans ?? {};
  const currentCode = currentPlan?.code ?? "";
  const [invoice, setInvoice] = useState<any>(data?.activeInvoice ?? null);
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
  const history = [...(data?.invoices ?? []), ...(data?.transactions ?? []).filter((t: any) => !t.invoice_id)];
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-cyan-400/20 bg-slate-950/70 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-cyan-300">Current Plan</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{currentPlan?.name ?? "TEST"}</h2>
            <p className="mt-1 text-sm text-slate-300">
              <span className="text-lg font-semibold text-white">${Number(currentPlan?.price_usd ?? 0)}</span> / month
            </p>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage.expired ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"}`}>
              {usage.expired ? "TEST limits" : "Active"}
            </span>
            <p className="mt-2 text-xs text-slate-400">
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
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
          Online payments are not available yet. Contact support to activate paid plans.
        </div>
      ) : null}
      {invoice ? (
        <section className="rounded-lg border border-emerald-400/30 bg-slate-950/80 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-300">Active Invoice</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{invoice.product_code === "PREMIUM_EMOJI" ? "Premium Emoji" : invoice.product_code}</h2>
              <p className="mt-1 text-xs text-slate-400">Invoice ID: {invoice.invoice_number ?? invoice.id}</p>
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
              <p className="font-semibold text-white">USDT TRC20</p>
              <p className="text-slate-300">Exact Payable Amount</p>
              <p className="break-all text-2xl font-semibold text-emerald-300">{exactAmount} USDT</p>
              <p className="text-slate-300">Receiving Address</p>
              <p className="break-all rounded-md border border-white/10 bg-white/[0.03] p-2 font-mono text-xs text-white">{invoice.receiving_address}</p>
              <p className="text-slate-300">Countdown: <span className="font-semibold text-white">{invoice.status === "EXPIRED" ? "Expired" : countdownText}</span></p>
              <p className="text-slate-300">Status: {invoice.status === "PENDING" ? "Waiting for payment..." : invoice.status}</p>
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
          <p className="text-xs font-semibold uppercase text-primary">Add-ons</p>
          <h2 className="mt-1 text-lg font-semibold">Premium Emoji</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Unlock WPAY custom emoji composer capability. This does not buy Telegram Premium for your linked account.
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
            <article key={plan.id} className={`rounded-lg border ${accent.border} bg-slate-950/70 p-4 shadow-sm`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-white">{plan.name}</p>
                    {String(plan.code).toUpperCase() === "PRO" ? <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">Popular</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{plan.description || planDescription(plan.code)}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold text-white">${Number(plan.price_usd ?? 0)}</p>
                  <p className="text-xs text-slate-400">/ month</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {planFeatures(plan).map(({ label, value, Icon }) => (
                  <div key={label} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                    <div className={`flex items-center gap-1.5 text-[11px] ${accent.text}`}>
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
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
  const tone = over || pct >= 90 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-cyan-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">{label}</span>
        <span className={over ? "font-semibold text-red-300" : "text-slate-400"}>{used.toLocaleString()} / {limitLabel(limit)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${tone}`} style={{ width: `${limit == null ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

function planAccent(code: string) {
  const key = String(code).toUpperCase();
  if (key === "PLUS") return { border: "border-cyan-400/30", text: "text-cyan-300", button: "bg-cyan-500 text-slate-950 hover:bg-cyan-400" };
  if (key === "PRO") return { border: "border-violet-400/35", text: "text-violet-300", button: "bg-violet-500 text-white hover:bg-violet-400" };
  if (key === "ENTERPRISE") return { border: "border-emerald-300/40 shadow-[0_0_24px_rgba(45,212,191,0.08)]", text: "text-emerald-300", button: "bg-emerald-400 text-slate-950 hover:bg-emerald-300" };
  return { border: "border-slate-700", text: "text-slate-300", button: "" };
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
    <div className="space-y-3">
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
    <div className="py-10 text-center">
      <Bot className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
