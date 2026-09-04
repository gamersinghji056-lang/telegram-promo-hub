import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, BarChart3, Bot, BrainCircuit, Check, ChevronDown, CircleHelp,
  Compass, CreditCard, Download, ExternalLink, FolderCheck, Gauge, Globe2, Layers3,
  Menu, MessageCircle, Mic, MonitorSmartphone, Network, RadioTower, Search, Send,
  ShieldCheck, Smartphone, Sparkles, Tags, Users, WalletCards,
  X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FloatingAssistant } from "@/components/floating-assistant";
import { websiteAssistant } from "@/lib/assistant-knowledge";
import { getPublicProductConfig } from "@/lib/public-site.functions";

type PublicConfig = Awaited<ReturnType<typeof getPublicProductConfig>>;
type PageKind = "home" | "promotion" | "download" | "mark" | "guides" | "guide-promotion" | "guide-mark" | "about" | "faq" | "contact" | "privacy" | "terms" | "acceptable-use" | "security" | "mark-app";

export const PRODUCT_AVAILABILITY = {
  promotion: "live",
  mark: "coming_soon",
} as const;

const nav = [
  ["Products", "/#products"], ["Solutions", "/#solutions"], ["Guides", "/guides"],
  ["Download", "/download"], ["About", "/about"], ["FAQ", "/faq"], ["Contact", "/contact"],
] as const;

const supportUsername = "laura_luxee";
const supportUrl = "https://t.me/laura_luxee";

const homeFaqs = [
  ["Is Telegram Promotion live?", "Yes. Telegram Promotion is the current live product and opens through the configured Promotion bot."],
  ["What problem does it solve?", "It centralizes repeatable Telegram promotion work: connection, discovery, organization, campaign operation, history and reporting."],
  ["Does it bypass Telegram limits?", "No. The product is designed around customer control, session health, permissions and Telegram responses."],
  ["What is Growth Intelligence?", "A reporting area that uses stored snapshots and Telegram-exposed data where an authorized session has sufficient access."],
  ["Can I manage Telegram sessions?", "Yes. Connected accounts, reconnect state, health and Premium status remain part of the Promotion workspace."],
  ["Does the site show live customer metrics?", "No. Public previews show product structure only and do not connect to production customer data."],
  ["What is MARK?", "MARK is a planned intelligent Telegram assistant built around business knowledge, instructions, context and conversations."],
  ["How do I access MARK?", "Explore MARK from the website. Start, Try, Open or Use actions show the dedicated access state until the workspace is opened."],
  ["How do I get support?", "Official support is available on Telegram at @laura_luxee."],
] as const;

