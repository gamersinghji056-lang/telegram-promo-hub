/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Eye,
  FolderOpen,
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
  Trash2,
  Users,
  X,
} from "lucide-react";
import { MiniAppShell } from "@/components/mini-app-shell";
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
  getNotifications,
  getOwnActivity,
  rejectGroup,
  removeKeyword,
  removeGroup,
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
  resumeBulkJoin,
  selectAudienceIds,
  startAudienceDiscovery,
  startBulkJoin,
  startGroupDiscovery,
  startConnectionLogin,
  updateCampaign,
  verifyConnectionCode,
  verifyConnectionPassword,
  verifyWritableGroups,
} from "@/lib/customer.functions";

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
  head: ({ params }) => ({
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

function inputClass(extra = "") {
  return `w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${extra}`;
}

function panelClass(extra = "") {
  return `border border-border bg-card p-4 ${extra}`;
}

function statusTone(status?: string) {
  if (["CONNECTED", "JOINED", "SENT", "COMPLETED", "APPROVED", "OPTED_IN"].includes(status ?? ""))
    return "text-success";
  if (["ERROR", "FAILED", "RESTRICTED", "REJECTED", "CANCELLED"].includes(status ?? ""))
    return "text-destructive";
  return "text-primary";
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
    disconnectConnection: useServerFn(disconnectConnection),
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
  const sectionRef = useRef(section);

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
      }),
      "group-history": (a) => campaignsFn({ data: { auth: a, filter: "GROUP" } }),
      "group-categories": async (a) => ({
        groups: await groupsFn({ data: { auth: a, status: "APPROVED_ACTIVE" } }),
        categories: await groupCategoriesFn({ data: { auth: a } }),
        writability: await groupWritabilitySummaryFn({ data: { auth: a } }),
      }),
      analytics: (a) => analyticsFn({ data: { auth: a } }),
      billing: (a) => billingFn({ data: { auth: a } }),
      settings: async (a) => ({
        logs: await logsFn({ data: { auth: a } }),
      }),
    }),
    [],
  );

  async function load() {
    const targetSection = section;
    setBusy(true);
    setLoadedSection("");
    setData(null);
    setError("");
    setNotice("");
    const nextAuth = await telegramAuthReady();
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
      setLoadedSection(targetSection);
      const notes = await notificationsFn({ data: { auth: nextAuth } });
      setNotifications(notes ?? []);
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
    void load();
  }, [section]);

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
          <h1 className="mt-1 text-2xl font-semibold">{titles[section] ?? section}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" aria-label="Refresh" onClick={load} disabled={busy}>
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
          <Button size="icon" variant="secondary" aria-label="Sign out" onClick={signOut}>
            <LogOut />
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
          reload={load}
          setNotice={guardedNotice(section)}
          actionBusy={actionBusy}
          runAction={runAction}
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
  if (section === "billing") return <Billing data={props.data} />;
  if (section === "settings") return <SettingsPanel data={props.data} />;
  return null;
}

