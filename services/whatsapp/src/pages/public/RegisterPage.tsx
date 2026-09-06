import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function RegisterPage() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sessionStorage.setItem("wa-mark-demo-session", JSON.stringify({ workspace: workspace || "My Workspace" }));
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
          <div className="form-grid">
            <label>Full name<input required placeholder="Your name" /></label>
            <label>Workspace name<input required placeholder="Acme Support" value={workspace} onChange={(e) => setWorkspace(e.target.value)} /></label>
          </div>
          <label>Work email<input required type="email" placeholder="you@company.com" /></label>
          <label>Password<input required type="password" minLength={6} placeholder="Minimum 6 characters" /></label>
          <label className="check terms-check"><input required type="checkbox" /> I agree to the Terms and Acceptable Use Policy.</label>
          <button className="auth-submit" type="submit">Create workspace â†’</button>
          <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
          <p className="auth-demo-note">This step creates a local preview session only. Production auth will replace it next.</p>
        </form>
      </section>
    </div>
  );
}