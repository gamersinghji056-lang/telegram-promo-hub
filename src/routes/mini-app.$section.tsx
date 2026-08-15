/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { MiniAppShell } from "@/components/mini-app-shell";
import { Button } from "@/components/ui/button";
import {
  addConnection,
  addGroupByUsername,
  addKeyword,
  approveGroup,
  checkConnection,
  controlCampaign,
  createCampaign,
  disconnectConnection,
  findAudience,
  getAnalytics,
  getBilling,
  getCampaigns,
  getConnections,
  getDashboard,
  getGroups,
  getKeywords,
  getNotifications,
  getOwnActivity,
  rejectGroup,
  removeKeyword,
  runGroupDiscovery,
  joinGroup,
  logout as logoutCustomer,
  startConnectionLogin,
  verifyConnectionCode,
  verifyConnectionPassword,
} from "@/lib/customer.functions";

const valid = new Set([
  "dashboard",
  "sessions",
  "groups-find",
  "groups-found",
  "groups-approved",
  "groups-joined",
  "dm-audience",
  "dm-create",
  "dm-history",
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
  "dm-audience": "DM Audience",
  "dm-create": "DM Campaign",
  "dm-history": "DM History",
  "group-create": "Group Campaign",
  "group-history": "Group History",
  analytics: "Analytics",
  billing: "Billing",
  settings: "Settings",
};

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
  const telegram = (
    window as unknown as {
      Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
    }
  ).Telegram?.WebApp;
  telegram?.ready?.();
  telegram?.expand?.();
  if (telegram?.initData) return `tma ${telegram.initData}`;
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("sess");
  if (fromHash) {
    sessionStorage.setItem("customer-session", fromHash);
    history.replaceState(null, "", window.location.pathname);
  }
  const session = fromHash ?? sessionStorage.getItem("customer-session");
  return session ? `sess ${session}` : null;
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
  const analyticsFn = useServerFn(getAnalytics);
  const billingFn = useServerFn(getBilling);
  const logsFn = useServerFn(getOwnActivity);
  const notificationsFn = useServerFn(getNotifications);
  const logoutFn = useServerFn(logoutCustomer);

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
    addGroupByUsername: useServerFn(addGroupByUsername),
    approveGroup: useServerFn(approveGroup),
    joinGroup: useServerFn(joinGroup),
    rejectGroup: useServerFn(rejectGroup),
    findAudience: useServerFn(findAudience),
    createCampaign: useServerFn(createCampaign),
    controlCampaign: useServerFn(controlCampaign),
  };

  const [auth, setAuth] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loaders = useMemo<Record<string, (auth: string) => Promise<any>>>(
    () => ({
      dashboard: (a) => dashboardFn({ data: { auth: a } }),
      sessions: (a) => connectionsFn({ data: { auth: a } }),
      "groups-find": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        keywords: await keywordsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "FOUND" } }),
      }),
      "groups-found": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "FOUND" } }),
      }),
      "groups-approved": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED" } }),
      }),
      "groups-joined": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "JOINED" } }),
      }),
      "dm-audience": async (a) => ({
        groups: await groupsFn({ data: { auth: a, status: "APPROVED" } }),
      }),
      "dm-create": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED" } }),
      }),
      "dm-history": (a) => campaignsFn({ data: { auth: a, filter: "DM" } }),
      "group-create": async (a) => ({
        connections: await connectionsFn({ data: { auth: a } }),
        groups: await groupsFn({ data: { auth: a, status: "APPROVED" } }),
      }),
      "group-history": (a) => campaignsFn({ data: { auth: a, filter: "GROUP" } }),
      analytics: (a) => analyticsFn({ data: { auth: a } }),
      billing: (a) => billingFn({ data: { auth: a } }),
      settings: async (a) => ({
        logs: await logsFn({ data: { auth: a } }),
      }),
    }),
    [],
  );

  async function load() {
    setBusy(true);
    setError("");
    setNotice("");
    const nextAuth = telegramAuth();
    setAuth(nextAuth);
    if (!valid.has(section)) {
      setError("This section does not exist.");
      setBusy(false);
      return;
    }
    if (!nextAuth) {
      setError(
        "Open this control panel from @Wpaypromotionbot after using Register or Login in the bot.",
      );
      setBusy(false);
      return;
    }
    try {
      const result = await loaders[section]?.(nextAuth);
      setData(result);
      if (section === "dashboard") void notificationsFn({ data: { auth: nextAuth } });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("NO_ACCOUNT")
          ? "No customer account is linked to this Telegram profile. Use Register in the bot first."
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

  useEffect(() => {
    void load();
  }, [section]);

  return (
    <MiniAppShell active={section}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">{titles[section] ?? section}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" aria-label="Refresh" onClick={load}>
            <RefreshCw />
          </Button>
          <Button size="icon" variant="secondary" aria-label="Sign out" onClick={signOut}>
            <LogOut />
          </Button>
        </div>
      </div>
      {notice ? (
        <div className="mb-4 border border-primary bg-card p-3 text-sm text-primary">{notice}</div>
      ) : null}
      {error ? (
        <SessionWarning error={error} />
      ) : busy && !data ? (
        <p className="py-10 text-center text-muted-foreground">Loading workspace...</p>
      ) : (
        <CustomerContent
          section={section}
          auth={auth ?? ""}
          data={data}
          actions={actions}
          reload={load}
          setNotice={setNotice}
        />
      )}
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
}) {
  const { section } = props;
  if (section === "dashboard") return <Dashboard data={props.data} />;
  if (section === "sessions") return <Sessions {...props} />;
  if (section === "groups-find") return <GroupFinder {...props} />;
  if (["groups-found", "groups-approved", "groups-joined"].includes(section))
    return <GroupList {...props} />;
  if (section === "dm-audience") return <DMAudience {...props} />;
  if (section === "dm-create") return <DMCampaign {...props} />;
  if (section === "dm-history" || section === "group-history")
    return <CampaignHistory {...props} />;
  if (section === "group-create") return <GroupCampaign {...props} />;
  if (section === "analytics") return <Analytics data={props.data} />;
  if (section === "billing") return <Billing data={props.data} />;
  if (section === "settings") return <SettingsPanel data={props.data} />;
  return null;
}

function Dashboard({ data }: { data: any }) {
  const stats = [
    ["Connected Sessions", data?.connections?.active, Bot],
    ["Healthy Sessions", data?.connections?.active, CheckCircle2],
    [
      "Restricted Sessions",
      data?.connections?.restricted ?? data?.connections?.issues,
      AlertTriangle,
    ],
    ["Keywords", data?.keywords, Search],
    ["Groups Found", data?.groups?.found, Users],
    ["Approved Groups", data?.groups?.approved, CheckCircle2],
    ["Joined Groups", data?.groups?.joined, CheckCircle2],
    ["Eligible Audience", data?.audience?.available, Users],
    ["Previously Contacted", data?.audience?.contacted, Clock],
    ["DM Campaigns", data?.campaigns?.dm, Send],
    ["Group Campaigns", data?.campaigns?.group, Send],
    ["Running Campaigns", data?.campaigns?.running, Send],
    ["Completed Campaigns", data?.campaigns?.completed, CheckCircle2],
    ["Failed Campaigns", data?.campaigns?.failed, AlertTriangle],
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
      <section className={panelClass()}>
        <div className="flex items-center justify-between">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map(([label, value, Icon]) => (
          <section key={String(label)} className={panelClass()}>
            <Icon className="size-4 text-primary" />
            <p className="mt-3 text-xs text-muted-foreground">{label as string}</p>
            <p className="mt-1 text-2xl font-semibold">{Number(value ?? 0)}</p>
          </section>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <QuickLink href="/mini-app/sessions" label="ADD SESSION" />
        <QuickLink href="/mini-app/groups-find" label="FIND GROUPS" />
        <QuickLink href="/mini-app/dm-create" label="CREATE DM CAMPAIGN" />
        <QuickLink href="/mini-app/group-create" label="CREATE GROUP CAMPAIGN" />
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="flex min-h-24 items-center justify-center border border-border bg-card p-5 text-center text-base font-semibold text-primary"
      href={href}
    >
      + {label}
    </a>
  );
}

function Sessions({ auth, data, actions, reload, setNotice }: any) {
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"PHONE" | "CODE" | "PASSWORD">("PHONE");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await actions.startConnectionLogin({ data: { auth, label, phone } });
    setConnectionId(result.connection.id);
    setStep("CODE");
    setNotice(result.isCodeViaApp ? "Code sent to your Telegram app." : "Code sent by Telegram.");
    await reload();
  }
  async function verifyCode(e: FormEvent) {
    e.preventDefault();
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
  }
  async function verifyPassword(e: FormEvent) {
    e.preventDefault();
    await actions.verifyConnectionPassword({ data: { auth, connectionId, password } });
    setStep("PHONE");
    setPhone("");
    setCode("");
    setPassword("");
    setConnectionId("");
    setNotice("Telegram session connected.");
    await reload();
  }
  async function check(id: string) {
    const result = await actions.checkConnection({ data: { auth, id } });
    setNotice(result.ok ? "Session is connected." : result.error);
    await reload();
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
          <Button type="submit" className="w-full" disabled={!phone}>
            <Plus className="mr-2 size-4" /> SEND CODE
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
          <Button type="submit" className="w-full" disabled={!code}>
            VERIFY CODE
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
          <Button type="submit" className="w-full" disabled={!password}>
            CONNECT SESSION
          </Button>
        </form>
      ) : null}
      <div className="space-y-3">
        {(data ?? []).map((row: any) => (
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
              <Button size="sm" variant="secondary" onClick={() => check(row.id)}>
                CHECK STATUS
              </Button>
              <Button size="sm" variant="secondary" onClick={() => check(row.id)}>
                RECONNECT
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await actions.disconnectConnection({ data: { auth, id: row.id } });
                  await reload();
                }}
              >
                DISCONNECT
              </Button>
            </div>
          </article>
        ))}
        {!data?.length ? <Empty message="No Telegram sessions connected yet." /> : null}
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

