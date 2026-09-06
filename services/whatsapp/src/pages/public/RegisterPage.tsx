import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `workspace-${Date.now()}`;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { session, refreshWorkspace } = useAuth();
  const [fullName, setFullName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (session) navigate("/app", { replace: true });
  }, [session, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!supabaseConfigured || !supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    setBusy(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setBusy(false);
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setBusy(false);
      setNotice("Account created. Check your email to confirm the account, then sign in.");
      return;
    }

    const { error: workspaceError } = await supabase.rpc("create_workspace_for_current_user", {
      workspace_name: workspace.trim(),
      workspace_slug: `${slugify(workspace)}-${Math.random().toString(36).slice(2, 7)}`,
    });

    setBusy(false);

    if (workspaceError) {
      setError(`Account created, but workspace setup failed: ${workspaceError.message}`);
      return;
    }

    await refreshWorkspace();
    navigate("/app", { replace: true });
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" to="/">
          <span className="auth-logo">WA</span>
          <span><b>WA MARK</b><small>AI Workspace for WhatsApp Business</small></span>
        </Link>
        <div className="auth-copy">
          <span className="auth-kicker">CREATE YOUR WORKSPACE</span>
          <h1>Build an operating layer around every customer conversation.</h1>
          <p>Start with your team workspace, then connect WhatsApp Business, contacts and MARK AI.</p>
          <div className="auth-steps"><span><b>01</b>Create workspace</span><span><b>02</b>Connect WhatsApp</span><span><b>03</b>Train MARK AI</span></div>
        </div>
        <div className="auth-orb auth-orb-a" /><div className="auth-orb auth-orb-b" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div><span className="eyebrow">GET STARTED</span><h2>Create WA MARK workspace</h2><p>You will be the workspace owner.</p></div>
          {!supabaseConfigured && <div className="auth-alert">Backend is not configured yet. Add Supabase environment variables first.</div>}
          {error && <div className="auth-alert error">{error}</div>}
          {notice && <div className="auth-alert success">{notice}</div>}
          <div className="form-grid">
            <label>Full name<input required autoComplete="name" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
            <label>Workspace name<input required placeholder="Acme Support" value={workspace} onChange={(e) => setWorkspace(e.target.value)} /></label>
          </div>
          <label>Work email<input required type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input required type="password" autoComplete="new-password" minLength={6} placeholder="Minimum 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="auth-submit" disabled={busy} type="submit">{busy ? "Creating workspace..." : "Create workspace >"}</button>
          <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </section>
    </div>
  );
}