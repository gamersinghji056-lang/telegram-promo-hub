import { createServerFn } from "@tanstack/react-start";
import {
  changeCustomerPassword,
  getCustomerAccountSettings,
  loginCustomerFromFlow,
  logoutCustomer,
  registerCustomerFromFlow,
  resolveAuth,
  updateCustomerName,
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

export const getAccountSettings = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) =>
    getCustomerAccountSettings(await resolveAuth(i.auth)),
  );

export const updateAccountName = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { name: string }) => i)
  .handler(async ({ data: i }) =>
    updateCustomerName(
      await resolveAuth(i.auth),
      i.name,
    ),
  );

export const updateAccountPassword = createServerFn({ method: "POST" })
  .inputValidator(
    (
      i: Auth & {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
      },
    ) => i,
  )
  .handler(async ({ data: i }) =>
    changeCustomerPassword(
      await resolveAuth(i.auth),
      {
        currentPassword: i.currentPassword,
        newPassword: i.newPassword,
        confirmPassword: i.confirmPassword,
      },
    ),
  );

export const getDashboard = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.dashboard(await resolveAuth(i.auth)));

export const getConnections = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listConnections(await resolveAuth(i.auth)));

export const addConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { label: string }) => i)
  .handler(async ({ data: i }) => data.createConnection(await resolveAuth(i.auth), i.label));

export const startConnectionLogin = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { label: string; phone: string }) => i)
  .handler(async ({ data: i }) =>
    data.startConnectionLogin(await resolveAuth(i.auth), { label: i.label, phone: i.phone }),
  );

export const verifyConnectionCode = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string; code: string }) => i)
  .handler(async ({ data: i }) =>
    data.verifyConnectionCode(await resolveAuth(i.auth), {
      connectionId: i.connectionId,
      code: i.code,
    }),
  );

export const verifyConnectionPassword = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string; password: string }) => i)
  .handler(async ({ data: i }) =>
    data.verifyConnectionPassword(await resolveAuth(i.auth), {
      connectionId: i.connectionId,
      password: i.password,
    }),
  );

export const checkConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.checkConnection(await resolveAuth(i.auth), i.id));

export const reconnectConnection = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.reconnectConnection(await resolveAuth(i.auth), i.id));

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
  .inputValidator((i: Auth & { connectionId: string; keywords: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.discoverGroups(await resolveAuth(i.auth), i.connectionId, i.keywords),
  );

export const getGroupDiscoveryState = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.groupDiscoveryState(await resolveAuth(i.auth)));

export const startGroupDiscovery = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string; keywords?: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.startGroupDiscovery(await resolveAuth(i.auth), i.connectionId, i.keywords),
  );

export const pauseGroupDiscovery = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.pauseGroupDiscovery(await resolveAuth(i.auth)));

export const searchGroupDiscoveryNow = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId?: string | null; keywords?: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.searchGroupDiscoveryNow(await resolveAuth(i.auth), i.connectionId ?? null, i.keywords),
  );

export const addGroupByUsername = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string; username: string; keywords: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.addGroupByUsername(await resolveAuth(i.auth), i.connectionId, i.username, i.keywords),
  );

export const addApprovedGroupByUsername = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { username: string }) => i)
  .handler(async ({ data: i }) =>
    data.addApprovedGroupByUsername(await resolveAuth(i.auth), i.username),
  );

export const importApprovedGroups = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { folderLink: string }) => i)
  .handler(async ({ data: i }) =>
    data.importApprovedGroups(await resolveAuth(i.auth), i.folderLink),
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

export const joinGroup = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string; connectionId: string }) => i)
  .handler(async ({ data: i }) => data.joinGroup(await resolveAuth(i.auth), i.id, i.connectionId));

export const getBulkJoinState = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.bulkJoinState(await resolveAuth(i.auth)));

export const startBulkJoin = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string }) => i)
  .handler(async ({ data: i }) => data.startBulkJoin(await resolveAuth(i.auth), i.connectionId));

export const pauseBulkJoin = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.pauseBulkJoin(await resolveAuth(i.auth)));

export const resumeBulkJoin = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.resumeBulkJoin(await resolveAuth(i.auth)));

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

export const getGroupCategories = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.listGroupCategories(await resolveAuth(i.auth)));

export const getGroupWritabilitySummary = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.groupWritabilitySummary(await resolveAuth(i.auth)));

export const verifyWritableGroups = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { limit?: number }) => i)
  .handler(async ({ data: i }) =>
    data.verifyWritableGroups(await resolveAuth(i.auth), i.limit ?? 40),
  );

export const testWritableGroups = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { connectionId: string; groupIds: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.testWritableGroups(await resolveAuth(i.auth), {
      connectionId: i.connectionId,
      groupIds: i.groupIds,
    }),
  );

export const getGroupCategoryDetail = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.groupCategoryDetail(await resolveAuth(i.auth), i.id));

