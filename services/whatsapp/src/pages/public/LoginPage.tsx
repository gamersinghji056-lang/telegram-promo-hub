import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) navigate("/app", { replace: true });
  }, [session, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!supabaseConfigured || !supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    const from = (location.state as { from?: string } | null)?.from || "/app";
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" to="/">
          <span className="auth-logo">WA</span>
          <span><b>WA MARK</b><small>AI Workspace for WhatsApp Business</small></span>
        </Link>
        <div className="auth-copy">
          <span className="auth-kicker">WELCOME BACK</span>
          <h1>Run your WhatsApp operation from one intelligent workspace.</h1>
          <p>Inbox, CRM, MARK AI, AI employees, campaigns and analytics - organized around your customer conversations.</p>
          <div className="auth-proof"><span>AI + human approval</span><span>Team-ready</span><span>Secure workspace</span></div>
        </div>
        <div className="auth-orb auth-orb-a" /><div className="auth-orb auth-orb-b" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div><span className="eyebrow">SIGN IN</span><h2>Welcome to WA MARK</h2><p>Use your business account to continue.</p></div>
          {!supabaseConfigured && <div className="auth-alert">Backend is not configured yet. Add Supabase environment variables first.</div>}
          {error && <div className="auth-alert error">{error}</div>}
          <label>Email address<input required type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input required type="password" autoComplete="current-password" minLength={6} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="auth-submit" disabled={busy} type="submit">{busy ? "Signing in..." : "Enter WA MARK >"}</button>
          <p className="auth-switch">New to WA MARK? <Link to="/register">Create workspace</Link></p>
        </form>
      </section>
    </div>
  );
}