function Dashboard({ data }: { data: any }) {
  const messageStats = data?.campaigns?.messages ?? {};
  const overview = [
    ["Connected Sessions", data?.connections?.active, Bot],
    ["Approved Groups", data?.groups?.approved, FolderOpen],
    ["Writable Groups", data?.groups?.writable, CheckCircle2],
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
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"PHONE" | "CODE" | "PASSWORD">("PHONE");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await runAction("send-code", async () => {
      const result = await actions.startConnectionLogin({ data: { auth, label, phone } });
      setConnectionId(result.connection.id);
      setStep("CODE");
      setNotice(result.isCodeViaApp ? "Code sent to your Telegram app." : "Code sent by Telegram.");
      await reload();
    });
  }
  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    await runAction("verify-code", async () => {
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
    await runAction("verify-password", async () => {
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
    await runAction(`check-${id}`, async () => {
      const result = await actions.checkConnection({ data: { auth, id } });
      setNotice(result.ok ? "Session is connected." : result.error);
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
          <Button type="submit" className="w-full" disabled={!phone || actionBusy === "send-code"}>
            <Plus className="mr-2 size-4" /> {actionBusy === "send-code" ? "Sending..." : "SEND CODE"}
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
          <Button type="submit" className="w-full" disabled={!code || actionBusy === "verify-code"}>
            {actionBusy === "verify-code" ? "Verifying..." : "VERIFY CODE"}
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
          <Button type="submit" className="w-full" disabled={!password || actionBusy === "verify-password"}>
            {actionBusy === "verify-password" ? "Connecting..." : "CONNECT SESSION"}
          </Button>
        </form>
      ) : null}
      <div className="space-y-3">
        {rows.map((row: any) => (
          <article key={row.id} className={panelClass()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.account_name ?? row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.username ? `@${row.username}` : "Username pending"} | ID{" "}
                  {row.telegram_user_id ?? row.telegram_id ?? "pending"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phone {row.phone_masked ?? "not saved"} | Health {row.health ?? "unknown"}
                </p>
              </div>
              <span className={`text-xs font-semibold ${statusTone(row.status)}`}>
                {row.status}
              </span>
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
              <p>{row.restriction_reason ?? row.error_message ?? "No errors"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={actionBusy === `check-${row.id}`} onClick={() => check(row.id)}>
                {actionBusy === `check-${row.id}` ? "Checking..." : "CHECK STATUS"}
              </Button>
              <Button size="sm" variant="secondary" disabled={actionBusy === `check-${row.id}`} onClick={() => check(row.id)}>
                RECONNECT
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={actionBusy === `disconnect-${row.id}`}
                onClick={() =>
                  runAction(`disconnect-${row.id}`, async () => {
                    await actions.disconnectConnection({ data: { auth, id: row.id } });
                    setNotice("Session disconnected.");
                    await reload();
                  })
                }
              >
                {actionBusy === `disconnect-${row.id}` ? "Disconnecting..." : "DISCONNECT"}
              </Button>
            </div>
          </article>
        ))}
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
        {rows.map((c: any) => (
          <option key={c.id} value={c.id} disabled={c.status !== "CONNECTED"}>
            {c.username ? `@${c.username}` : c.label} - {c.health ?? c.status}
          </option>
        ))}
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
  const needsJoinSession = groups.some((g: any) => ["APPROVED", "JOINED"].includes(g.status));
  const approvedNotJoined = groups.filter((g: any) => g.status === "APPROVED").length;
  const totalBulk = bulkJoin?.group_ids?.length ?? approvedNotJoined;
  async function startAll() {
    await runAction("join-all", async () => {
      await actions.startBulkJoin({ data: { auth, connectionId } });
      setNotice("Join all started.");
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
        </section>
      ) : null}
      {groups.map((g: any) => (
        <article key={g.id} className={panelClass()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <input type="checkbox" readOnly checked={["APPROVED", "JOINED"].includes(g.status)} />
              <div>
              <p className="font-medium">{g.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.username ? `@${g.username}` : "No username"} | {g.member_count ?? "unknown"}{" "}
                members
              </p>
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
  const writableGroups = groups.filter(
    (g: any) => g.can_send_messages === true && g.writable_status === "WRITABLE",
  );
  const categories = data?.categories ?? [];
  const [writability, setWritability] = useState<any>(data?.writability ?? {});
  const [verification, setVerification] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    setWritability(data?.writability ?? {});
  }, [data?.writability]);

  async function verifyGroups() {
    await runAction("verify-writable-groups", async () => {
      const response = await actions.verifyWritableGroups({ data: { auth, limit: 60 } });
      setVerification(response);
      setWritability(response.summary ?? writability);
      setNotice(
        `Checking Groups: ${response.checked}/${response.total}. Writable: ${response.writable}. Not Writable: ${response.notWritable}. Unknown: ${response.unknown}.`,
      );
      await reload();
    });
  }

  function openEditor(category?: any) {
    setDetail(null);
    setEditing(category ?? { id: null });
    setName(category?.name ?? "");
    setSelected(category?.groups?.map((g: any) => g.id) ?? []);
    if (category?.id) {
      void runAction(`open-category-${category.id}`, async () => {
        const response = await actions.getGroupCategoryDetail({ data: { auth, id: category.id } });
        setSelected(
          (response.groups ?? [])
            .filter((g: any) => g.can_send_messages === true && g.writable_status === "WRITABLE")
            .map((g: any) => g.id),
        );
        setDetail(response);
      });
    }
  }

  return (
    <div className="space-y-4">
      <section className={panelClass("space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={() => openEditor()}>
            <Plus className="mr-2 size-4" /> CREATE CATEGORY
          </Button>
          <Button
            variant="secondary"
            disabled={actionBusy === "verify-writable-groups"}
            onClick={() => void verifyGroups()}
          >
            {actionBusy === "verify-writable-groups" ? "Checking..." : "VERIFY GROUPS"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Checking Groups" value={`${verification?.checked ?? 0}/${verification?.total ?? writability.unknown ?? 0}`} />
          <Stat label="Writable" value={writability.writable ?? writableGroups.length} />
          <Stat label="Not Writable" value={writability.notWritable ?? 0} />
          <Stat label="Unknown" value={writability.unknown ?? 0} />
        </div>
      </section>
      <div className="space-y-3">
        {categories.map((category: any) => (
          <article key={category.id} className={panelClass()}>
            <p className="font-semibold">{category.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{category.group_count ?? 0} Groups</p>
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
              <p className="text-sm text-muted-foreground">Total Groups: {detail.groups.length}</p>
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
              void runAction("save-category", async () => {
                await actions.saveGroupCategory({
                  data: { auth, id: editing.id, name, group_ids: selected },
                });
                setNotice(editing.id ? "Category updated successfully." : "Category created successfully.");
                setEditing(null);
                await reload();
              });
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{editing.id ? "Edit Category" : "Create Category"}</p>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Category Name</span>
              <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Writable Groups: {writableGroups.length} | Selected Groups: {selected.length}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setSelected(writableGroups.map((g: any) => g.id))}>
                  SELECT ALL
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setSelected([])}>
                  CLEAR ALL
                </Button>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto">
              {writableGroups.map((g: any) => (
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
              {!writableGroups.length ? (
                <p className="text-sm text-muted-foreground">
                  No confirmed writable groups available. Tap VERIFY GROUPS to check approved groups
                  with your healthy Telegram session.
                </p>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={!name || !selected.length || actionBusy === "save-category"}>
              {actionBusy === "save-category" ? "Saving..." : editing.id ? "SAVE" : "CREATE CATEGORY"}
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
              onClick={() => void changeFilter(value)}
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={panelClass("space-y-3")}>
          <p className="font-semibold">Source Groups</p>
          <GroupPicker
            groups={data?.groups ?? []}
            selected={selectedGroups}
            setSelected={setSelectedGroups}
            allowAll
          />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Selected Groups" value={selectedCount} />
            <Stat label="Processed" value={processed} />
            <Stat label="Remaining" value={Math.max(selectedCount - processed, 0)} />
          </div>
        </section>
        <section className={panelClass("space-y-3")}>
          <p className="font-semibold">Users Found</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Users Found" value={audience.totalFound ?? 0} />
            <Stat label="Showing" value={`${audience.showingFrom ?? 0}-${audience.showingTo ?? 0}`} />
            <Stat label="New Users" value={state.new_users ?? 0} />
            <Stat label="With Username" value={audience.withUsername ?? 0} />
            <Stat label="Excluded Inactive" value={audience.excludedInactive ?? 0} />
            <Stat label="Active Posters" value={audience.activePosters ?? 0} />
            <Stat label="Duplicates" value={state.duplicates ?? 0} />
            <Stat label="Previously Saved" value={state.previously_saved ?? 0} />
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
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
      <details className={panelClass("space-y-3")}>
        <summary className="cursor-pointer font-semibold">DISCOVERY ISSUES ({issues.length})</summary>
        <div className="mt-3 space-y-2">
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
        name={name}
        setName={setName}
        message={message}
        setMessage={setMessage}
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
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [name, setName] = useState("Group Promotion");
  const [scheduledAt, setScheduledAt] = useState("");
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  const [cycleDelay, setCycleDelay] = useState(20);
  async function submit(e: FormEvent) {
    e.preventDefault();
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
      setNotice(scheduledAt ? "Group campaign scheduled." : "Group campaign queued.");
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
              {c.name} - {c.group_count ?? 0} groups
            </option>
          ))}
        </select>
      </label>
      <MessageForm
        name={name}
        setName={setName}
        message={message}
        setMessage={setMessage}
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
  const total = Number(stats.total_messages ?? row?.total_targets ?? sent + pending + failed);
  return { total, sent, pending, failed };
}

function CampaignDonut({ stats, compact = false }: { stats: any; compact?: boolean }) {
  const total = Math.max(Number(stats.total ?? 0), 0);
  const sent = Math.max(Number(stats.sent ?? 0), 0);
  const pending = Math.max(Number(stats.pending ?? 0), 0);
  const failed = Math.max(Number(stats.failed ?? 0), 0);
  const safeTotal = Math.max(total, sent + pending + failed, 1);
  const sentDeg = (sent / safeTotal) * 360;
  const pendingDeg = ((sent + pending) / safeTotal) * 360;
  const size = compact ? "size-24" : "size-32";
  return (
    <div className="flex items-center gap-4">
      <div
        className={`grid ${size} shrink-0 place-items-center rounded-full`}
        style={{
          background: `conic-gradient(hsl(var(--success)) 0deg ${sentDeg}deg, hsl(var(--warning)) ${sentDeg}deg ${pendingDeg}deg, hsl(var(--destructive)) ${pendingDeg}deg 360deg)`,
        }}
        aria-label={`Total ${total}, Sent ${sent}, Pending ${pending}, Failed ${failed}`}
      >
        <div className="grid size-[68%] place-items-center rounded-full bg-card text-center">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{total}</p>
          </div>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-1 text-xs">
        <p><span className="text-success">GREEN</span> Sent: {sent}</p>
        <p><span className="text-warning">YELLOW</span> Pending: {pending}</p>
        <p><span className="text-destructive">RED</span> Failed: {failed}</p>
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
                Cycles {c.cycles_completed ?? 0} | Total Messages {jobStats(c).total} | Sent{" "}
                {jobStats(c).sent} | Pending {jobStats(c).pending} | Failed {jobStats(c).failed} | Last run{" "}
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
              <Stat label="Total Messages" value={jobStats(detail.campaign).total} />
              <Stat label="Sent" value={jobStats(detail.campaign).sent} />
              <Stat label="Pending" value={jobStats(detail.campaign).pending} />
              <Stat label="Failed" value={jobStats(detail.campaign).failed} />
            </div>
            <CampaignDonut stats={jobStats(detail.campaign)} />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent errors/logs</p>
              {(detail.logs ?? []).map((log: any) => (
                <p key={log.id} className="border border-border bg-background p-2 text-xs">
                  {log.level}: {log.message}
                </p>
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
  return (
    <section className={panelClass("space-y-3")}>
      <input
        className={inputClass()}
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
        placeholder="Campaign name"
      />
      <textarea
        className={inputClass("min-h-28")}
        value={props.message}
        onChange={(e) => props.setMessage(e.target.value)}
        placeholder="Message text"
      />
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
            ["Not Writable", groups.notWritable],
            ["Joined", groups.joined],
          ]}
          bars={[
            ["Approved", groups.approved, "bg-primary"],
            ["Writable", groups.writable, "bg-success"],
            ["Not Writable", groups.notWritable, "bg-destructive"],
            ["Joined", groups.joined, "bg-warning"],
          ]}
        />
      </div>
    </div>
  );
}

function AnalyticsSection({
  title,
  stats,
  bars,
}: {
  title: string;
  stats: [string, number | string | undefined][];
  bars: [string, number | undefined, string][];
}) {
  const max = Math.max(1, ...bars.map(([, value]) => Number(value ?? 0)));
  return (
    <section className={panelClass("space-y-3")}>
      <p className="font-semibold">{title}</p>
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

function Billing({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <section className={panelClass()}>
        <CreditCard className="size-5 text-primary" />
        <p className="mt-3 font-semibold">
          {data?.subscription?.plans?.name ?? data?.tenant?.plans?.name ?? "Current plan"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Payments:{" "}
          {data?.payments?.enabled
            ? `${data.payments.network} wallet configured`
            : "not configured"}
        </p>
      </section>
      {(data?.transactions ?? []).map((t: any) => (
        <article key={t.id} className={panelClass()}>
          <p className="font-medium">
            {t.amount} {t.currency}
          </p>
          <p className={`mt-1 text-xs font-semibold ${statusTone(t.status)}`}>{t.status}</p>
        </article>
      ))}
    </div>
  );
}

function SettingsPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <section className={panelClass()}>
        <Settings className="size-5 text-primary" />
        <p className="mt-3 font-semibold">Account Settings</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Security and session settings are managed through the bot-authenticated Mini App session.
        </p>
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
