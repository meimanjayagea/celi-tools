"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type User = {
  id: string;
  email: string | null;
};

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
} | undefined>(undefined);

function AuthState({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const user = data?.user?.id
    ? { id: data.user.id, email: data.user.email ?? null }
    : null;

  return (
    <AuthContext.Provider value={{ user, loading: status === "loading" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok)
      .then(ready => { if (!controller.signal.aborted) setAuthReady(ready); })
      .catch(() => { if (!controller.signal.aborted) setAuthReady(false); });
    return () => controller.abort();
  }, []);

  if (authReady !== true) {
    return (
      <AuthContext.Provider value={{ user: null, loading: authReady === null }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <SessionProvider>
      <AuthState>{children}</AuthState>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
