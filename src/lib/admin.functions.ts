import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as admin from "./admin-data.server";
import { adminPreferences, saveAdminPreferences } from "./preferences.server";

export const getAdminRegistrationStatus = createServerFn({ method: "GET" })
  .handler(async () => admin.adminRegistrationStatus());

export const adminMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.info("[admin-auth] adminMe received authenticated request", { userIdPresent: Boolean(context.userId) });
    await admin.assertSuperAdmin(context.userId);
    console.info("[admin-auth] adminMe super_admin verification completed");
    return { ok: true, userId: context.userId };
  });

export const getAdminPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return adminPreferences(context.userId);
  });

export const saveAdminPreferenceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { language?: string; theme?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return saveAdminPreferences(context.userId, data);
  });

export const getAdminDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminDashboard();
  });

export const getAdminCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { search?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCustomers(data.search);
  });

export const getAdminCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCustomerDetail(data.id);
  });

export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "ACTIVE" | "SUSPENDED" }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSetCustomerStatus(context.userId, data.id, data.status);
  });

export const changeCustomerPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; planId: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminChangePlan(context.userId, data.id, data.planId);
  });

export const grantCustomerPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    customerId: string;
    planId?: string | null;
    duration?: string;
    expiresAt?: string | null;
    noExpiry?: boolean;
    reason?: string | null;
    unlimited?: boolean;
    action?: "GRANT" | "CHANGE" | "EXTEND";
  }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminGrantPlan(context.userId, data);
  });

export const grantPremiumEmoji = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    tenantId: string;
    duration?: string;
    expiresAt?: string | null;
    noExpiry?: boolean;
    action?: "GRANT" | "EXTEND";
    reason?: string | null;
    revoke?: boolean;
  }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminGrantPremiumEmoji(context.userId, data);
  });

export const forceLogoutCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminForceLogout(context.userId, data.id);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; confirmation: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminDeleteCustomer(context.userId, data.id, data.confirmation);
  });

export const resetCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; password: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminResetPassword(context.userId, data.id, data.password);
  });

export const saveCustomerNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; notes: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSaveNotes(context.userId, data.id, data.notes);
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    email: string;
    password: string;
    name?: string | null;
    planId?: string | null;
    durationDays?: number | null;
    status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
    unlimited?: boolean;
    reason?: string | null;
  }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCreateCustomer(context.userId, data);
  });

export const getPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminPlans();
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { plan: Record<string, unknown> }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSavePlan(context.userId, data.plan);
  });

export const getSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSubscriptions();
  });

export const getTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminTransactions();
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: string; txHash?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminUpdateTransaction(context.userId, data.id, data.status, data.txHash);
  });

export const traceInvoiceTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; txHash: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminTraceInvoiceTransaction(context.userId, data.id, data.txHash);
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "EXTEND" | "EXPIRE" | "CANCEL" | "GRANT_AGAIN"; days?: number; reason?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSubscriptionAction(context.userId, data);
  });

export const getUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminUsage();
  });

export const resetUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string; reason?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminResetUsage(context.userId, data.tenantId, data.reason);
  });

export const saveQuotaOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string; fields: Record<string, unknown>; expiresAt?: string | null; reason?: string | null }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSaveQuotaOverride(context.userId, data);
  });

export const getAdminNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminNotifications();
  });

export const sendAdminNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { customerIds?: string[]; all?: boolean; title: string; message: string; type: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; link?: string | null }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSendNotification(context.userId, data);
  });

export const getSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSettings();
  });

export const getRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminRegistration();
  });

export const saveRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { value: Record<string, unknown> }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSaveRegistration(context.userId, data.value);
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { key: "general" | "registration" | "payments" | "telegram" | "discovery" | "notifications"; value: Record<string, unknown> }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSaveSettings(context.userId, data.key, data.value);
  });

export const auditAdminSecurityAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { action: "ADMIN_EMAIL_CHANGED" | "ADMIN_PASSWORD_CHANGED"; details?: Record<string, unknown> }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminAuditSecurityAction(context.userId, data.action, data.details ?? {});
  });

export const checkBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCheckBot();
  });

export const checkTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCheckWebhook();
  });

export const registerTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminRegisterWebhook(context.userId);
  });

export const getLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: "system" | "admin"; search?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminLogs(data.kind, data.search);
  });
