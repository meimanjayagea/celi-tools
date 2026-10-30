"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClientSupabase } from "../lib/supabase";

export type User = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
};

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
} | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let supabase: ReturnType<typeof createClientSupabase>;
    try { supabase = createClientSupabase(); }
    catch { const timer = setTimeout(() => setLoading(false), 0); return () => clearTimeout(timer); }

    let active = true;
    let changed = false;
    // Session data drives presentation only; server callbacks validate sign-in.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || changed) return;
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              user_metadata: session.user.user_metadata,
            }
          : null
      );
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        changed = true;
        if (!active) return;
        setUser(
          session?.user
            ? {
                id: session.user.id,
                email: session.user.email ?? null,
                user_metadata: session.user.user_metadata,
              }
            : null
        );
        setLoading(false);
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
