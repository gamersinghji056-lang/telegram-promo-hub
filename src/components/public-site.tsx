import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight, BarChart3, Bot, BrainCircuit, Check, ChevronDown, CircleHelp,
  Compass, ExternalLink, Layers3, Menu, MessageCircle, Network, Search,
  Send, ShieldCheck, Sparkles, Users, WalletCards, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getPublicProductConfig } from "@/lib/public-site.functions";

type PublicConfig = Awaited<ReturnType<typeof getPublicProductConfig>>;
type PageKind = "home" | "promotion" | "mark" | "guides" | "guide-promotion" | "guide-mark" | "about" | "faq" | "contact" | "privacy" | "terms" | "acceptable-use" | "security" | "mark-app";

export const PRODUCT_AVAILABILITY = {
  promotion: "live",
  mark: "coming_soon",
} as const;

const nav = [
  ["Solutions", "/#solutions"], ["Guides", "/guides"], ["About", "/about"],
  ["FAQ", "/faq"], ["Contact", "/contact"],
] as const;

function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => { getPublicProductConfig().then(setConfig).catch(() => setConfig(null)); }, []);
  return config;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-orbit ${compact ? "brand-orbit-sm" : ""}`} aria-hidden="true">
      <span className="brand-orbit-core"><Send /></span>
    </span>
  );
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
        <Status kind="soon" />
        <h2 id="mark-coming-soon-title">MARK</h2>
        <p className="public-kicker">Coming Soon</p>
        <p>We’re building MARK, an intelligent Telegram assistant designed around your business, instructions and conversations.</p>
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
          <a className="public-choice public-choice-promotion" href={config?.promotion.botUrl ?? "/promotion"} target={config?.promotion.botUrl ? "_blank" : undefined} rel="noreferrer">
            <span className="public-choice-icon"><Send /></span><Status kind="live" />
            <strong>Telegram Promotion</strong><span>Organize and automate your Telegram promotion workflow.</span>
          </a>
          <button className="public-choice public-choice-mark text-left" onClick={() => { close(); showMark(); }}>
            <span className="public-choice-icon"><BrainCircuit /></span><Status kind="soon" />
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
              <button onClick={showMark}><span className="public-mini-icon mark"><BrainCircuit /></span><span><strong>MARK</strong><small>Intelligence built around your business.</small></span><Status kind="soon" /></button>
            </div> : null}
          </div>
          {nav.map(([label, href]) => <a className="public-nav-link" key={label} href={href}>{label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <button className="public-button public-button-primary hidden sm:inline-flex" onClick={showChooser}>Get Started <ArrowRight /></button>
          <button className="public-icon-button lg:hidden" onClick={() => setMobile((value) => !value)} aria-label="Toggle menu" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile ? <nav className="public-mobile-nav" aria-label="Mobile navigation">
        <a href="/promotion">Telegram Promotion <Status kind="live" /></a>
        <button onClick={showMark}>MARK <Status kind="soon" /></button>
        {nav.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
        <button className="public-button public-button-primary" onClick={showChooser}>Get Started</button>
      </nav> : null}
    </header>
  );
}

function PublicFooter() {
  return <footer className="public-footer"><div className="public-container grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
    <div><a href="/" className="flex items-center gap-3 text-lg font-semibold"><BrandMark compact /> MARK8BOT</a><p>Intelligent products built for Telegram.</p></div>
    <FooterGroup title="Products" links={[["Telegram Promotion", "/promotion"], ["MARK — Coming Soon", "/mark"]]} />
    <FooterGroup title="Company" links={[["About", "/about"], ["Contact", "/contact"]]} />
    <FooterGroup title="Resources" links={[["Guides", "/guides"], ["FAQ", "/faq"], ["Support", "/contact"]]} />
    <FooterGroup title="Legal" links={[["Privacy", "/privacy"], ["Terms", "/terms"], ["Acceptable Use", "/acceptable-use"], ["Security", "/security"]]} />
  </div><div className="public-container public-footer-base"><span>© {new Date().getFullYear()} MARK8BOT</span><span>Telegram-first software and automation.</span></div></footer>;
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
    <PublicFooter />
    <ComingSoonModal open={mark} close={() => setMark(false)} />
    <ProductChooser open={chooser} close={() => setChooser(false)} config={config} showMark={showMark} />
  </div>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="public-section-heading"><p className="public-eyebrow">{eyebrow}</p><h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div>;
}

function RichIcon({ icon: Icon }: { icon: LucideIcon }) { return <Icon />; }

function ProductFrame({ kind = "promotion" }: { kind?: "promotion" | "mark" }) {
  return <div className={`product-frame ${kind}`} aria-label={kind === "promotion" ? "Telegram Promotion interface preview" : "MARK concept preview"}>
    <div className="product-frame-bar"><i /><i /><i /><span>{kind === "promotion" ? "Telegram Promotion workspace" : "MARK concept — coming soon"}</span></div>
    {kind === "promotion" ? <div className="product-frame-body">
      <aside><BrandMark compact /><span /><span /><span /><span /></aside>
      <section><div className="frame-title"><span /><small /></div><div className="frame-metrics"><i /><i /><i /></div><div className="frame-chart"><b /><b /><b /><b /><b /><b /></div><div className="frame-list"><i /><i /><i /></div></section>
    </div> : <div className="mark-concept"><div className="mark-core"><BrainCircuit /><strong>MARK</strong></div><div className="mark-node n1">Knowledge</div><div className="mark-node n2">Instructions</div><div className="mark-node n3">Context</div><div className="mark-node n4">Memory</div><p>Planned intelligence workspace</p></div>}
  </div>;
}

const promotionCapabilities = [
  [Compass, "Discover", "Bring group and audience research into the same workspace used to prepare operations."],
  [Layers3, "Organize", "Move found communities through approval, joining and category workflows without losing context."],
  [Send, "Operate campaigns", "Keep DM and group promotion workflows separate, controllable and visible through their full lifecycle."],
  [BarChart3, "Understand activity", "Review campaign history, analytics and Telegram-derived growth intelligence in structured views."],
  [ShieldCheck, "Stay in control", "Select sessions, targets and actions while the workspace respects permissions, health and Telegram limits."],
  [WalletCards, "Manage the product", "Access plans, payments, credits, Coins, referrals and preferences from one customer workspace."],
] as const;

function HomePage() {
  return <MarketingShell>{({ showChooser, showMark, config }) => <>
    <section className="public-hero"><div className="public-orb orb-a" /><div className="public-orb orb-b" /><div className="public-container public-hero-grid">
      <div><p className="public-eyebrow">TELEGRAM-FIRST SOFTWARE</p><h1>Automation that works <span>where you work.</span></h1><p className="public-lead">MARK8BOT builds intelligent Telegram products for promotion, communication and business automation.</p><div className="public-actions"><button className="public-button public-button-primary" onClick={showChooser}>Explore Products <ArrowRight /></button><a className="public-button public-button-secondary" href="/guides">See How It Works</a></div><div className="public-trust-strip"><span><Check /> Promotion is live</span><span><Sparkles /> MARK is in development</span><span><ShieldCheck /> Owner-controlled workflows</span></div></div>
      <div className="hero-composition"><ProductFrame /><div className="hero-mark-card"><div className="public-mark-symbol"><BrainCircuit /></div><Status kind="soon" /><strong>MARK</strong><span>Intelligence built around your business.</span></div></div>
    </div></section>
    <section className="public-section" id="products"><div className="public-container"><SectionHeading eyebrow="OUR PRODUCTS" title="Two products. Two focused experiences." copy="A live promotion workspace today, and a separate intelligence product being built for what comes next." />
      <article className="product-story promotion-story"><div><Status kind="live" /><p className="public-eyebrow">TELEGRAM PROMOTION</p><h2>Turn Telegram promotion into an organized workflow.</h2><p>Move repetitive Telegram promotion work into one purpose-built workspace—from discovery and preparation to campaign history and growth analysis.</p><div className="public-actions"><a href="/promotion" className="public-button public-button-primary">Explore Telegram Promotion <ArrowRight /></a>{config?.promotion.botUrl ? <a href={config.promotion.botUrl} target="_blank" rel="noreferrer" className="public-button public-button-secondary">Open Promotion Bot <ExternalLink /></a> : null}</div></div><ProductFrame /></article>
      <article className="product-story mark-story"><ProductFrame kind="mark" /><div><Status kind="soon" /><p className="public-eyebrow">MARK</p><h2>Meet MARK.</h2><p className="public-lead-sm">Your business has context. MARK understands it.</p><p>MARK is being designed as an intelligent Telegram assistant shaped by business knowledge, owner-defined instructions and conversation context.</p><div className="public-actions"><a href="/mark" className="public-button public-button-mark">Meet MARK <ArrowRight /></a><button onClick={showMark} className="public-button public-button-secondary">Coming Soon</button></div></div></article>
    </div></section>
    <section className="public-section public-section-alt" id="solutions"><div className="public-container"><SectionHeading eyebrow="SOLUTIONS" title="Less repetition. More operational clarity." /><div className="solution-grid">{[[Search,"Audience Growth","Discover and prepare relevant audiences."],[Zap,"Campaign Operations","Keep repeatable promotion workflows organized."],[BarChart3,"Community Intelligence","Use real activity and growth data where Telegram exposes it."],[Network,"Workflow Automation","Keep Telegram operations close to the conversations they support."],[MessageCircle,"Business Communication","Prepare for context-aware assistance with MARK."],[BrainCircuit,"Future Intelligence","AI-assisted Telegram operations are planned for MARK."]].map(([Icon,title,copy], index)=><article key={String(title)}><span><RichIcon icon={Icon as LucideIcon} /></span><small>{index===5?"COMING SOON":"MARK8BOT"}</small><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</div></div></section>
  </>}</MarketingShell>;
}

function PromotionPage() {
  const [tab, setTab] = useState("Home");
  return <MarketingShell>{({ config }) => <>
    <PageHero eyebrow="TELEGRAM PROMOTION" status="live" title="One workspace for the Telegram promotion work you repeat." copy="Discover, organize, promote and analyze from a Telegram-first workspace while keeping control of sessions, audiences, campaigns and decisions." actions={<><a className="public-button public-button-primary" href={config?.promotion.botUrl ?? "/guides/promotion"} target={config?.promotion.botUrl ? "_blank" : undefined} rel="noreferrer">Open Promotion Bot <ExternalLink /></a><a className="public-button public-button-secondary" href="/guides/promotion">View the Guide</a></>} visual={<ProductFrame />} />
    <section className="public-section"><div className="public-container"><SectionHeading eyebrow="WHAT IT SOLVES" title="Move the workflow out of scattered chats and manual notes." copy="Telegram Promotion brings research, operational preparation, execution history and reporting into a consistent customer workspace." /><div className="capability-grid">{promotionCapabilities.map(([Icon,title,copy])=><article key={title}><span><RichIcon icon={Icon} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <Workflow title="A controlled promotion workflow" steps={[["CONNECT","Connect the Telegram sessions used by your workspace."],["DISCOVER","Find relevant communities and audiences."],["ORGANIZE","Approve, categorize and prepare targets."],["CAMPAIGN","Prepare and operate supported promotion workflows."],["ANALYZE","Review history, performance and growth intelligence."]]} />
    <section className="public-section public-section-alt"><div className="public-container"><SectionHeading eyebrow="SEE IT IN ACTION" title="A workspace organized around real operations." copy="These interface previews mirror the live product areas without using customer data or invented metrics." /><div className="public-tabs" role="tablist">{["Home","Campaigns","Audience","Analytics","Growth"].map((item)=><button role="tab" aria-selected={tab===item} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><ProductFrame /><p className="public-preview-note">{tab} workspace preview · customer information and metrics intentionally omitted.</p></div></section>
    <section className="public-section"><div className="public-container split-copy"><div><SectionHeading eyebrow="BUILT FOR CONTROL" title="Automation supports the operator—it does not bypass Telegram." /><p>Customers choose connected accounts, audiences, destinations and campaign actions. Session health, permissions, writable/sendable checks and Telegram responses remain visible throughout supported workflows.</p></div><div className="public-check-list">{["Separate DM and group campaign workflows","Connected-session health and reconnect status","Group discovery, approval, joining and categories","Campaign history and operational status","Analytics and Telegram-derived Growth Intelligence","Plans, billing, referral Coins and Add Users credits"].map(x=><span key={x}><Check />{x}</span>)}</div></div></section>
  </>}</MarketingShell>;
}

function MarkPage({ app = false }: { app?: boolean }) {
  if (app) return <MarketingShell>{() => <ComingSoonPage />}</MarketingShell>;
  return <MarketingShell>{({ showMark }) => <>
    <PageHero eyebrow="MARK · INTELLIGENCE FOR TELEGRAM" status="soon" title="Your business has context. MARK understands it." copy="MARK is being designed as an intelligent Telegram assistant that will use owner-supplied knowledge, instructions and context to assist supported conversations and workflows." actions={<><button className="public-button public-button-mark" onClick={showMark}>MARK Coming Soon</button><a className="public-button public-button-secondary" href="/guides/mark">How MARK Will Work</a></>} visual={<ProductFrame kind="mark" />} />
    <section className="public-section"><div className="public-container"><SectionHeading eyebrow="THE PLANNED INTELLIGENCE LAYER" title="Not another rigid scripted chatbot." copy="MARK is planned as a configurable layer between what your business knows, how you want it to communicate and the Telegram conversations where assistance is useful." /><div className="mark-model"><span>Your Business</span><ArrowRight /><span>Business Knowledge</span><ArrowRight /><strong>MARK</strong><div className="mark-branches"><i>Memory</i><i>Rules</i><i>Context</i></div><ArrowRight /><span>Conversations</span><ArrowRight /><span>Future Automation</span></div></div></section>
    <Workflow title="How MARK will work" planned steps={[["TEACH","Tell MARK about your business."],["CONFIGURE","Set instructions, communication preferences and behavior."],["CONNECT","Connect MARK with a supported Telegram workflow."],["ASSIST","MARK will use configured context to assist conversations."],["IMPROVE","Update knowledge and instructions as the business evolves."]]} />
    <section className="public-section public-section-alt"><div className="public-container"><SectionHeading eyebrow="PLANNED CAPABILITIES" title="Intelligence shaped by the owner." /><div className="capability-grid">{[[BrainCircuit,"Business Knowledge","Information supplied by the owner about products, services and operations."],[ShieldCheck,"Custom Instructions","Owner-defined communication behavior and response guidance."],[Layers3,"Memory & Context","Relevant context intended to keep supported conversations coherent."],[MessageCircle,"DM Assistance","Planned assistance for supported direct-message conversations."],[Users,"Group Assistance","Planned participation where MARK is configured and permitted."],[Sparkles,"Multilingual Communication","Designed for businesses communicating across languages."],[CircleHelp,"General Intelligence","Business-relevant help beyond rigid scripted replies."],[Network,"Owner Control","Instructions and configuration remain controlled by the business owner."]].map(([Icon,title,copy])=><article key={String(title)}><span><RichIcon icon={Icon as LucideIcon} /></span><Status kind="soon" /><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</div></div></section>
  </>}</MarketingShell>;
}

function ComingSoonPage() { return <section className="public-standalone"><div className="public-mark-symbol"><BrainCircuit /></div><Status kind="soon" /><p className="public-eyebrow">MARK · INTELLIGENCE FOR TELEGRAM</p><h1>The MARK Intelligence workspace is currently in development.</h1><p>MARK is being designed to understand your business context, follow your instructions and assist with Telegram conversations and workflows.</p><div className="public-actions"><a href="/mark" className="public-button public-button-mark">Learn About MARK</a><a href="/guides/mark" className="public-button public-button-secondary">How MARK Will Work</a></div></section>; }

function PageHero({ eyebrow, status, title, copy, actions, visual }: { eyebrow: string; status?: "live" | "soon"; title: string; copy: string; actions?: ReactNode; visual?: ReactNode }) {
  return <section className="public-page-hero"><div className="public-container public-hero-grid"><div>{status ? <Status kind={status} /> : null}<p className="public-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="public-lead">{copy}</p>{actions ? <div className="public-actions">{actions}</div> : null}</div>{visual ? <div>{visual}</div> : null}</div></section>;
}

function Workflow({ title, steps, planned = false }: { title: string; steps: string[][]; planned?: boolean }) {
  return <section className="public-section workflow-section"><div className="public-container"><SectionHeading eyebrow={planned ? "PLANNED EXPERIENCE" : "HOW IT WORKS"} title={title} /><div className="workflow-grid">{steps.map(([name,copy],index)=><article key={name}><span>{String(index+1).padStart(2,"0")}</span><h3>{name}</h3><p>{copy}</p>{index<steps.length-1?<ArrowRight />:null}</article>)}</div></div></section>;
}

const guidePromotion = [["Register","Create the customer account through the Promotion bot."],["Login","Authenticate through the bot and use its fresh Mini App button."],["Open the Mini App","Enter the live Promotion workspace using the secure session handoff."],["Connect Telegram","Link and check the Telegram session used for supported operations."],["Discover and organize","Find groups, review found results, approve, join and categorize relevant destinations."],["Prepare audiences","Use Find Users and DM Audience filters where supported."],["Create campaigns","Open the separate DM or Group Promotion workflow and configure the real campaign."],["Operate and review","Monitor status, pause/resume where supported and review campaign history."],["Analyze growth","Use Analytics and Growth Intelligence for real stored and Telegram-exposed data."],["Manage the product","Review plans, billing, Coins, credits, referrals and settings."]];

function GuidesPage() { return <MarketingShell>{()=><><PageHero eyebrow="GUIDES" title="Understand each product before you begin." copy="Practical product journeys for the live Telegram Promotion workspace and the planned MARK experience." /><section className="public-section"><div className="public-container grid gap-5 lg:grid-cols-2"><GuideCard product="Telegram Promotion" live href="/guides/promotion" copy="From bot registration and session connection through discovery, campaigns, history and analytics." /><GuideCard product="MARK" href="/guides/mark" copy="A clear preview of how the planned knowledge, instruction and conversation workflow will operate." /></div></section></>}</MarketingShell>; }
function GuideCard({product,href,copy,live=false}:{product:string;href:string;copy:string;live?:boolean}){return <a href={href} className={`guide-card ${live?"promotion":"mark"}`}><div>{live?<Send/>:<BrainCircuit/>}<Status kind={live?"live":"soon"}/></div><h2>{product}</h2><p>{copy}</p><span>Read the guide <ArrowRight/></span></a>}

function GuidePage({ mark = false }: { mark?: boolean }) { const steps=mark?[["Access MARK","Access will open after MARK launches."],["Teach MARK","Supply accurate business knowledge."],["Configure instructions","Define communication style and behavior."],["Connect Telegram","Choose a supported Telegram workflow."],["Use conversations","MARK will apply configured context in supported interactions."],["Manage knowledge","Review and update memory, knowledge and preferences."],["Improve over time","Refine configuration as the business evolves."]]:guidePromotion; return <MarketingShell>{()=><><PageHero eyebrow={mark?"MARK · COMING SOON":"TELEGRAM PROMOTION · LIVE"} status={mark?"soon":"live"} title={mark?"How MARK will work":"From bot registration to an organized promotion workflow."} copy={mark?"This guide represents the planned MARK experience and may evolve before launch.":"A practical introduction to the current customer journey, based on the live product workflow."} /><section className="public-section"><div className="public-container guide-steps">{steps.map(([title,copy],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h2>{title}</h2><p>{copy}</p></div>{mark?<Status kind="soon"/>:null}</article>)}</div></section></>}</MarketingShell>; }

function AboutPage(){return <MarketingShell>{()=><><PageHero eyebrow="ABOUT MARK8BOT" title="Useful automation should feel like part of the conversation—not another complicated system to manage." copy="MARK8BOT is a Telegram-first software ecosystem focused on practical operations today and contextual intelligence for the future." /><section className="public-section"><div className="public-container principle-grid">{[[Zap,"AUTOMATE","Reduce repetitive operational work."],[BrainCircuit,"UNDERSTAND","Turn activity and context into useful intelligence."],[Network,"CONNECT","Keep tools close to the conversations where work happens."]].map(([Icon,title,copy])=><article key={String(title)}><RichIcon icon={Icon as LucideIcon}/><h2>{String(title)}</h2><p>{String(copy)}</p></article>)}</div></section><section className="public-section public-section-alt"><div className="public-container split-copy"><div><SectionHeading eyebrow="WHY TWO PRODUCTS" title="Focused products, connected by one philosophy." /></div><div><h3>Telegram Promotion</h3><p>Organizes repeatable audience, campaign and growth operations in a live Telegram Mini App.</p><h3 className="mt-8">MARK</h3><p>Is being designed as a separate intelligent assistant shaped by owner-supplied business context.</p></div></div></section></>}</MarketingShell>}

const faqs = [
 ["MARK8BOT","What is MARK8BOT?","MARK8BOT is a Telegram-first software ecosystem. It currently offers Telegram Promotion and is developing MARK as a separate intelligent Telegram assistant."],
 ["MARK8BOT","What products does MARK8BOT offer?","Telegram Promotion is live. MARK is coming soon and does not yet have an operational bot or Mini App."],
 ["Telegram Promotion","What is Telegram Promotion?","A Telegram Mini App that organizes supported discovery, audience, campaign, history, analytics, billing and settings workflows."],
 ["Telegram Promotion","How does the Promotion workspace work?","Customers register or log in through the bot, connect permitted Telegram sessions, then use separate tools for discovery, organization, campaigns and reporting."],
 ["Telegram Promotion","What is a Telegram session?","A linked Telegram account connection used for permitted MTProto operations. Health and reconnect state remain visible to the customer."],
 ["Telegram Promotion","How does group discovery work?","Customers submit discovery criteria, review found groups, and move relevant results through approval, joining and categorization workflows."],
 ["Telegram Promotion","What is Growth Intelligence?","Reporting based only on real stored snapshots and Telegram data available to an authorized admin session. Unavailable metrics are not fabricated."],
 ["Telegram Promotion","What are campaigns?","Separate DM and group promotion workflows with configuration, persisted status, controls and history."],
 ["Account & Billing","How do plans and billing work?","Available plans, prices, invoices, payment status, credits and Coins are shown inside the live Billing workspace. The website does not invent pricing."],
 ["MARK","What is MARK?","MARK is a planned intelligent Telegram assistant designed around owner-supplied business knowledge, instructions and conversation context."],
 ["MARK","Is MARK available now?","No. MARK is coming soon. No launch date or Telegram username has been announced."],
 ["MARK","How will MARK learn about my business?","The planned experience will let owners provide business knowledge and instructions, then refine them as the business evolves."],
 ["MARK","Will MARK support groups and multiple languages?","Group assistance and multilingual communication are planned capabilities. Exact launch scope will be confirmed before access opens."],
 ["MARK8BOT","Can I use both products?","They are designed as separate products. Telegram Promotion is available now; MARK access will be separate when it launches."],
 ["Privacy & Security","How is account access handled?","Promotion uses its existing bot login, short-lived session handoff and protected Mini App routes. Admin access remains separate and protected."],
 ["MARK8BOT","How do I get support?","Use the Contact page to find the currently configured support channel."],
] as const;

function FaqPage(){const [query,setQuery]=useState("");const [category,setCategory]=useState("All");const categories=["All",...new Set(faqs.map(x=>x[0]))];const shown=useMemo(()=>faqs.filter(([c,q,a])=>(category==="All"||c===category)&&`${q} ${a}`.toLowerCase().includes(query.toLowerCase())),[query,category]);return <MarketingShell>{()=><><PageHero eyebrow="FAQ" title="Answers about MARK8BOT and its products." copy="Search live product guidance, planned MARK capabilities, account topics and security information." /><section className="public-section"><div className="public-container"><div className="faq-tools"><label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search questions"/></label><div>{categories.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div></div><div className="faq-list">{shown.map(([c,q,a])=><details key={q}><summary><span><small>{c}</small>{q}</span><ChevronDown/></summary><p>{a}</p></details>)}</div></div></section></>}</MarketingShell>}

function ContactPage(){const config=usePublicConfig();const [product,setProduct]=useState("Telegram Promotion");function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);const subject=encodeURIComponent(`[${product}] ${String(data.get("topic")||"Website inquiry")}`);const body=encodeURIComponent(`Name: ${String(data.get("name")||"")}\nProduct: ${product}\n\n${String(data.get("message")||"")}`);if(config?.support.email)window.location.href=`mailto:${config.support.email}?subject=${subject}&body=${body}`;else if(config?.support.telegramUrl)window.open(config.support.telegramUrl,"_blank","noopener,noreferrer");}return <MarketingShell>{()=><><PageHero eyebrow="CONTACT" title="Talk to MARK8BOT." copy="Choose the product and describe what you need. The form continues through the support channel currently configured by the platform." /><section className="public-section"><div className="public-container contact-grid"><form onSubmit={submit} className="public-form"><label>Name<input required name="name" autoComplete="name"/></label><label>Email<input required name="email" type="email" autoComplete="email"/></label><label>Product<select value={product} onChange={e=>setProduct(e.target.value)}><option>Telegram Promotion</option><option>MARK</option><option>General</option></select></label><label>Topic<input name="topic" placeholder="What can we help with?"/></label><label>Message<textarea required name="message" rows={6}/></label><button className="public-button public-button-primary" disabled={!config?.support.email&&!config?.support.telegramUrl}>Continue to configured support <ArrowRight/></button>{!config?.support.email&&!config?.support.telegramUrl?<p className="form-note">A support destination is not currently configured. The form will not claim to submit your message.</p>:null}</form><aside>{[[MessageCircle,"Customer Support","Help with the live Telegram Promotion workspace."],[Network,"Business Inquiries","Product and workflow questions for your organization."],[ShieldCheck,"Technical Assistance","Account, connection and operational troubleshooting." ]].map(([Icon,title,copy])=><article key={String(title)}><RichIcon icon={Icon as LucideIcon}/><h2>{String(title)}</h2><p>{String(copy)}</p></article>)}</aside></div></section></>}</MarketingShell>}

const legal:Record<string,{eyebrow:string;title:string;intro:string;sections:string[][]}>={
 privacy:{eyebrow:"PRIVACY",title:"Privacy overview",intro:"This baseline explains the product data categories and should be reviewed by qualified legal counsel before being treated as final legal advice.",sections:[["Information involved","MARK8BOT products may process account details, linked Telegram identifiers and sessions, customer-configured campaign data, analytics records, billing records and support communications."],["Telegram integrations","Telegram is a third-party service. Linked sessions and Telegram-derived data are used only for supported product operations and remain subject to Telegram availability, permissions and policies."],["MARK future processing","MARK is not live. Before launch, this notice must be updated with the actual model providers, retention, knowledge-processing and conversation-data practices."],["Choices and contact","Customers can manage available preferences in the product and contact support for account or data questions."]] },
 terms:{eyebrow:"TERMS",title:"Product terms baseline",intro:"These baseline terms describe intended product boundaries and require professional legal review before final publication.",sections:[["Service scope","Telegram Promotion provides supported workflow tools; MARK is coming soon and is not currently offered as an operational service."],["Customer responsibility","Customers are responsible for account security, lawful content, configured audiences, Telegram permissions and compliance with platform rules."],["Third-party dependency","Service availability can depend on Telegram, payment networks, hosting providers and other configured integrations."],["Payments and changes","Live prices, plan limits, invoices and entitlements are presented inside the product. Applicable refund or cancellation policies should be confirmed in finalized commercial terms."]] },
 "acceptable-use":{eyebrow:"ACCEPTABLE USE",title:"Responsible Telegram automation",intro:"MARK8BOT products are intended for legitimate, permission-aware business and community workflows.",sections:[["Permitted use","Use the products for lawful discovery, organization, customer-authorized communication and supported campaign operations."],["Prohibited conduct","Do not use MARK8BOT to spam, harass, deceive, bypass Telegram restrictions, compromise accounts, distribute unlawful content or access data without permission."],["Rate and permission controls","Customers must respect Telegram limits, chat permissions, user privacy and all product safety controls."],["Enforcement","Access may be restricted when activity risks users, Telegram infrastructure, payment systems or the integrity of the platform."]] },
 security:{eyebrow:"SECURITY",title:"Security and trust",intro:"MARK8BOT uses layered application controls without claiming that any internet service is risk-free.",sections:[["Access boundaries","Promotion customer sessions, Supabase-backed admin authentication and operational APIs use separate access paths."],["Sensitive configuration","Bot tokens, service credentials, Telegram session material and encryption keys belong only in protected server configuration and must never be exposed in public clients."],["Operational safeguards","The live product includes session health, permission-aware workflows, bounded workers, error handling and audit-oriented persistence where implemented."],["Reporting concerns","Use the configured support channel to report suspected security issues. Do not include passwords, bot tokens or raw Telegram sessions in reports."]] },
};
function LegalPage({kind}:{kind:"privacy"|"terms"|"acceptable-use"|"security"}){const page=legal[kind]!;return <MarketingShell>{()=><><PageHero eyebrow={page.eyebrow} title={page.title} copy={page.intro}/><section className="public-section"><article className="public-container legal-copy">{page.sections.map(([title,copy])=><section key={title}><h2>{title}</h2><p>{copy}</p></section>)}</article></section></>}</MarketingShell>}

export function PublicPage({ page }: { page: PageKind }) {
  if (page === "home") return <HomePage />;
  if (page === "promotion") return <PromotionPage />;
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