function GroupFinder({ auth, data, actions, reload, setNotice }: any) {
  const [keyword, setKeyword] = useState("");
  const [username, setUsername] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const keywords = (data?.keywords ?? []).map((k: any) => k.keyword);
  async function addKey(e: FormEvent) {
    e.preventDefault();
    await actions.addKeyword({ data: { auth, keyword } });
    setKeyword("");
    await reload();
  }
  async function searchGroups() {
    const result = await actions.runGroupDiscovery({ data: { auth, connectionId, keywords } });
    setNotice(
      result.configured
        ? `${result.added} group(s) found.`
        : "Discovery provider is not configured. Add public groups by @username.",
    );
    await reload();
  }
  async function addManual(e: FormEvent) {
    e.preventDefault();
    const row = await actions.addGroupByUsername({
      data: { auth, connectionId, username, keywords },
    });
    setUsername("");
    setNotice(`Found ${row.title}. Review it before approval.`);
    await reload();
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
            <button
              key={k.id}
              type="button"
              onClick={async () => {
                await actions.removeKeyword({ data: { auth, id: k.id } });
                await reload();
              }}
              className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs"
            >
              {k.keyword} <X className="size-3" />
            </button>
          ))}
        </div>
      </form>
      <section className={panelClass("space-y-3")}>
        <SessionSelect
          label="Select Search Session"
          value={connectionId}
          onChange={setConnectionId}
          connections={data?.connections}
        />
        <Button
          className="w-full"
          onClick={searchGroups}
          disabled={!connectionId || keywords.length === 0}
        >
          <Search className="mr-2 size-4" /> SEARCH GROUPS
        </Button>
      </section>
      <form onSubmit={addManual} className={panelClass("space-y-3")}>
        <p className="font-semibold">Add Public Group</p>
        <input
          className={inputClass()}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@public_group"
        />
        <Button type="submit" className="w-full" disabled={!connectionId}>
          VIEW PUBLIC GROUP
        </Button>
      </form>
      <GroupRows
        groups={data?.groups ?? []}
        connections={data?.connections ?? []}
        auth={auth}
        actions={actions}
        reload={reload}
      />
    </div>
  );
}

