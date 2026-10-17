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
} | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClientSupabase();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user }}>
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