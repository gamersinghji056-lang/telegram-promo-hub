import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as admin from "./admin-data.server";

export const adminMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return { ok: true, userId: context.userId };
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
  .inputValidator((i: { email: string; password: string; name?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCreateCustomer(context.userId, data.email, data.password, data.name);
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

export const getSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSettings();
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { key: "general" | "registration" | "payments" | "telegram" | "discovery"; value: Record<string, unknown> }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminSaveSettings(context.userId, data.key, data.value);
  });

export const checkBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminCheckBot();
  });

export const getLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: "system" | "admin"; search?: string }) => i)
  .handler(async ({ context, data }) => {
    await admin.assertSuperAdmin(context.userId);
    return admin.adminLogs(data.kind, data.search);
  });
