import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sessionStorage.setItem("wa-mark-demo-session", JSON.stringify({ email, workspace: "WA MARK Workspace" }));
    navigate("/app");
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
          <p>Inbox, CRM, MARK AI, AI employees, campaigns and analytics â€” organized around your customer conversations.</p>
          <div className="auth-proof">
            <span>âœ¦ AI + human approval</span><span>âœ¦ Team-ready</span><span>âœ¦ Secure workspace</span>
          </div>
        </div>
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">SIGN IN</span>
            <h2>Welcome to WA MARK</h2>
            <p>Use your business account to continue.</p>
          </div>
          <label>Email address<input required type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input required type="password" minLength={6} placeholder="Enter your password" /></label>
          <div className="auth-row"><label className="check"><input type="checkbox" /> Remember me</label><button type="button" className="text-button">Forgot password?</button></div>
          <button className="auth-submit" type="submit">Enter WA MARK â†’</button>
          <div className="auth-divider"><span>or</span></div>
          <button className="auth-secondary" type="button">Continue with Google</button>
          <p className="auth-switch">New to WA MARK? <Link to="/register">Create workspace</Link></p>
          <p className="auth-demo-note">Interface preview: authentication backend will be connected in the next integration step.</p>
        </form>
      </section>
    </div>
  );
}