function GroupList({ auth, data, actions, reload }: any) {
  return (
    <GroupRows
      groups={data?.groups ?? []}
      connections={data?.connections ?? []}
      auth={auth}
      actions={actions}
      reload={reload}
    />
  );
}

function GroupRows({ groups, connections, auth, actions, reload }: any) {
  const [connectionId, setConnectionId] = useState("");
  return (
    <div className="space-y-3">
      <SessionSelect
        label="Select Join Session"
        value={connectionId}
        onChange={setConnectionId}
        connections={connections}
      />
      {groups.map((g: any) => (
        <article key={g.id} className={panelClass()}>
          <div className="flex items-start justify-between gap-3">
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
            <Button
              size="sm"
              variant="secondary"
              disabled={!connectionId}
              onClick={async () => {
                await actions.approveGroup({ data: { auth, id: g.id, connectionId } });
                await reload();
              }}
            >
              APPROVE
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!connectionId}
              onClick={async () => {
                await actions.joinGroup({ data: { auth, id: g.id, connectionId } });
                await reload();
              }}
            >
              JOIN
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await actions.rejectGroup({ data: { auth, id: g.id } });
                await reload();
              }}
            >
              REJECT
            </Button>
          </div>
        </article>
      ))}
      {!groups.length ? <Empty message="No groups in this view." /> : null}
    </div>
  );
}

