import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminMe } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [
    { title: "Admin Login | Telegram Promotion Platform" },
    { name: "description", content: "Secure super admin sign in." },
    { property: "og:title", content: "Admin Login" },
    { property: "og:description", content: "Secure platform owner sign in." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { setError(result.error.message); setBusy(false); return; }
    try { await adminMe(); await navigate({ to: "/admin/$section", params: { section: "dashboard" } }); }
    catch { await supabase.auth.signOut(); setError("This account does not have super admin access."); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
    <form onSubmit={submit} className="w-full max-w-sm border-t-2 border-primary bg-card p-7 shadow-2xl">
      <div className="mb-7 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><LockKeyhole className="size-5" /></div>
      <p className="text-xs font-semibold uppercase text-primary">Platform owner</p>
      <h1 className="mt-2 text-2xl font-semibold">Admin sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">Customer accounts cannot access this console.</p>
      <label className="mt-7 block text-sm font-medium">Email<input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="mt-4 block text-sm font-medium">Password<input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="mt-6 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  </main>;
}