import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telegram Promotion Platform — Bot-First Campaign SaaS" },
      {
        name: "description",
        content:
          "Run Telegram group discovery, opt-in audience outreach and campaigns from a Telegram Mini App. Platform owners manage everything from the admin console.",
      },
      { property: "og:title", content: "Telegram Promotion Platform" },
      {
        property: "og:description",
        content: "Customer control panel lives in Telegram. The web console is for the platform owner only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-20">
        <div className="space-y-5">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Multi-tenant · Telegram-native
          </span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            The customer dashboard lives inside Telegram.
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Customers register and sign in through the bot, then run discovery, approvals, opt-in audience
            outreach and campaigns from the Mini App. This website is reserved for the platform owner.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl border border-border p-6"
            style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-panel)" }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Customers</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the Telegram bot and send <code className="text-foreground">/start</code> to register, log in and
              launch the Mini App.
            </p>
          </div>
          <div
            className="rounded-2xl border border-border p-6"
            style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-panel)" }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Platform owner</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Customers, plans, subscriptions, payments, Telegram settings, logs and analytics.
            </p>
            <Link
              to="/admin/login"
              className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Open admin console
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