function DMAudience({ auth, data, actions, setNotice }: any) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [onlyNew, setOnlyNew] = useState(true);
  const [result, setResult] = useState<any>(null);
  async function run() {
    const response = await actions.findAudience({
      data: { auth, groupIds: selectedGroups, onlyNew },
    });
    setResult(response);
    setNotice(
      `Eligible: ${response.eligible}. Previously contacted: ${response.previouslyContacted}.`,
    );
  }
  return (
    <div className="space-y-4">
      <GroupPicker
        groups={data?.groups ?? []}
        selected={selectedGroups}
        setSelected={setSelectedGroups}
        allowAll={false}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
        Exclude previously contacted
      </label>
      <Button className="w-full" onClick={run} disabled={selectedGroups.length === 0}>
        FIND ELIGIBLE USERS
      </Button>
      {result ? (
        <AudienceSummary
          result={result}
          selectable={false}
          selected={[]}
          setSelected={() => undefined}
        />
      ) : null}
    </div>
  );
}

function DMCampaign({ auth, data, actions, setNotice }: any) {
  const [sourceGroups, setSourceGroups] = useState<string[]>([]);
  const [audience, setAudience] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [name, setName] = useState("DM Promotion");

  async function loadAudience() {
    const response = await actions.findAudience({
      data: { auth, groupIds: sourceGroups, onlyNew: true },
    });
    setAudience(response);
    setSelected([]);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const buttons = buttonText && buttonUrl ? [{ text: buttonText, url: buttonUrl }] : [];
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
      },
    });
    setNotice("DM campaign queued. Worker will process due jobs.");
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <GroupPicker
        groups={data?.groups ?? []}
        selected={sourceGroups}
        setSelected={setSourceGroups}
        allowAll={false}
      />
      <Button
        type="button"
        className="w-full"
        onClick={loadAudience}
        disabled={sourceGroups.length === 0}
      >
        FIND ELIGIBLE USERS
      </Button>
      {audience ? (
        <AudienceSummary
          result={audience}
          selectable
          selected={selected}
          setSelected={setSelected}
        />
      ) : null}
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
      <Preview
        message={message}
        mediaUrl={mediaUrl}
        buttonText={buttonText}
        buttonUrl={buttonUrl}
      />
      <Button
        className="w-full"
        type="submit"
        disabled={!connectionId || !selected.length || (!message && !mediaUrl)}
      >
        APPROVE AND QUEUE
      </Button>
    </form>
  );
}

function GroupCampaign({ auth, data, actions, setNotice }: any) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [name, setName] = useState("Group Promotion");
  const [scheduledAt, setScheduledAt] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const buttons = buttonText && buttonUrl ? [{ text: buttonText, url: buttonUrl }] : [];
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
        group_ids: selectedGroups,
        contact_ids: [],
        scheduled_at: scheduledAt || null,
        start_now: !scheduledAt,
      },
    });
    setNotice(scheduledAt ? "Group campaign scheduled." : "Group campaign queued.");
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <GroupPicker
        groups={data?.groups ?? []}
        selected={selectedGroups}
        setSelected={setSelectedGroups}
        allowAll
      />
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
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Schedule</span>
        <input
          className={inputClass()}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </label>
      <Preview
        message={message}
        mediaUrl={mediaUrl}
        buttonText={buttonText}
        buttonUrl={buttonUrl}
      />
      <Button
        className="w-full"
        type="submit"
        disabled={!connectionId || !selectedGroups.length || (!message && !mediaUrl)}
      >
        APPROVE AND QUEUE
      </Button>
    </form>
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSelected(groups.map((g: any) => g.id))}
          >
            ALL
          </Button>
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

function AudienceSummary({ result, selectable, selected, setSelected }: any) {
  const users = result.users ?? [];
  const choose = (count: number) => setSelected(users.slice(0, count).map((u: any) => u.id));
  return (
    <section className={panelClass("space-y-3")}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Total Found" value={result.totalFound} />
        <Stat label="Eligible" value={result.eligible} />
        <Stat label="Previously Contacted" value={result.previouslyContacted} />
        <Stat label="Duplicates" value={result.duplicates} />
        <Stat label="Excluded" value={result.excluded} />
      </div>
      {selectable ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSelected(users.map((u: any) => u.id))}
          >
            Select All
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setSelected([])}>
            Select None
          </Button>
          {[10, 15, 25, 50].map((n) => (
            <Button key={n} type="button" size="sm" variant="secondary" onClick={() => choose(n)}>
              Select {n}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="max-h-72 space-y-2 overflow-auto">
        {users.map((u: any) => (
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
            <span>{u.username ? `@${u.username}` : (u.display_name ?? u.telegram_user_id)}</span>
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
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(totals).map(([key, value]) => (
        <Stat key={key} label={key.replace(/([A-Z])/g, " $1")} value={value as number} />
      ))}
    </div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <section className={panelClass()}>
      <p className="text-xs capitalize text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{Number(value ?? 0)}</p>
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
