import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import {
  createPendingWhatsAppAccount,
  listWhatsAppAccounts,
  removeWhatsAppAccount,
  type WhatsAppAccount,
} from "../../lib/whatsappAccounts";
import { launchMetaEmbeddedSignup } from "../../lib/metaEmbeddedSignup";

type MetaReadiness = {
  configured: boolean;
  appId: boolean;
  appSecret: boolean;
  configId: boolean;
  serviceRole: boolean;
  graphVersion: boolean;
  encryptionKey: boolean;
};

function StatusDot({ status }: { status: WhatsAppAccount["status"] }) {
  return <span className={`wa-connection-status ${status}`}><i />{status}</span>;
}

export function AppIntegrationsPage() {
  const { workspace } = useAuth();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<MetaReadiness | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await listWhatsAppAccounts(workspace.id);
    if (result.error) setError(result.error.message);
    setAccounts(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    fetch("/api/meta/readiness")
      .then((response) => response.json())
      .then((data) => setReadiness(data))
      .catch(() => setReadiness(null));
  }, [workspace?.id]);

  const startConnect = async () => {
    if (!workspace?.id) return;
    setError("");
    setNotice("");

    if (!readiness?.configured) {
      setError("Meta Embedded Signup is not fully configured yet. Complete the server variables shown on the right.");
      return;
    }

    setBusy(true);
    const slot = await createPendingWhatsAppAccount(workspace.id);

    if (slot.error || !slot.data) {
      setBusy(false);
      setError(slot.error?.message || "Could not create connection slot");
      return;
    }

    try {
      await launchMetaEmbeddedSignup(slot.data.id);
      setNotice("WhatsApp Business connected successfully.");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Meta connection failed");
    } finally {
      setBusy(false);
      await load();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this disconnected connection record?")) return;
    const result = await removeWhatsAppAccount(id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  };

  return (
    <div className="wa-connect-page">
      <section className="wa-connect-head">
        <div>
          <span className="eyebrow">INTEGRATIONS</span>
          <h1>WhatsApp Business</h1>
          <p>Connect an official Meta WhatsApp Business Platform account. WA MARK uses Meta Embedded Signup and never asks for a personal WhatsApp Web QR session.</p>
        </div>
        <button className="wm-primary-btn" onClick={startConnect} disabled={busy}>
          {busy ? "Connecting..." : "Connect WhatsApp Business"}
        </button>
      </section>

      {error && <div className="auth-alert error">{error}</div>}
      {notice && <div className="auth-alert success">{notice}</div>}

      <section className="wa-connect-grid">
        <article className="wm-card wa-connection-main">
          <div className="wm-card-head">
            <div><span className="eyebrow">CONNECTIONS</span><h3>Your WhatsApp accounts</h3></div>
            <span className="wa-count">{accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
          </div>

          {loading ? (
            <div className="wa-empty">Loading WhatsApp accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="wa-empty">
              <div className="wa-empty-icon">WA</div>
              <h3>No WhatsApp Business account connected</h3>
              <p>Launch the official Meta signup flow to select your business and phone number.</p>
              <button className="wm-primary-btn" onClick={startConnect}>Connect account</button>
            </div>
          ) : (
            <div className="wa-account-list">
              {accounts.map((account) => (
                <div className="wa-account-row" key={account.id}>
                  <div className="wa-account-avatar">WA</div>
                  <div className="wa-account-info">
                    <div>
                      <b>{account.verified_name || "WhatsApp Business"}</b>
                      <StatusDot status={account.status} />
                    </div>
                    <span>{account.display_phone_number || "Phone number pending"}</span>
                    <small>{account.waba_id ? `WABA ${account.waba_id}` : "Waiting for Meta onboarding"}</small>
                  </div>
                  <div className="wa-account-actions">
                    {account.status === "connected"
                      ? <button>Manage</button>
                      : <button onClick={() => void remove(account.id)}>Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="wm-card wa-readiness-card">
          <span className="eyebrow">SERVER READINESS</span>
          <h3>Meta connection setup</h3>
          <p>All items must show Ready before the real signup window can finish securely.</p>
          <div className="wa-readiness-list">
            <div><span>META_APP_ID</span><b className={readiness?.appId ? "ok" : ""}>{readiness?.appId ? "Ready" : "Missing"}</b></div>
            <div><span>META_APP_SECRET</span><b className={readiness?.appSecret ? "ok" : ""}>{readiness?.appSecret ? "Ready" : "Missing"}</b></div>
            <div><span>META_EMBEDDED_SIGNUP_CONFIG_ID</span><b className={readiness?.configId ? "ok" : ""}>{readiness?.configId ? "Ready" : "Missing"}</b></div>
            <div><span>META_GRAPH_VERSION</span><b className={readiness?.graphVersion ? "ok" : ""}>{readiness?.graphVersion ? "Ready" : "Missing"}</b></div>
            <div><span>SUPABASE_SERVICE_ROLE_KEY</span><b className={readiness?.serviceRole ? "ok" : ""}>{readiness?.serviceRole ? "Ready" : "Missing"}</b></div>
            <div><span>WHATSAPP_TOKEN_ENCRYPTION_KEY</span><b className={readiness?.encryptionKey ? "ok" : ""}>{readiness?.encryptionKey ? "Ready" : "Missing"}</b></div>
          </div>
          <div className="wa-security-note">
            <b>Credential isolation</b>
            <p>Meta App Secret and WhatsApp access tokens stay on the server. Access tokens are encrypted before database storage.</p>
          </div>
        </aside>
      </section>

      <section className="wm-card wa-flow-card">
        <div className="wm-card-head"><div><span className="eyebrow">ACTIVE FLOW</span><h3>Embedded Signup connection</h3></div></div>
        <div className="wa-flow-steps">
          <div><strong>01</strong><b>Meta sign-in</b><p>Official Meta window opens.</p></div>
          <div><strong>02</strong><b>Select business</b><p>Choose the WhatsApp Business Account.</p></div>
          <div><strong>03</strong><b>Verify number</b><p>Select the business phone number.</p></div>
          <div><strong>04</strong><b>Secure exchange</b><p>Authorization code is exchanged server-side.</p></div>
          <div><strong>05</strong><b>Subscribe app</b><p>WA MARK subscribes the app to WABA events.</p></div>
        </div>
      </section>
    </div>
  );
}