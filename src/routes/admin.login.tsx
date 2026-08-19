import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LockKeyhole, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAuthHeaders, withAdminAuthTimeout } from "@/integrations/supabase/auth-attacher";
import { adminMe, getAdminRegistrationStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login | Telegram Promotion Platform" },
      { name: "description", content: "Secure super admin sign in." },
      { property: "og:title", content: "Admin Login" },
      { property: "og:description", content: "Secure platform owner sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogin,
});

function authError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("duplicate")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("least") || normalized.includes("short"))) {
    return "Use a stronger password with at least 8 characters.";
  }
  return message;
}

function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [checkedRegistration, setCheckedRegistration] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getAdminRegistrationStatus()
      .then((result) => {
        setRegistrationOpen(result.open);
        setCheckedRegistration(true);
      })
      .catch(() => setCheckedRegistration(true));
  }, []);

  function selectMode(next: "signin" | "register") {
    setError("");
    setMode(next);
    if (next === "register") {
      setPassword("");
      setConfirmPassword("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let stage = "Supabase sign-in";
    const trace = (event: string) => console.info(`[admin-login] ${event}`);
    try {
      if (mode === "register") {
        const availability = await getAdminRegistrationStatus();
        setRegistrationOpen(availability.open);
        if (!availability.open) {
          setError("Admin registration is closed.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        if (password.length < 8) {
          setError("Use a stronger password with at least 8 characters.");
          return;
        }
        const result = await withAdminAuthTimeout(supabase.auth.signUp({ email: email.trim(), password }));
        if (result.error) {
          setError(authError(result.error.message));
          return;
        }
        if (!result.data.session) {
          setError("Email confirmation is required before the first admin can sign in.");
          return;
        }
      } else {
        trace("signInWithPassword started");
        const result = await withAdminAuthTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
        trace(`signInWithPassword completed: ${result.error ? "error" : "success"}`);
        if (result.error) {
          setError(authError(result.error.message));
          return;
        }
      }
      stage = "Supabase access token";
      const headers = await supabaseAuthHeaders();
      trace("access token available");
      stage = "Admin role verification";
      trace("adminMe request started");
      await withAdminAuthTimeout(adminMe({ headers }));
      trace("adminMe role verification completed");
      stage = "Admin dashboard navigation";
      await withAdminAuthTimeout(
        navigate({ to: "/admin/$section", params: { section: "dashboard" } }),
        "Admin dashboard navigation timed out. Please try again.",
      );
      trace("dashboard navigation completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin authentication failed.";
      const timedOut = message.toLowerCase().includes("timed out");
      const stageMessage = timedOut
        ? `${stage} timed out. Please try again.`
        : message === "FORBIDDEN"
          ? mode === "register" ? "Admin registration is closed." : "This Supabase user does not have super admin access."
          : stage === "Admin role verification" && message.toLowerCase().includes("unauthorized")
            ? "Admin session could not be verified. Please sign in again."
            : message;
      trace(`failed at ${stage}: ${stageMessage}`);
      setError(stageMessage);
      await withAdminAuthTimeout(
        supabase.auth.signOut(),
        "Admin sign-out cleanup timed out. Please close the page and try again.",
      ).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const registerDisabled = checkedRegistration && !registrationOpen;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm border-t-2 border-primary bg-card p-7 shadow-2xl">
        <div className="mb-7 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          {mode === "register" ? <UserPlus className="size-5" /> : <LockKeyhole className="size-5" />}
        </div>
        <p className="text-xs font-semibold uppercase text-primary">Platform owner</p>
        <h1 className="mt-2 text-2xl font-semibold">{mode === "register" ? "Create first admin" : "Admin sign in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Customer accounts cannot access this console.</p>
        <label className="mt-7 block text-sm font-medium">
          Email
          <input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mode === "register" && (
          <label className="mt-4 block text-sm font-medium">
            Confirm Password
            <input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || registerDisabled}>
          {busy ? (mode === "register" ? "Creating account…" : "Signing in…") : mode === "register" ? "CREATE ADMIN ACCOUNT" : "Sign in"}
        </Button>
        <button type="button" className="mt-5 w-full text-sm text-primary hover:underline" onClick={() => selectMode(mode === "signin" ? "register" : "signin")}>
          {mode === "signin" ? (registerDisabled ? "Admin registration is closed." : "Create the first admin account") : "Back to admin sign in"}
        </button>
      </form>
    </main>
  );
}