function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => { getPublicProductConfig().then(setConfig).catch(() => setConfig(null)); }, []);
  return config;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-orbit ${compact ? "brand-orbit-sm" : ""}`} aria-hidden="true"><span className="brand-orbit-core"><Send /></span></span>;
}

function Status({ kind }: { kind: "live" | "soon" }) {
  return <span className={kind === "live" ? "public-status public-status-live" : "public-status public-status-soon"}>{kind === "live" ? "LIVE" : "COMING SOON"}</span>;
}

function ComingSoonModal({ open, close }: { open: boolean; close: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (!open) return null;
  return (
    <div className="public-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="public-modal" role="dialog" aria-modal="true" aria-labelledby="mark-coming-soon-title">
        <button className="public-icon-button absolute right-4 top-4" onClick={close} aria-label="Close"><X /></button>
        <div className="public-mark-symbol"><BrainCircuit /></div>
        <h2 id="mark-coming-soon-title">MARK</h2>
        <p className="public-kicker">Coming Soon</p>
        <p>We are building MARK, an intelligent Telegram assistant designed around your business, instructions and conversations.</p>
        <p className="text-sm text-slate-400">Explore the product today and see how MARK will work when access opens.</p>
        <div className="public-modal-actions">
          <a className="public-button public-button-primary" href="/mark">Explore MARK <ArrowRight /></a>
          <a className="public-button public-button-secondary" href="/guides/mark">How It Works</a>
          <button className="public-button public-button-ghost" onClick={close}>Close</button>
        </div>
      </section>
    </div>
  );
}

function ProductChooser({ open, close, config, showMark }: { open: boolean; close: () => void; config: PublicConfig | null; showMark: () => void }) {
  if (!open) return null;
  return (
    <div className="public-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="public-modal public-chooser" role="dialog" aria-modal="true" aria-labelledby="product-chooser-title">
        <button className="public-icon-button absolute right-4 top-4" onClick={close} aria-label="Close"><X /></button>
        <p className="public-eyebrow">MARK8BOT PRODUCTS</p>
        <h2 id="product-chooser-title">What would you like to use?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a className="public-choice public-choice-promotion" href={config?.promotion.downloadUrl ?? "/download"}>
            <span className="public-choice-icon"><Send /></span><Status kind="live" />
            <strong>Telegram Promotion</strong><span>Organize and automate your Telegram promotion workflow.</span>
          </a>
          <button className="public-choice public-choice-mark text-left" onClick={() => { close(); showMark(); }}>
            <span className="public-choice-icon"><BrainCircuit /></span>
            <strong>MARK</strong><span>Intelligence built around your business.</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function PublicHeader({ showChooser, showMark }: { showChooser: () => void; showMark: () => void }) {
  const [mobile, setMobile] = useState(false);
  const [products, setProducts] = useState(false);
  return (
    <header className="public-header">
      <div className="public-container flex h-18 items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-3 font-semibold tracking-tight"><BrandMark compact /><span>MARK8BOT</span></a>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          <div className="relative">
            <button className="public-nav-link" onClick={() => setProducts((value) => !value)} aria-expanded={products}>Products <ChevronDown /></button>
            {products ? <div className="public-dropdown">
              <a href="/promotion"><span className="public-mini-icon promotion"><Send /></span><span><strong>Telegram Promotion</strong><small>Organize and automate your workflow.</small></span><Status kind="live" /></a>
              <button onClick={showMark}><span className="public-mini-icon mark"><BrainCircuit /></span><span><strong>MARK</strong><small>Intelligence built around your business.</small></span></button>
            </div> : null}
          </div>
          {nav.slice(1).map(([label, href]) => <a className="public-nav-link" key={label} href={href}>{label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <button className="public-button public-button-primary hidden sm:inline-flex" onClick={showChooser}>Get Started <ArrowRight /></button>
          <button className="public-icon-button lg:hidden" onClick={() => setMobile((value) => !value)} aria-label="Toggle menu" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile ? <nav className="public-mobile-nav" aria-label="Mobile navigation">
        <a href="/promotion">Telegram Promotion <Status kind="live" /></a>
        <button onClick={showMark}>MARK</button>
        {nav.slice(1).map(([label, href]) => <a key={label} href={href}>{label}</a>)}
        <button className="public-button public-button-primary" onClick={showChooser}>Get Started</button>
      </nav> : null}
    </header>
  );
}

function PublicFooter({ config }: { config: PublicConfig | null }) {
  const telegramUrl = config?.support.telegramUrl ?? supportUrl;
  const telegramUsername = config?.support.telegramUsername ?? supportUsername;
  return <footer className="public-footer"><div className="public-container grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
    <div><a href="/" className="flex items-center gap-3 text-lg font-semibold"><BrandMark compact /> MARK8BOT</a><p>Intelligent products built for Telegram.</p><a className="public-support-link" href={telegramUrl} target="_blank" rel="noreferrer">@{telegramUsername}</a></div>
    <FooterGroup title="Products" links={[["Telegram Promotion", "/promotion"], ["Download", "/download"], ["Web App", "/promotion/app"], ["MARK", "/mark"]]} />
    <FooterGroup title="Company" links={[["About", "/about"], ["Contact", "/contact"]]} />
    <FooterGroup title="Resources" links={[["Guides", "/guides"], ["FAQ", "/faq"], ["Support", "/contact"]]} />
    <FooterGroup title="Legal" links={[["Privacy", "/privacy"], ["Terms", "/terms"], ["Acceptable Use", "/acceptable-use"], ["Security", "/security"]]} />
  </div><div className="public-container public-footer-base"><span>(c) {new Date().getFullYear()} MARK8BOT</span><span>Telegram-first software and automation.</span></div></footer>;
}

function FooterGroup({ title, links }: { title: string; links: string[][] }) {
  return <div><h3>{title}</h3>{links.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</div>;
}

function MarketingShell({ children }: { children: (actions: { showMark: () => void; showChooser: () => void; config: PublicConfig | null }) => ReactNode }) {
  const config = usePublicConfig();
  const [mark, setMark] = useState(false);
  const [chooser, setChooser] = useState(false);
  const showMark = () => setMark(true);
  const showChooser = () => setChooser(true);
  return <div className="public-site dark">
    <PublicHeader showChooser={showChooser} showMark={showMark} />
    <main>{children({ showMark, showChooser, config })}</main>
    <PublicFooter config={config} />
    <FloatingAssistant config={websiteAssistant} />
    <ComingSoonModal open={mark} close={() => setMark(false)} />
    <ProductChooser open={chooser} close={() => setChooser(false)} config={config} showMark={showMark} />
  </div>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="public-section-heading"><p className="public-eyebrow">{eyebrow}</p><h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div>;
}

function RichIcon({ icon: Icon }: { icon: LucideIcon }) { return <Icon />; }

function PlatformAccessSection({ config, compact = false }: { config: PublicConfig | null; compact?: boolean }) {
  const webAppUrl = config?.promotion.webAppUrl ?? "/promotion/app";
  const downloadUrl = config?.promotion.downloadUrl ?? "/download";
  const botUrl = config?.promotion.botUrl ?? "/guides/promotion";
  return (
    <section className={compact ? "public-section public-section-alt" : "public-section"}>
      <div className="public-container">
        <SectionHeading
          eyebrow="MULTI-PLATFORM ACCESS"
          title="Use Telegram Promotion anywhere"
          copy="Android, iPhone, browser, and Telegram entry points all open the same Promotion workspace and account data."
        />
        <div className="platform-access-grid">
          <a className="platform-access-card platform-android" href={downloadUrl}>
            <span><Smartphone /></span>
            <small>Android</small>
            <strong>Download Android App</strong>
            <p>Use the native Android shell for the same Promotion workspace.</p>
          </a>
          <a className="platform-access-card" href={webAppUrl}>
            <span><MonitorSmartphone /></span>
            <small>iPhone</small>
            <strong>Open Web App</strong>
            <p>Use Safari and add it to your Home Screen where supported.</p>
          </a>
          <a className="platform-access-card" href={webAppUrl}>
            <span><Globe2 /></span>
            <small>Browser</small>
            <strong>Open Web App</strong>
            <p>Sign in from mobile or desktop without Telegram WebView context.</p>
          </a>
          <a className="platform-access-card" href={botUrl} target={config?.promotion.botUrl ? "_blank" : undefined} rel="noreferrer">
            <span><Send /></span>
            <small>Telegram</small>
            <strong>Open in Telegram</strong>
            <p>Keep using the bot and Mini App session handoff.</p>
          </a>
        </div>
      </div>
    </section>
  );
}

const previewMetrics = [
  [Bot, "Sessions", "Health, Premium and reconnect state"],
  [FolderCheck, "Groups", "Found, approved, joined and categorized"],
  [Send, "Campaigns", "DM and group workflows stay separate"],
] as const;

const audiencePreviewItems: readonly [LucideIcon, string][] = [
  [Search, "Find Groups"],
  [FolderCheck, "Approved Groups"],
  [Tags, "Categories"],
  [Users, "Find Users"],
];

function ProductFrame({ kind = "promotion", mode = "overview" }: { kind?: "promotion" | "mark"; mode?: "overview" | "campaigns" | "audience" | "sessions" | "analytics" | "growth" | "activity" }) {
  if (kind === "mark") {
    return <div className="product-frame mark" aria-label="MARK concept preview">
      <div className="product-frame-bar"><i /><i /><i /><span>MARK intelligence workspace</span></div>
      <div className="mark-concept"><div className="mark-core"><BrainCircuit /><strong>MARK</strong></div><div className="mark-node n1">Knowledge</div><div className="mark-node n2">Instructions</div><div className="mark-node n3">Context</div><div className="mark-node n4">Memory</div><p>Intelligence built around your business</p></div>
    </div>;
  }
  return <div className="product-frame product-frame-real" aria-label={`${mode} Telegram Promotion interface preview`}>
    <div className="product-frame-bar"><i /><i /><i /><span>Telegram Promotion workspace</span></div>
    <div className="preview-shell">
      <aside className="preview-nav">
        <BrandMark compact />
        {[
          [BarChart3, "Overview"],
          [Send, "Campaigns"],
          [Users, "Groups"],
          [Bot, "Sessions"],
          [Gauge, "Growth"],
        ].map(([Icon, label], index) => <span key={String(label)} className={index === 0 ? "active" : ""}><RichIcon icon={Icon as LucideIcon} /><em>{String(label)}</em></span>)}
      </aside>
      <section>
        <div className="preview-head"><div><strong>{previewTitle(mode)}</strong><small>{previewSubtitle(mode)}</small></div><b>LIVE</b></div>
        {mode === "campaigns" ? <CampaignPreview /> : mode === "audience" ? <AudiencePreview /> : mode === "sessions" ? <SessionsPreview /> : mode === "analytics" ? <AnalyticsPreview /> : mode === "growth" ? <GrowthPreview /> : mode === "activity" ? <ActivityPreview /> : <OverviewPreview />}
      </section>
    </div>
  </div>;
}

function previewTitle(mode: string) {
  return ({ campaigns: "Campaign Operations", audience: "Audience Workspace", sessions: "Connected Sessions", analytics: "Analytics", growth: "Growth Intelligence", activity: "Recent Activity", overview: "Operational Overview" } as Record<string, string>)[mode] ?? "Operational Overview";
}

function previewSubtitle(mode: string) {
  return ({ campaigns: "Direct users and groups stay distinct", audience: "Discover, approve, join and categorize", sessions: "Health and reconnect visibility", analytics: "Structured reporting from stored data", growth: "Telegram-derived growth views", activity: "Status history without customer data", overview: "A unified Promotion dashboard" } as Record<string, string>)[mode] ?? "A unified Promotion dashboard";
}

function OverviewPreview() {
  return <><div className="preview-metrics">{previewMetrics.map(([Icon, label, detail]) => <article key={label}><Icon /><span>{label}</span><small>{detail}</small></article>)}</div><div className="preview-dashboard-grid"><div className="preview-line-chart"><svg viewBox="0 0 220 92" aria-hidden="true"><path d="M8 76 C42 62 48 35 78 44 S126 86 154 45 190 28 212 18" /><path d="M8 84 C46 76 62 62 91 65 S128 76 160 54 194 51 214 39" /></svg></div><div className="preview-mini-table"><p><span>Category</span><b>Status</b></p><p><span>Approved</span><b>Ready</b></p><p><span>Writable</span><b>Checked</b></p><p><span>Growth</span><b>Updated</b></p></div></div><PreviewRows rows={["Campaign ready for review", "Writable groups verified", "Growth collection updated"]} /></>;
}

function CampaignPreview() {
  return <><div className="preview-choice-grid"><article><Send /><strong>Direct Users</strong><span>Create DM Promotion workflow</span></article><article><RadioTower /><strong>Groups</strong><span>Create Group Promotion workflow</span></article></div><div className="preview-pills"><span>All</span><span>DM</span><span>Group</span><span>Active</span></div><PreviewRows rows={["DM campaign configured", "Group campaign processing", "Campaign history available"]} /></>;
}

function AudiencePreview() {
  return <><div className="preview-feature-grid">{audiencePreviewItems.map(([Icon,label])=><article key={label}><Icon /><span>{label}</span></article>)}</div><PreviewRows rows={["Discovery keywords prepared", "Found groups waiting review", "Joined groups synced"]} /></>;
}

function SessionsPreview() {
  return <><div className="preview-session"><Bot /><div><strong>Selected Telegram account</strong><span>Connected - Healthy - Premium visible when available</span></div><b>OK</b></div><PreviewRows rows={["Reconnect state is visible", "Session access checks support workflows", "Selected session remains under customer control"]} /></>;
}

function AnalyticsPreview() {
  return <><div className="preview-analytics"><div className="donut" /><div><strong>Campaign reporting</strong><span>Success, failure, delivery status and history views use existing product data.</span></div></div><div className="preview-chart area"><b /><b /><b /><b /><b /><b /></div></>;
}

function GrowthPreview() {
  return <><div className="preview-metrics compact"><article><Users /><span>Current Members</span><small>Real Telegram counts where available</small></article><article><Activity /><span>Joins / Leaves</span><small>Persisted membership events</small></article></div><div className="preview-chart growth"><b /><b /><b /><b /><b /><b /></div><PreviewRows rows={["Health score uses real components", "Coverage explains unavailable metrics", "Recent joins and leaves stay paginated"]} /></>;
}

function ActivityPreview() {
  return <><PreviewRows rows={["Telegram session checked", "Group discovery job completed", "Invoice status synchronized", "Growth snapshot stored"]} /><div className="preview-timeline"><span /><span /><span /><span /></div></>;
}

function PreviewRows({ rows }: { rows: string[] }) {
  return <div className="preview-rows">{rows.map((row) => <p key={row}><Check />{row}</p>)}</div>;
}

const promotionCapabilities = [
  [Compass, "Discover relevant communities", "Bring group and audience research into the same workspace used to prepare operations."],
  [Layers3, "Organize targets", "Move found communities through approval, joining and category workflows without losing context."],
  [Send, "Operate campaigns", "Keep DM and group promotion workflows separate, controllable and visible through their full lifecycle."],
  [BarChart3, "Analyze outcomes", "Review campaign history, analytics and Telegram-derived growth intelligence in structured views."],
  [ShieldCheck, "Stay in control", "Select sessions, targets and actions while the workspace respects permissions, health and Telegram limits."],
  [WalletCards, "Manage product access", "Access plans, payments, credits, Coins, referrals and preferences from one customer workspace."],
] as const;

function HomePage() {
  return <MarketingShell>{({ showChooser, showMark, config }) => <>
    <section className="public-hero"><div className="public-container public-hero-grid">
      <div><p className="public-eyebrow">TELEGRAM-FIRST SOFTWARE</p><h1>MARK8BOT <span>Promotion Command Center</span></h1><p className="public-lead">Run Telegram promotion from a polished workspace built for sessions, groups, audiences, campaigns, billing, Analytics and Growth Intelligence, with MARK kept as a separate intelligence product.</p><div className="public-actions"><button className="public-button public-button-primary" onClick={showChooser}>Explore Products <ArrowRight /></button><a className="public-button public-button-secondary" href="/guides/promotion">How Telegram Promotion Works</a></div><div className="hero-product-strip"><span>Find Groups</span><span>DM Campaigns</span><span>Group Campaigns</span><span>Session Health</span><span>Growth Intelligence</span><span>Add Users</span></div><div className="public-trust-strip"><span><Check /> Telegram Promotion is live</span><span><Sparkles /> MARK is being built separately</span><span><ShieldCheck /> Customer-controlled workflows</span></div></div>
      <div className="hero-composition"><ProductFrame mode="overview" /><div className="hero-mark-card"><div className="public-mark-symbol"><BrainCircuit /></div><strong>MARK</strong><span>Intelligence built around your business.</span><button onClick={showMark}>Start MARK</button></div></div>
    </div></section>
    <section className="public-section" id="products"><div className="public-container"><SectionHeading eyebrow="OUR PRODUCTS" title="Two products with separate product boundaries." copy="Telegram Promotion is live today. MARK is the separate intelligence product built around business context." />
      <article className="product-story promotion-story"><div><Status kind="live" /><p className="public-eyebrow">TELEGRAM PROMOTION</p><h2>Turn Telegram promotion into an organized workflow.</h2><p>Connect sessions, discover audiences, organize groups, prepare campaigns, review history and analyze growth from one Telegram-first workspace.</p><div className="public-actions"><a href="/promotion" className="public-button public-button-primary">Explore Telegram Promotion <ArrowRight /></a><a href="/download" className="public-button public-button-secondary">Choose Platform</a></div></div><ProductFrame mode="campaigns" /></article>
      <article className="product-story mark-story"><ProductFrame kind="mark" /><div><p className="public-eyebrow">MARK</p><h2>Meet MARK.</h2><p className="public-lead-sm">Your business has context. MARK understands it.</p><p>MARK is being designed as an intelligent Telegram assistant shaped by business knowledge, owner-defined instructions and conversation context.</p><div className="public-actions"><a href="/mark" className="public-button public-button-mark">Meet MARK <ArrowRight /></a><button onClick={showMark} className="public-button public-button-secondary">Start MARK</button></div></div></article>
    </div></section>
    <PromotionDeepDive />
    <PreviewShowcase />
    <PlatformAccessSection config={config} compact />
    <AssistantMarketing />
    <HowToUse />
    <HomeFaq />
    <SupportBand config={config} />
    <AboutBand />
    <section className="public-section public-section-alt" id="solutions"><div className="public-container"><SectionHeading eyebrow="SOLUTIONS" title="Software for repeatable Telegram operations." /><div className="solution-grid">{[[Search,"Audience Growth","Discover and prepare relevant audiences."],[Zap,"Campaign Operations","Keep repeatable promotion workflows organized."],[BarChart3,"Community Intelligence","Use real activity and growth data where Telegram exposes it."],[Network,"Workflow Automation","Keep Telegram operations close to the conversations they support."],[MessageCircle,"Business Communication","Prepare for context-aware assistance with MARK."],[BrainCircuit,"Future Intelligence","AI-assisted Telegram operations are planned for MARK."]].map(([Icon,title,copy], index)=><article key={String(title)}><span><RichIcon icon={Icon as LucideIcon} /></span><small>{index===5?"MARK":"MARK8BOT"}</small><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</div></div></section>
    <section className="public-section final-cta"><div className="public-container"><h2>Move the repeatable parts of Telegram promotion into one workspace.</h2><p>Start with Telegram Promotion today, then follow MARK as the intelligence product develops.</p><div className="public-actions"><button className="public-button public-button-primary" onClick={showChooser}>Get Started <ArrowRight /></button><a className="public-button public-button-secondary" href={supportUrl} target="_blank" rel="noreferrer">Support @{supportUsername}</a></div></div></section>
  </>}</MarketingShell>;
}

function AssistantMarketing() {
  return <section className="public-section public-section-alt"><div className="public-container split-copy"><div><SectionHeading eyebrow="ASSISTED PRODUCT HELP" title="Meet MARK8LARA and LARA." copy="Two helpers, two product contexts, no mixed answers." /></div><div className="assistant-marketing-grid"><article><MessageCircle /><h3>MARK8LARA</h3><p>MARK8LARA is the public website guide for MARK8BOT, Telegram Promotion, MARK, navigation, plans, guides and support. It answers questions but does not perform tasks.</p></article><article><Mic /><h3>LARA</h3><p>Meet LARA - your in-workspace Promotion assistant. LARA currently guides customers through Promotion pages and feature questions. Voice-driven workflow control is planned for the future.</p></article></div></div></section>;
}

function PromotionDeepDive() {
  return <section className="public-section public-section-alt"><div className="public-container"><SectionHeading eyebrow="TELEGRAM PROMOTION" title="Built around the work operators repeat every day." copy="The live product is organized around the actual Telegram promotion workflow: connect, discover, organize, campaign, analyze and improve." />
    <div className="deep-grid">
      <article><Bot /><h3>Sessions and health</h3><p>Link Telegram sessions, verify access and keep reconnect or Premium state visible before operational work begins.</p></article>
      <article><Search /><h3>Audience and groups</h3><p>Use discovery, found groups, approved groups, joined groups, categories and Find Users to prepare the right targets.</p></article>
      <article><Send /><h3>Campaign workflows</h3><p>Create DM Promotion and Group Promotion separately so each flow keeps its own validation, history and status controls.</p></article>
      <article><Gauge /><h3>Analytics and growth</h3><p>Review campaign activity and Growth Intelligence from stored snapshots and Telegram data available to authorized sessions.</p></article>
    </div>
  </div></section>;
}

function PreviewShowcase() {
  const previews = [
    ["Audience / Groups / Categories", "Discovery, approval, joining and categories are presented as one connected audience workspace.", "audience"],
    ["Campaigns", "DM and group promotion remain separate while campaign management and history stay visible.", "campaigns"],
    ["Sessions", "Session health, reconnect state and account context are operationally visible.", "sessions"],
    ["Analytics + Growth Intelligence", "Reporting uses stored product data and Telegram-derived growth signals where available.", "growth"],
  ] as const;
  return <section className="public-section"><div className="public-container"><SectionHeading eyebrow="PROMOTION PREVIEWS" title="Real-feature interface previews, not empty mockups." copy="These previews show the product areas customers actually use. They do not call production APIs or expose customer data." /><div className="showcase-grid">{previews.map(([title, copy, mode]) => <article key={title}><ProductFrame mode={mode} /><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></div></section>;
}

function HowToUse() {
  return <section className="public-section public-section-alt"><div className="public-container split-copy"><div><SectionHeading eyebrow="HOW TO USE TELEGRAM PROMOTION" title="A practical path from account access to reporting." copy="The guide expands this journey with more detail for new customers." /><a className="public-button public-button-primary" href="/guides/promotion">Open Full Guide <ArrowRight /></a></div><div className="how-list">{[["Register / Login","Use the Promotion bot to create or access your account."],["Connect Telegram","Link and check the session used for supported operations."],["Discover","Find relevant groups and audiences."],["Organize","Approve, join and categorize targets before campaigns."],["Campaign","Create DM or Group Promotion using the existing workflow."],["Monitor","Review status, jobs, history and operational results."],["Analyze / Improve","Use Analytics and Growth Intelligence to refine decisions."]].map(([title,copy],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></div></section>;
}

function HomeFaq() {
  return <section className="public-section"><div className="public-container"><SectionHeading eyebrow="QUICK FAQ" title="Important answers before you start." /><div className="faq-list compact">{homeFaqs.map(([q,a])=><details key={q}><summary><span>{q}</span><ChevronDown/></summary><p>{a}</p></details>)}</div><a className="public-button public-button-secondary mt-6" href="/faq">View Full FAQ <ArrowRight /></a></div></section>;
}

function SupportBand({ config }: { config: PublicConfig | null }) {
  const username = config?.support.telegramUsername ?? supportUsername;
  const url = config?.support.telegramUrl ?? supportUrl;
  return <section className="public-section public-section-alt support-band"><div className="public-container"><div><p className="public-eyebrow">SUPPORT</p><h2>Official support is on Telegram.</h2><p>For product questions, account help, technical assistance or business inquiries, contact the configured MARK8BOT support channel.</p></div><a className="public-button public-button-primary" href={url} target="_blank" rel="noreferrer">@{username} <ExternalLink /></a></div></section>;
}

function AboutBand() {
  return <section className="public-section"><div className="public-container split-copy"><div><SectionHeading eyebrow="ABOUT MARK8BOT" title="Telegram-first software for automation, organization and intelligence." /></div><div><p>MARK8BOT builds products that keep software close to Telegram conversations and operations. Telegram Promotion handles the live operational workspace today. MARK is being built as the separate intelligence product for future business-aware assistance.</p><div className="principle-row"><span><Zap /> Automate</span><span><Layers3 /> Organize</span><span><BrainCircuit /> Understand</span></div></div></div></section>;
}

function PromotionPage() {
  const [tab, setTab] = useState("Home");
  const selectedMode = tab === "Home" ? "overview" : tab.toLowerCase() as "campaigns" | "audience" | "sessions" | "analytics" | "growth";
  return <MarketingShell>{({ config }) => <>
    <PageHero eyebrow="TELEGRAM PROMOTION" status="live" title="One workspace for the Telegram promotion work you repeat." copy="Discover, organize, promote and analyze from a Telegram-first workspace while keeping control of sessions, audiences, campaigns and decisions." actions={<><a className="public-button public-button-primary" href={config?.promotion.downloadUrl ?? "/download"}>Choose Platform <ArrowRight /></a><a className="public-button public-button-secondary" href={config?.promotion.webAppUrl ?? "/promotion/app"}>Open Web App</a>{config?.promotion.botUrl ? <a className="public-button public-button-secondary" href={config.promotion.botUrl} target="_blank" rel="noreferrer">Open in Telegram <ExternalLink /></a> : null}</>} visual={<ProductFrame mode="overview" />} />
    <PlatformAccessSection config={config} />
    <section className="public-section"><div className="public-container"><SectionHeading eyebrow="WHAT IT SOLVES" title="Move the workflow out of scattered chats and manual notes." copy="Telegram Promotion brings research, operational preparation, execution history and reporting into a consistent customer workspace." /><div className="capability-grid">{promotionCapabilities.map(([Icon,title,copy])=><article key={title}><span><RichIcon icon={Icon} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <Workflow title="Connect, discover, organize, campaign, analyze, improve." steps={[["CONNECT","Connect the Telegram sessions used by your workspace."],["DISCOVER","Find relevant communities and audiences."],["ORGANIZE","Approve, categorize and prepare targets."],["CAMPAIGN","Prepare and operate supported promotion workflows."],["ANALYZE","Review history, performance and growth intelligence."],["IMPROVE","Use reporting to refine the next operational decision."]]} />
    <section className="public-section public-section-alt"><div className="public-container"><SectionHeading eyebrow="SEE IT IN ACTION" title="A workspace organized around real operations." copy="These interface previews mirror live product areas without using customer data or invented metrics." /><div className="public-tabs" role="tablist">{["Home","Campaigns","Audience","Sessions","Analytics","Growth"].map((item)=><button role="tab" aria-selected={tab===item} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><ProductFrame mode={selectedMode} /><p className="public-preview-note">{tab} workspace preview. Customer information and metrics are intentionally omitted.</p></div></section>
    <section className="public-section"><div className="public-container split-copy"><div><SectionHeading eyebrow="BUILT FOR CONTROL" title="Automation supports the operator. It does not bypass Telegram." /><p>Customers choose connected accounts, audiences, destinations and campaign actions. Session health, permissions, writable/sendable checks and Telegram responses remain visible throughout supported workflows.</p></div><div className="public-check-list">{["Separate DM and group campaign workflows","Connected-session health and reconnect status","Group discovery, approval, joining and categories","Campaign history and operational status","Analytics and Telegram-derived Growth Intelligence","Plans, billing, referral Coins and Add Users credits"].map(x=><span key={x}><Check />{x}</span>)}</div></div></section>
  </>}</MarketingShell>;
}

function DownloadPage() {
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  useEffect(() => {
    const agent = navigator.userAgent.toLowerCase();
    if (agent.includes("android")) setPlatform("android");
    else if (/iphone|ipad|ipod/.test(agent)) setPlatform("ios");
  }, []);

  return <MarketingShell>{({ config }) => {
    const android = config?.promotion.android;
    const webAppUrl = config?.promotion.webAppUrl ?? "/promotion/app";
    const botUrl = config?.promotion.botUrl ?? "/guides/promotion";
    const apkReady = Boolean(android?.releaseApkAvailable);
    return <>
      <PageHero
        eyebrow="TELEGRAM PROMOTION ACCESS"
        status="live"
        title="Choose how you want to use Telegram Promotion."
        copy="Android, browser, iPhone Safari/PWA, and Telegram all use the same MARK8BOT customer account, campaigns, audiences, sessions, billing, and product data."
        actions={<><a className="public-button public-button-primary" href={webAppUrl}>Open Web App <ArrowRight /></a><a className="public-button public-button-secondary" href={botUrl} target={config?.promotion.botUrl ? "_blank" : undefined} rel="noreferrer">Open in Telegram <ExternalLink /></a></>}
        visual={<ProductFrame mode="overview" />}
      />
      <section className="public-section"><div className="public-container download-layout">
        <div>
          <SectionHeading eyebrow="PLATFORM OPTIONS" title={platform === "android" ? "Android app and web access" : platform === "ios" ? "iPhone web app access" : "Use the app from any supported device"} copy="Platform detection changes the order shown here only. It never blocks access." />
          <div className="download-option-list">
            <article className={platform === "android" ? "highlight" : ""}>
              <span><Smartphone /></span>
              <div>
                <h3>Android</h3>
                <p>Use the Capacitor Android app shell when a signed APK is available. Until signing is configured, use the Web App button.</p>
                <div className="public-actions">
                  {apkReady && android ? <a className="public-button public-button-primary" href={android.apkPath} download>Download Android App <Download /></a> : <button className="public-button public-button-secondary" type="button" disabled>Signed APK pending</button>}
                  <a className="public-button public-button-secondary" href={webAppUrl}>Open Web App</a>
                </div>
              </div>
            </article>
            <article className={platform === "ios" ? "highlight" : ""}>
              <span><MonitorSmartphone /></span>
              <div>
                <h3>iPhone</h3>
                <p>Open the Web App in Safari. iOS installation is available through Safari's Add to Home Screen flow where supported.</p>
                <div className="public-actions"><a className="public-button public-button-primary" href={webAppUrl}>Open Web App <ArrowRight /></a></div>
              </div>
            </article>
            <article>
              <span><Globe2 /></span>
              <div>
                <h3>Browser</h3>
                <p>Use Chrome, Safari, Edge, or a compatible mobile browser with direct login/register.</p>
                <div className="public-actions"><a className="public-button public-button-primary" href={webAppUrl}>Open Web App <ArrowRight /></a></div>
              </div>
            </article>
            <article>
              <span><Send /></span>
              <div>
                <h3>Telegram</h3>
                <p>Use the existing Promotion bot and Mini App handoff. Bot sessions continue to open the same workspace.</p>
                <div className="public-actions"><a className="public-button public-button-primary" href={botUrl} target={config?.promotion.botUrl ? "_blank" : undefined} rel="noreferrer">Open in Telegram <ExternalLink /></a></div>
              </div>
            </article>
          </div>
        </div>
        <aside className="download-release-panel">
          <p className="public-eyebrow">CURRENT ANDROID BUILD</p>
          <dl>
            <div><dt>Version</dt><dd>{android?.versionName ?? "Not available"}</dd></div>
            <div><dt>Version code</dt><dd>{android?.versionCode ?? "Not available"}</dd></div>
            <div><dt>Release date</dt><dd>{android?.releaseDate ?? "Pending signed release"}</dd></div>
            <div><dt>Minimum Android</dt><dd>{android?.minAndroid ?? "Not available"}</dd></div>
            <div><dt>APK size</dt><dd>{android?.apkSizeLabel ?? "Pending artifact"}</dd></div>
          </dl>
          <p>APK distribution will use the official MARK8BOT website after release signing is configured. Private signing keys are not stored in this repository.</p>
        </aside>
      </div></section>
    </>;
  }}</MarketingShell>;
}

function MarkPage({ app = false }: { app?: boolean }) {
  if (app) return <MarketingShell>{() => <ComingSoonPage />}</MarketingShell>;
  return <MarketingShell>{({ showMark }) => <>
    <PageHero eyebrow="MARK" title="MARK - Intelligence built around your business." copy="MARK is designed as an intelligent Telegram assistant shaped by owner-supplied knowledge, instructions and conversation context." actions={<><button className="public-button public-button-mark" onClick={showMark}>Start MARK</button><a className="public-button public-button-secondary" href="/guides/mark">How MARK Works</a></>} visual={<ProductFrame kind="mark" />} />
    <section className="public-section"><div className="public-container"><SectionHeading eyebrow="THE INTELLIGENCE LAYER" title="Not another rigid scripted chatbot." copy="MARK is presented as a configurable layer between what your business knows, how you want it to communicate and the Telegram conversations where assistance is useful." /><div className="mark-model"><span>Your Business</span><ArrowRight /><span>Business Knowledge</span><ArrowRight /><strong>MARK</strong><div className="mark-branches"><i>Memory</i><i>Rules</i><i>Context</i></div><ArrowRight /><span>Conversations</span><ArrowRight /><span>Future Automation</span></div></div></section>
    <Workflow title="How MARK works" steps={[["TEACH","Tell MARK about your business."],["CONFIGURE","Set instructions, communication preferences and behavior."],["CONNECT","Connect MARK with a supported Telegram workflow."],["ASSIST","MARK uses configured context to assist conversations."],["IMPROVE","Update knowledge and instructions as the business evolves."]]} />
    <section className="public-section public-section-alt"><div className="public-container"><SectionHeading eyebrow="CAPABILITIES" title="Intelligence shaped by the owner." /><div className="capability-grid">{[[BrainCircuit,"Business Knowledge","Information supplied by the owner about products, services and operations."],[ShieldCheck,"Custom Instructions","Owner-defined communication behavior and response guidance."],[Layers3,"Memory & Context","Relevant context intended to keep supported conversations coherent."],[MessageCircle,"DM Assistance","Assistance direction for supported direct-message conversations."],[Users,"Group Assistance","Participation direction where MARK is configured and permitted."],[Sparkles,"Multilingual Communication","Designed for businesses communicating across languages."],[CircleHelp,"General Intelligence","Business-relevant help beyond rigid scripted replies."],[Network,"Owner Control","Instructions and configuration remain controlled by the business owner."]].map(([Icon,title,copy])=><article key={String(title)}><span><RichIcon icon={Icon as LucideIcon} /></span><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</div></div></section>
  </>}</MarketingShell>;
}

function ComingSoonPage() { return <section className="public-standalone"><div className="public-mark-symbol"><BrainCircuit /></div><Status kind="soon" /><p className="public-eyebrow">MARK - INTELLIGENCE FOR TELEGRAM</p><h1>The MARK Intelligence workspace is currently in development.</h1><p>MARK is being designed to understand your business context, follow your instructions and assist with Telegram conversations and workflows.</p><div className="public-actions"><a href="/mark" className="public-button public-button-mark">Learn About MARK</a><a href="/guides/mark" className="public-button public-button-secondary">How MARK Will Work</a></div></section>; }

function PageHero({ eyebrow, status, title, copy, actions, visual }: { eyebrow: string; status?: "live" | "soon"; title: string; copy: string; actions?: ReactNode; visual?: ReactNode }) {
  return <section className="public-page-hero"><div className="public-container public-hero-grid"><div>{status ? <Status kind={status} /> : null}<p className="public-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="public-lead">{copy}</p>{actions ? <div className="public-actions">{actions}</div> : null}</div>{visual ? <div>{visual}</div> : null}</div></section>;
}

function Workflow({ title, steps, planned = false }: { title: string; steps: string[][]; planned?: boolean }) {
  return <section className="public-section workflow-section"><div className="public-container"><SectionHeading eyebrow={planned ? "PLANNED EXPERIENCE" : "HOW IT WORKS"} title={title} /><div className="workflow-grid">{steps.map(([name,copy],index)=><article key={name}><span>{String(index+1).padStart(2,"0")}</span><h3>{name}</h3><p>{copy}</p>{index<steps.length-1?<ArrowRight />:null}</article>)}</div></div></section>;
}

const guidePromotion = [["Register","Create the customer account through the Promotion bot."],["Login","Authenticate through the bot and use its fresh Mini App button."],["Open the Mini App","Enter the live Promotion workspace using the secure session handoff."],["Connect Telegram","Link and check the Telegram session used for supported operations."],["Discover and organize","Find groups, review found results, approve, join and categorize relevant destinations."],["Prepare audiences","Use Find Users and DM Audience filters where supported."],["Create campaigns","Open the separate DM or Group Promotion workflow and configure the real campaign."],["Operate and review","Monitor status, pause/resume where supported and review campaign history."],["Analyze growth","Use Analytics and Growth Intelligence for real stored and Telegram-exposed data."],["Manage the product","Review plans, billing, Coins, credits, referrals and settings."],["Get support","Contact official support on Telegram at @laura_luxee when you need help."]];

function GuidesPage() { return <MarketingShell>{()=><><PageHero eyebrow="GUIDES" title="Understand each product before you begin." copy="Practical product journeys for the live Telegram Promotion workspace and the planned MARK experience." /><section className="public-section"><div className="public-container grid gap-5 lg:grid-cols-2"><GuideCard product="Telegram Promotion" live href="/guides/promotion" copy="From bot registration and session connection through discovery, campaigns, history and analytics." /><GuideCard product="MARK" href="/guides/mark" copy="A clear preview of how the planned knowledge, instruction and conversation workflow will operate." /></div></section></>}</MarketingShell>; }
function GuideCard({product,href,copy,live=false}:{product:string;href:string;copy:string;live?:boolean}){return <a href={href} className={`guide-card ${live?"promotion":"mark"}`}><div>{live?<Send/>:<BrainCircuit/>}{live?<Status kind="live"/>:null}</div><h2>{product}</h2><p>{copy}</p><span>Read the guide <ArrowRight/></span></a>}

function GuidePage({ mark = false }: { mark?: boolean }) { const steps=mark?[["Teach MARK","Supply accurate business knowledge."],["Configure instructions","Define communication style and behavior."],["Connect Telegram","Choose a supported Telegram workflow."],["Use conversations","MARK applies configured context in supported interactions."],["Manage knowledge","Review and update memory, knowledge and preferences."],["Improve over time","Refine configuration as the business evolves."],["Get support","Use @laura_luxee for official MARK8BOT support questions."]]:guidePromotion; return <MarketingShell>{()=><><PageHero eyebrow={mark?"MARK":"TELEGRAM PROMOTION - LIVE"} status={mark?undefined:"live"} title={mark?"How MARK works":"From bot registration to an organized promotion workflow."} copy={mark?"A practical introduction to MARK as intelligence built around business knowledge, instructions and context.":"A practical introduction to the current customer journey, based on the live product workflow."} /><section className="public-section"><div className="public-container guide-steps">{steps.map(([title,copy],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div></section></>}</MarketingShell>; }

function AboutPage(){return <MarketingShell>{()=><><PageHero eyebrow="ABOUT MARK8BOT" title="Useful automation should feel like part of the conversation, not another complicated system to manage." copy="MARK8BOT is a Telegram-first software ecosystem focused on practical operations today and contextual intelligence for the future." visual={<ProductFrame mode="activity" />} /><section className="public-section"><div className="public-container principle-grid">{[[Zap,"AUTOMATE","Reduce repetitive operational work."],[Layers3,"ORGANIZE","Bring Telegram operations into clear customer workspaces."],[BrainCircuit,"UNDERSTAND","Turn activity and context into useful intelligence."],[Network,"CONNECT","Keep tools close to the conversations where work happens."]].map(([Icon,title,copy])=><article key={String(title)}><RichIcon icon={Icon as LucideIcon}/><h2>{String(title)}</h2><p>{String(copy)}</p></article>)}</div></section><section className="public-section public-section-alt"><div className="public-container split-copy"><div><SectionHeading eyebrow="WHY TWO PRODUCTS" title="Focused products, connected by one philosophy." /></div><div><h3>Telegram Promotion</h3><p>Organizes repeatable audience, campaign and growth operations in a live Telegram Mini App.</p><h3 className="mt-8">MARK</h3><p>Is being designed as a separate intelligent assistant shaped by owner-supplied business context.</p><h3 className="mt-8">Support</h3><p>Official support is available on Telegram at <a href={supportUrl} target="_blank" rel="noreferrer">@{supportUsername}</a>.</p></div></div></section></>}</MarketingShell>}

const faqs = [
 ["MARK8BOT","What is MARK8BOT?","MARK8BOT is a Telegram-first software ecosystem. It currently offers Telegram Promotion and is developing MARK as a separate intelligent Telegram assistant."],
 ["MARK8BOT","What products does MARK8BOT offer?","Telegram Promotion is live. MARK is the separate intelligence product built around business context and does not yet have an operational bot or Mini App."],
 ["Telegram Promotion","What is Telegram Promotion?","A Telegram Mini App that organizes supported discovery, audience, campaign, history, analytics, billing and settings workflows."],
 ["Telegram Promotion","How does the Promotion workspace work?","Customers register or log in through the bot, connect permitted Telegram sessions, then use separate tools for discovery, organization, campaigns and reporting."],
 ["Telegram Promotion","What is a Telegram session?","A linked Telegram account connection used for permitted MTProto operations. Health and reconnect state remain visible to the customer."],
 ["Telegram Promotion","How does group discovery work?","Customers submit discovery criteria, review found groups, and move relevant results through approval, joining and categorization workflows."],
 ["Telegram Promotion","What is Growth Intelligence?","Reporting based only on real stored snapshots and Telegram data available to an authorized admin session. Unavailable metrics are not fabricated."],
 ["Telegram Promotion","What are campaigns?","Separate DM and group promotion workflows with configuration, persisted status, controls and history."],
 ["Account & Billing","How do plans and billing work?","Available plans, prices, invoices, payment status, credits and Coins are shown inside the live Billing workspace. The website does not invent pricing."],
 ["MARK","What is MARK?","MARK is a planned intelligent Telegram assistant designed around owner-supplied business knowledge, instructions and conversation context."],
 ["MARK","Is MARK operational now?","No operational MARK bot, automation or Mini App is active yet. Start/Open actions show the current access state, and no launch date or Telegram username has been announced."],
 ["MARK","How will MARK learn about my business?","The planned experience will let owners provide business knowledge and instructions, then refine them as the business evolves."],
 ["MARK","Will MARK support groups and multiple languages?","Group assistance and multilingual communication are planned capabilities. Exact launch scope will be confirmed before access opens."],
 ["MARK8BOT","Can I use both products?","They are designed as separate products. Telegram Promotion is available now; MARK access will be separate when it launches."],
 ["Privacy & Security","How is account access handled?","Promotion uses its existing bot login, short-lived session handoff and protected Mini App routes. Admin access remains separate and protected."],
 ["MARK8BOT","How do I get support?","Official support is available on Telegram at @laura_luxee: https://t.me/laura_luxee."],
] as const;

function FaqPage(){const [query,setQuery]=useState("");const [category,setCategory]=useState("All");const categories=["All",...new Set(faqs.map(x=>x[0]))];const shown=useMemo(()=>faqs.filter(([c,q,a])=>(category==="All"||c===category)&&`${q} ${a}`.toLowerCase().includes(query.toLowerCase())),[query,category]);return <MarketingShell>{()=><><PageHero eyebrow="FAQ" title="Answers about MARK8BOT and its products." copy="Search live product guidance, planned MARK capabilities, account topics and security information." /><section className="public-section"><div className="public-container"><div className="faq-tools"><label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search questions"/></label><div>{categories.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div></div><div className="faq-list">{shown.map(([c,q,a])=><details key={q}><summary><span><small>{c}</small>{q}</span><ChevronDown/></summary><p>{a}</p></details>)}</div></div></section></>}</MarketingShell>}

function ContactPage(){const config=usePublicConfig();const [product,setProduct]=useState("Telegram Promotion");const telegramUrl=config?.support.telegramUrl ?? supportUrl;const telegramUsername=config?.support.telegramUsername ?? supportUsername;function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);const subject=encodeURIComponent(`[${product}] ${String(data.get("topic")||"Website inquiry")}`);const body=encodeURIComponent(`Name: ${String(data.get("name")||"")}\nProduct: ${product}\n\n${String(data.get("message")||"")}`);if(config?.support.email)window.location.href=`mailto:${config.support.email}?subject=${subject}&body=${body}`;else window.open(telegramUrl,"_blank","noopener,noreferrer");}return <MarketingShell>{()=><><PageHero eyebrow="CONTACT" title="Talk to MARK8BOT." copy="Choose the product and describe what you need. Official support is available on Telegram at @laura_luxee." /><section className="public-section"><div className="public-container contact-grid"><form onSubmit={submit} className="public-form"><label>Name<input required name="name" autoComplete="name"/></label><label>Email<input required name="email" type="email" autoComplete="email"/></label><label>Product<select value={product} onChange={e=>setProduct(e.target.value)}><option>Telegram Promotion</option><option>MARK</option><option>General</option></select></label><label>Topic<input name="topic" placeholder="What can we help with?"/></label><label>Message<textarea required name="message" rows={6}/></label><button className="public-button public-button-primary">Continue to support <ArrowRight/></button><p className="form-note">This opens the configured support channel. Official Telegram support: @{telegramUsername}.</p></form><aside>{[[MessageCircle,"Customer Support","Help with the live Telegram Promotion workspace."],[Network,"Business Inquiries","Product and workflow questions for your organization."],[ShieldCheck,"Technical Assistance","Account, connection and operational troubleshooting." ],[CreditCard,"Billing Help","Questions about plans, invoices, Coins and credits." ]].map(([Icon,title,copy])=><article key={String(title)}><RichIcon icon={Icon as LucideIcon}/><h2>{String(title)}</h2><p>{String(copy)}</p></article>)}<a className="public-button public-button-secondary" href={telegramUrl} target="_blank" rel="noreferrer">Open @{telegramUsername} <ExternalLink /></a></aside></div></section></>}</MarketingShell>}

const legal:Record<string,{eyebrow:string;title:string;intro:string;sections:string[][]}>={
 privacy:{eyebrow:"PRIVACY",title:"Privacy overview",intro:"This baseline explains the product data categories and should be reviewed by qualified legal counsel before being treated as final legal advice.",sections:[["Information involved","MARK8BOT products may process account details, linked Telegram identifiers and sessions, customer-configured campaign data, analytics records, billing records and support communications."],["Telegram integrations","Telegram is a third-party service. Linked sessions and Telegram-derived data are used only for supported product operations and remain subject to Telegram availability, permissions and policies."],["MARK future processing","MARK is not live. Before launch, this notice must be updated with the actual model providers, retention, knowledge-processing and conversation-data practices."],["Choices and contact","Customers can manage available preferences in the product and contact support at @laura_luxee for account or data questions."]] },
 terms:{eyebrow:"TERMS",title:"Product terms baseline",intro:"These baseline terms describe intended product boundaries and require professional legal review before final publication.",sections:[["Service scope","Telegram Promotion provides supported workflow tools; MARK is presented as a separate intelligence product and is not currently offered as an operational service."],["Customer responsibility","Customers are responsible for account security, lawful content, configured audiences, Telegram permissions and compliance with platform rules."],["Third-party dependency","Service availability can depend on Telegram, payment networks, hosting providers and other configured integrations."],["Payments and changes","Live prices, plan limits, invoices and entitlements are presented inside the product. Applicable refund or cancellation policies should be confirmed in finalized commercial terms."]] },
 "acceptable-use":{eyebrow:"ACCEPTABLE USE",title:"Responsible Telegram automation",intro:"MARK8BOT products are intended for legitimate, permission-aware business and community workflows.",sections:[["Permitted use","Use the products for lawful discovery, organization, customer-authorized communication and supported campaign operations."],["Prohibited conduct","Do not use MARK8BOT to spam, harass, deceive, bypass Telegram restrictions, compromise accounts, distribute unlawful content or access data without permission."],["Rate and permission controls","Customers must respect Telegram limits, chat permissions, user privacy and all product safety controls."],["Enforcement","Access may be restricted when activity risks users, Telegram infrastructure, payment systems or the integrity of the platform."]] },
 security:{eyebrow:"SECURITY",title:"Security and trust",intro:"MARK8BOT uses layered application controls without claiming that any internet service is risk-free.",sections:[["Access boundaries","Promotion customer sessions, Supabase-backed admin authentication and operational APIs use separate access paths."],["Sensitive configuration","Bot tokens, service credentials, Telegram session material and encryption keys belong only in protected server configuration and must never be exposed in public clients."],["Operational safeguards","The live product includes session health, permission-aware workflows, bounded workers, error handling and audit-oriented persistence where implemented."],["Reporting concerns","Use @laura_luxee to report suspected security issues. Do not include passwords, bot tokens or raw Telegram sessions in reports."]] },
};

function LegalPage({kind}:{kind:"privacy"|"terms"|"acceptable-use"|"security"}){const page=legal[kind]!;return <MarketingShell>{()=><><PageHero eyebrow={page.eyebrow} title={page.title} copy={page.intro}/><section className="public-section"><article className="public-container legal-copy">{page.sections.map(([title,copy])=><section key={title}><h2>{title}</h2><p>{copy}</p></section>)}</article></section></>}</MarketingShell>}

export function PublicPage({ page }: { page: PageKind }) {
  if (page === "home") return <HomePage />;
  if (page === "promotion") return <PromotionPage />;
  if (page === "download") return <DownloadPage />;
  if (page === "mark") return <MarkPage />;
  if (page === "mark-app") return <MarkPage app />;
  if (page === "guides") return <GuidesPage />;
  if (page === "guide-promotion") return <GuidePage />;
  if (page === "guide-mark") return <GuidePage mark />;
  if (page === "about") return <AboutPage />;
  if (page === "faq") return <FaqPage />;
  if (page === "contact") return <ContactPage />;
  return <LegalPage kind={page} />;
}
