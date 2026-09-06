import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, createReadStream, statSync as statFs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT) || 4173;
const host = "0.0.0.0";
const indexHtml = path.join(distDir, "index.html");
const graphVersion = process.env.META_GRAPH_VERSION || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function resolveSafeDistPath(requestPath) {
  const normalized = path.posix.normalize(requestPath.startsWith("/") ? requestPath : `/${requestPath}`);
  const safePath = normalized === "/" ? "/index.html" : normalized;
  return path.resolve(path.join(distDir, `.${safePath}`));
}

function sendJson(res, data, status = 200) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(payload);
}

function servePath(filePath) {
  const ext = path.extname(filePath);
  const mime = mimeTypes[ext] || "application/octet-stream";
  return { filePath, mime };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Request body too large");
  }
  return raw ? JSON.parse(raw) : {};
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function verifyMetaWebhookSignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const providedHex = signatureHeader.slice("sha256=".length);

  if (!/^[a-f0-9]{64}$/i.test(providedHex)) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function extractWebhookSummary(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let messages = 0;
  let statuses = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      if (Array.isArray(value.messages)) messages += value.messages.length;
      if (Array.isArray(value.statuses)) statuses += value.statuses.length;
    }
  }

  return { entries: entries.length, messages, statuses };
}

function encryptToken(token) {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY is missing");

  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

async function supabaseRequest(pathname, options = {}) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) throw new Error("Supabase server configuration is missing");

  const headers = {
    apikey: serviceRole,
    authorization: `Bearer ${serviceRole}`,
    "content-type": "application/json",
    ...(options.headers || {}),
  };

  return fetch(`${supabaseUrl}${pathname}`, { ...options, headers });
}

async function getSupabaseUser(userJwt) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) throw new Error("Supabase server configuration is missing");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${userJwt}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function assertAccountAccess(accountId, userJwt) {
  const user = await getSupabaseUser(userJwt);
  if (!user?.id) throw new Error("Unauthorized");

  const accountResponse = await supabaseRequest(
    `/rest/v1/whatsapp_accounts?id=eq.${encodeURIComponent(accountId)}&select=id,workspace_id,status`
  );
  const accounts = await accountResponse.json();
  const account = accounts?.[0];
  if (!account) throw new Error("Connection record not found");

  const memberResponse = await supabaseRequest(
    `/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(account.workspace_id)}&user_id=eq.${encodeURIComponent(user.id)}&role=in.(owner,admin)&select=role`
  );
  const members = await memberResponse.json();
  if (!members?.length) throw new Error("Workspace admin access required");

  return account;
}

async function graphJson(url, options = {}) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) {
    const message = json?.error?.message || `Meta request failed (${response.status})`;
    throw new Error(message);
  }
  return json;
}