export const saveGroupCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (i: Auth & {
      id?: string | null;
      name: string;
      group_ids: string[];
      bypass_writable_check?: boolean;
    }) => i,
  )
  .handler(async ({ data: i }) =>
    data.saveGroupCategory(await resolveAuth(i.auth), {
      id: i.id ?? null,
      name: i.name,
      group_ids: i.group_ids,
      bypass_writable_check: i.bypass_writable_check,
    }),
  );

export const deleteGroupCategory = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.deleteGroupCategory(await resolveAuth(i.auth), i.id));

export const findAudience = createServerFn({ method: "POST" })
  .inputValidator(
    (i: Auth & {
      groupIds?: string[];
      onlyNew?: boolean;
      filter?: "ALL_ELIGIBLE" | "ACTIVE_POSTERS" | "ACTIVE_30_DAYS" | "RECENTLY_ONLINE";
      excludeInactive?: boolean;
      page?: number;
      pageSize?: number;
    }) => i,
  )
  .handler(async ({ data: i }) =>
    data.findAudience(await resolveAuth(i.auth), {
      groupIds: i.groupIds ?? [],
      onlyNew: i.onlyNew ?? true,
      filter: i.filter,
      excludeInactive: i.excludeInactive,
      page: i.page,
      pageSize: i.pageSize,
    }),
  );

export const selectAudienceIds = createServerFn({ method: "POST" })
  .inputValidator(
    (i: Auth & {
      groupIds?: string[];
      onlyNew?: boolean;
      filter?: "ALL_ELIGIBLE" | "ACTIVE_POSTERS" | "ACTIVE_30_DAYS" | "RECENTLY_ONLINE";
      excludeInactive?: boolean;
      rangeFrom?: number | null;
      rangeTo?: number | null;
    }) => i,
  )
  .handler(async ({ data: i }) =>
    data.selectAudienceIds(await resolveAuth(i.auth), {
      groupIds: i.groupIds ?? [],
      onlyNew: i.onlyNew ?? true,
      filter: i.filter,
      excludeInactive: i.excludeInactive,
      rangeFrom: i.rangeFrom,
      rangeTo: i.rangeTo,
    }),
  );

export const discoverAudience = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { groupIds: string[] }) => i)
  .handler(async ({ data: i }) => data.discoverAudience(await resolveAuth(i.auth), i.groupIds));

export const getAudienceDiscoveryState = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.audienceDiscoveryState(await resolveAuth(i.auth)));

export const startAudienceDiscovery = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { groupIds: string[] }) => i)
  .handler(async ({ data: i }) =>
    data.startAudienceDiscovery(await resolveAuth(i.auth), i.groupIds),
  );

export const pauseAudienceDiscovery = createServerFn({ method: "POST" })
  .inputValidator((i: Auth) => i)
  .handler(async ({ data: i }) => data.pauseAudienceDiscovery(await resolveAuth(i.auth)));

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
        group_category_id?: string | null;
        contact_ids: string[];
        scheduled_at?: string | null;
        start_now: boolean;
        exclude_previously_contacted?: boolean;
        min_delay_seconds?: number | null;
        max_delay_seconds?: number | null;
        cycle_delay_minutes?: number | null;
        bypass_writable_check?: boolean;
      },
    ) => i,
  )
  .handler(async ({ data: i }) => data.createCampaign(await resolveAuth(i.auth), i));

export const controlCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (
      i: Auth & {
        id: string;
        action: "START" | "PAUSE" | "RESUME" | "RESTART" | "STOP";
      },
    ) => i,
  )
  .handler(async ({ data: i }) =>
    data.controlCampaign(await resolveAuth(i.auth), i.id, i.action),
  );

export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (
      i: Auth & {
        id: string;
        name: string;
        connection_id?: string | null;
        group_category_id?: string | null;
        message: {
          text?: string;
          media_type?: string | null;
          media_url?: string | null;
          buttons?: { text: string; url: string }[];
        };
        min_delay_seconds?: number | null;
        max_delay_seconds?: number | null;
        cycle_delay_minutes?: number | null;
      },
    ) => i,
  )
  .handler(async ({ data: i }) =>
    data.updateCampaign(await resolveAuth(i.auth), i.id, {
      name: i.name,
      connection_id: i.connection_id ?? null,
      group_category_id: i.group_category_id ?? null,
      message: i.message,
      min_delay_seconds: i.min_delay_seconds ?? null,
      max_delay_seconds: i.max_delay_seconds ?? null,
      cycle_delay_minutes: i.cycle_delay_minutes ?? null,
    }),
  );

export const deleteCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: Auth & { id: string }) => i)
  .handler(async ({ data: i }) => data.deleteCampaign(await resolveAuth(i.auth), i.id));

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
    return {
      email: ctx.email,
      name: ctx.name,
      telegramUserId: ctx.telegramUserId,
    };
  });
