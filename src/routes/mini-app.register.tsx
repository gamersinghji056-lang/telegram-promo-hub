import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { completeRegistration } from "@/lib/customer.functions";

export const Route = createFileRoute("/mini-app/register")({
  validateSearch: (search) => ({
    flow: typeof search["flow"] === "string" ? search["flow"] : "",
    email: typeof search["email"] === "string" ? search["email"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Register | Telegram Mini App" },
      { name: "description", content: "Complete secure customer registration." },
    ],
  }),
  component: MiniAppRegister,
});

function MiniAppRegister() {
  const { flow, email: initialEmail } = Route.useSearch();
  const navigate = useNavigate();
  const registerFn = useServerFn(completeRegistration);
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await registerFn({
        data: { flowToken: flow, email, name: name || null, password, confirmPassword },
      });
      sessionStorage.setItem("customer-session", result.token);
      await navigate({ to: "/mini-app/$section", params: { section: "dashboard" } });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Registration failed. Return to the bot and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border-t-2 border-primary bg-card p-6 shadow-2xl"
      >
        <div className="mb-6 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LockKeyhole className="size-5" />
        </div>
        <p className="text-xs font-semibold uppercase text-primary">Secure registration</p>
        <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Passwords are entered only here, never in Telegram chat.
        </p>

        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Name
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Confirm password
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || !flow}>
          {busy ? "Creating account..." : "Create account"}
        </Button>
        {!flow && (
          <p className="mt-3 text-xs text-warning">Open this page from the Telegram bot.</p>
        )}
      </form>
    </main>
  );
}
