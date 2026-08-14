import { createServerFn } from "@tanstack/react-start";
import {
  loginCustomerFromFlow,
  logoutCustomer,
  registerCustomerFromFlow,
  resolveAuth,
} from "./customer-auth.server";
import * as data from "./customer-data.server";

type Auth = { auth: string };

export const completeRegistration = createServerFn({ method: "POST" })
  .inputValidator(
    (i: {
      flowToken: string;
      email: string;
      password: string;
      confirmPassword: string;
      name?: string | null;
    }) => i,
  )
  .handler(async ({ data: i }) => registerCustomerFromFlow(i));

export const completeLogin = createServerFn({ method: "POST" })
  .inputValidator((i: { flowToken: string; email: string; password: string }) => i)
  .handler(async ({ data: i }) => loginCustomerFromFlow(i));

export const logout = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => logoutCustomer(i.auth));

export const getDashboard = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.dashboard(await resolveAuth(i.auth)));

export const getConnections = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listConnections(await resolveAuth(i.auth)));

export const addConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { label: string }) => i)
  .handler(async ({ data: i }) => data.createConnection(await resolveAuth(i.auth), i.label));

export const checkConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.checkConnection(await resolveAuth(i.auth), i.id));

export const disconnectConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => {
    await data.disconnectConnection(await resolveAuth(i.auth), i.id);
    return { ok: true };
  });

export const removeConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => {
    await data.deleteConnection(await resolveAuth(i.auth), i.id);
    return { ok: true };
  });

export const getKeywords = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listKeywords(await resolveAuth(i.auth)));

export const addKeyword = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { keyword: string }) => i)
  .handler(async ({ data: i }) => data.addKeyword(await resolveAuth(i.auth), i.keyword));

export const removeKeyword = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.removeKeyword(await resolveAuth(i.auth), i.id));

export const runGroupDiscovery = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { keywords: string[] }) => i)
  .handler(async ({ data: i }) => data.discoverGroups(await resolveAuth(i.auth), i.keywords));

export const addGroupByUsername = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { username: string; keywords: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.addGroupByUsername(await resolveAuth(i.auth), i.username, i.keywords),
  );

export const getGroups = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { status?: string }) => i)
  .handler(async ({ data: i }) => data.listGroups(await resolveAuth(i.auth), i.status));

export const getGroupDetail = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.groupDetail(await resolveAuth(i.auth), i.id));

export const approveGroup = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string; connectionId?: string | null }) => i)
  .handler(async ({ data: i }) =>
    data.approveGroup(await resolveAuth(i.auth), i.id, i.connectionId ?? null),
  );

export const rejectGroup = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => {
    await data.rejectGroup(await resolveAuth(i.auth), i.id);
    return { ok: true };
  });

export const removeGroup = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => {
    await data.removeGroup(await resolveAuth(i.auth), i.id);
    return { ok: true };
  });

export const findAudience = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { groupIds: string[]; onlyNew: boolean }) => i)
  .handler(async ({ data: i }) =>
    data.findAudience(await resolveAuth(i.auth), i.groupIds, i.onlyNew),
  );

export const getContactHistory = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.contactHistory(await resolveAuth(i.auth)));

export const getTemplates = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listTemplates(await resolveAuth(i.auth)));

export const saveTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (
      i: Auth & {
        id?: string | null;
        name: string;
        body: string;
        media_type?: string | null;
        media_url?: string | null;
        buttons?: { text: string; url: string }[];
      },
    ) => i,
  )
  .handler(async ({ data: i }) => data.saveTemplate(await resolveAuth(i.auth), i));

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => {
    await data.deleteTemplate(await resolveAuth(i.auth), i.id);
    return { ok: true };
  });

export const getCampaigns = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { filter?: string }) => i)
  .handler(async ({ data: i }) => data.listCampaigns(await resolveAuth(i.auth), i.filter));

export const getCampaignDetail = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.campaignDetail(await resolveAuth(i.auth), i.id));

export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (
      i: Auth & {
        name: string;
        type: "GROUP" | "DM" | "GROUP_DM";
        connection_id?: string | null;
        template_id?: string | null;
        message: {
          text?: string;
          media_type?: string | null;
          media_url?: string | null;
          buttons?: { text: string; url: string }[];
        };
        group_ids: string[];
        contact_ids: string[];
        scheduled_at?: string | null;
        start_now: boolean;
      },
    ) => i,
  )
  .handler(async ({ data: i }) => data.createCampaign(await resolveAuth(i.auth), i));

export const controlCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string; action: "START" | "PAUSE" | "RESUME" | "STOP" }) => i)
  .handler(async ({ data: i }) => data.controlCampaign(await resolveAuth(i.auth), i.id, i.action));

export const getAnalytics = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.analytics(await resolveAuth(i.auth)));

export const getBilling = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.billing(await resolveAuth(i.auth)));

export const requestPayment = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { planId: string }) => i)
  .handler(async ({ data: i }) => data.requestPayment(await resolveAuth(i.auth), i.planId));

export const getNotifications = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listNotifications(await resolveAuth(i.auth)));

export const markNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => {
    await data.markNotificationsRead(await resolveAuth(i.auth));
    return { ok: true };
  });

export const getOwnActivity = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.ownActivity(await resolveAuth(i.auth)));

export const getSessionInfo = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => {
    const ctx = await resolveAuth(i.auth);
    return { email: ctx.email, name: ctx.name, telegramUserId: ctx.telegramUserId };
  });
