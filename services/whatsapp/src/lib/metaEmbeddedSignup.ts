import { supabase } from "./supabase";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type MetaPublicConfig = {
  configured: boolean;
  appId?: string;
  configId?: string;
  graphVersion?: string;
};

type SignupSelection = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

let sdkPromise: Promise<void> | null = null;

export async function getMetaPublicConfig(): Promise<MetaPublicConfig> {
  const response = await fetch("/api/meta/config");
  if (!response.ok) throw new Error("Unable to read Meta configuration");
  return response.json();
}

export function loadFacebookSdk(appId: string, graphVersion: string) {
  if (window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: graphVersion,
      });
      resolve();
    };

    if (document.getElementById("facebook-jssdk")) return;

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Meta SDK"));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

function waitForEmbeddedSignupSelection() {
  return new Promise<SignupSelection>((resolve) => {
    let resolved = false;
    const timer = window.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener("message", onMessage);
        resolve({});
      }
    }, 120000);

    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }

      if (!payload || typeof payload !== "object") return;
      const record = payload as Record<string, unknown>;
      if (record.type !== "WA_EMBEDDED_SIGNUP") return;

      const data = record.data as Record<string, unknown> | undefined;
      if (!data) return;

      if (record.event === "FINISH" || record.event === "FINISH_ONLY_WABA") {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve({
          wabaId: typeof data.waba_id === "string" ? data.waba_id : undefined,
          phoneNumberId: typeof data.phone_number_id === "string" ? data.phone_number_id : undefined,
          businessId: typeof data.business_id === "string" ? data.business_id : undefined,
        });
      }
    }

    window.addEventListener("message", onMessage);
  });
}

export async function launchMetaEmbeddedSignup(accountId: string) {
  const config = await getMetaPublicConfig();
  if (!config.configured || !config.appId || !config.configId || !config.graphVersion) {
    throw new Error("Meta Embedded Signup is not fully configured");
  }

  await loadFacebookSdk(config.appId, config.graphVersion);
  const selectionPromise = waitForEmbeddedSignupSelection();

  const code = await new Promise<string>((resolve, reject) => {
    window.FB?.login(
      (response) => {
        const receivedCode = response.authResponse?.code;
        if (!receivedCode) {
          reject(new Error("Meta signup did not return an authorization code"));
          return;
        }
        resolve(receivedCode);
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
        },
      }
    );
  });

  const selection = await selectionPromise;
  if (!selection.wabaId || !selection.phoneNumberId) {
    throw new Error("Meta signup completed without WABA or phone number details");
  }

  if (!supabase) throw new Error("Supabase not configured");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your WA MARK session expired. Sign in again.");

  const response = await fetch("/api/meta/embedded-signup/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      accountId,
      code,
      wabaId: selection.wabaId,
      phoneNumberId: selection.phoneNumberId,
      businessId: selection.businessId || null,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Failed to finish Meta connection");
  }

  return body;
}