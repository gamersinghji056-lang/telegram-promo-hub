import { supabase } from "./supabase";

export type WhatsAppAccount = {
  id: string;
  workspace_id: string;
  provider: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listWhatsAppAccounts(workspaceId: string) {
  if (!supabase) return { data: [] as WhatsAppAccount[], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .select("id,workspace_id,provider,waba_id,phone_number_id,display_phone_number,verified_name,status,connected_at,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return { data: (data ?? []) as WhatsAppAccount[], error };
}

export async function createPendingWhatsAppAccount(workspaceId: string) {
  if (!supabase) return { data: null as WhatsAppAccount | null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .insert({
      workspace_id: workspaceId,
      provider: "meta_cloud",
      status: "connecting",
    })
    .select("id,workspace_id,provider,waba_id,phone_number_id,display_phone_number,verified_name,status,connected_at,created_at,updated_at")
    .single();

  return { data: data as WhatsAppAccount | null, error };
}

export async function removeWhatsAppAccount(accountId: string) {
  if (!supabase) return { error: new Error("Supabase not configured") };
  return supabase.from("whatsapp_accounts").delete().eq("id", accountId);
}