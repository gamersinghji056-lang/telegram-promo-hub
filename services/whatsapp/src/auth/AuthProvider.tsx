import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  workspace: Workspace | null;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadWorkspace(userId: string): Promise<Workspace | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id,name,slug)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("WA MARK workspace load failed:", error.message);
    return null;
  }

  const raw = data?.workspaces as unknown;
  const workspace = Array.isArray(raw) ? raw[0] : raw;
  if (!workspace || typeof workspace !== "object") return null;

  const value = workspace as { id?: string; name?: string; slug?: string };
  if (!value.id || !value.name || !value.slug) return null;

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    role: data?.role || "member",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  const refreshWorkspace = async () => {
    if (!session?.user?.id) {
      setWorkspace(null);
      return;
    }
    setWorkspace(await loadWorkspace(session.user.id));
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        setWorkspace(await loadWorkspace(data.session.user.id));
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setWorkspace(nextSession?.user?.id ? await loadWorkspace(nextSession.user.id) : null);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    workspace,
    refreshWorkspace,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
  }), [loading, session, workspace]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}