async function completeEmbeddedSignup(req, res) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return sendJson(res, { error: "Unauthorized" }, 401);
    const userJwt = authHeader.slice(7);

    const body = await readJson(req);
    const { accountId, code, wabaId, phoneNumberId } = body || {};
    if (!accountId || !code || !wabaId || !phoneNumberId) {
      return sendJson(res, { error: "Missing Embedded Signup data" }, 400);
    }

    await assertAccountAccess(accountId, userJwt);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret || !graphVersion) throw new Error("Meta server configuration is incomplete");

    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenData = await graphJson(tokenUrl.toString());
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("Meta did not return an access token");

    const phoneUrl = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}`);
    phoneUrl.searchParams.set("fields", "display_phone_number,verified_name");
    phoneUrl.searchParams.set("access_token", accessToken);
    const phone = await graphJson(phoneUrl.toString());

    const subscribeUrl = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`);
    subscribeUrl.searchParams.set("access_token", accessToken);
    await graphJson(subscribeUrl.toString(), { method: "POST" });

    const encrypted = encryptToken(accessToken);

    const updateResponse = await supabaseRequest(
      `/rest/v1/whatsapp_accounts?id=eq.${encodeURIComponent(accountId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          waba_id: String(wabaId),
          phone_number_id: String(phoneNumberId),
          display_phone_number: phone.display_phone_number || null,
          verified_name: phone.verified_name || null,
          status: "connected",
          token_secret_ref: `db:whatsapp_credentials:${accountId}`,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!updateResponse.ok) throw new Error("Failed to save WhatsApp account");

    const credentialResponse = await supabaseRequest("/rest/v1/whatsapp_credentials?on_conflict=account_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        access_token_encrypted: encrypted,
        token_type: tokenData.token_type || "bearer",
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!credentialResponse.ok) throw new Error("Failed to store encrypted WhatsApp credential");

    sendJson(res, {
      ok: true,
      account: {
        id: accountId,
        wabaId,
        phoneNumberId,
        displayPhoneNumber: phone.display_phone_number || null,
        verifiedName: phone.verified_name || null,
      },
    });
  } catch (error) {
    console.error("Meta Embedded Signup completion failed", error);
    sendJson(res, { error: error instanceof Error ? error.message : "Meta connection failed" }, 500);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const cleanPath = decodeURIComponent(url.pathname);

    if (cleanPath === "/api/meta/webhook" && req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const verifyToken = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

      if (
        mode === "subscribe" &&
        expectedToken &&
        verifyToken === expectedToken &&
        challenge
      ) {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end(challenge);
        return;
      }

      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (cleanPath === "/api/meta/webhook" && req.method === "POST") {
      const rawBody = await readRawBody(req);
      const signatureHeader = Array.isArray(req.headers["x-hub-signature-256"])
        ? req.headers["x-hub-signature-256"][0]
        : req.headers["x-hub-signature-256"];

      if (!verifyMetaWebhookSignature(rawBody, signatureHeader)) {
        res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid signature");
        return;
      }

      let payload;
      try {
        payload = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
      } catch {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid JSON");
        return;
      }

      const summary = extractWebhookSummary(payload);
      console.log("Meta WhatsApp webhook received", summary);

      sendJson(res, { received: true });
      return;
    }

    if (cleanPath === "/api/meta/readiness" && req.method === "GET") {
      const appId = Boolean(process.env.META_APP_ID);
      const appSecret = Boolean(process.env.META_APP_SECRET);
      const configId = Boolean(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID);
      const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      const versionReady = Boolean(graphVersion);
      const encryptionKey = Boolean(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY);
      const webhookVerifyToken = Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN);

      sendJson(res, {
        configured: appId && appSecret && configId && serviceRole && versionReady && encryptionKey && webhookVerifyToken,
        appId,
        appSecret,
        configId,
        serviceRole,
        graphVersion: versionReady,
        encryptionKey,
        webhookVerifyToken,
      });
      return;
    }

    if (cleanPath === "/api/meta/config" && req.method === "GET") {
      const appId = process.env.META_APP_ID || "";
      const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || "";
      sendJson(res, {
        configured: Boolean(appId && configId && graphVersion),
        appId,
        configId,
        graphVersion,
      });
      return;
    }

    if (cleanPath === "/api/meta/embedded-signup/complete" && req.method === "POST") {
      await completeEmbeddedSignup(req, res);
      return;
    }

    if (cleanPath === "/health") {
      sendJson(res, { status: "ok", service: "whatsapp-web" });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    if (!existsSync(distDir) || !existsSync(indexHtml)) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Build output not found. Run npm run build first.");
      return;
    }

    const requested = cleanPath === "/" ? "/index.html" : cleanPath;
    const candidate = resolveSafeDistPath(requested);
    const target = candidate.startsWith(`${distDir}${path.sep}`) && existsSync(candidate) ? candidate : indexHtml;

    if (existsSync(target) && statSync(target).isFile()) {
      if (path.extname(target) === ".html" && !requested.endsWith(".html")) {
        const html = readFileSync(target, "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      const { filePath, mime } = servePath(target);
      if (req.method === "HEAD") {
        const size = statFs(filePath).size;
        res.writeHead(200, { "content-type": mime, "content-length": size });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": mime });
      createReadStream(filePath).pipe(res);
      return;
    }

    const indexContents = readFileSync(indexHtml);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(indexContents);
  } catch (error) {
    console.error("Failed to handle WhatsApp service request", error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`MARK WhatsApp service listening on http://${host}:${port}`);
});