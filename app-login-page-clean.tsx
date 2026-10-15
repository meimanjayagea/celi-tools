"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const loginWithGoogle = async () => {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center">
      <button onClick={loginWithGoogle} className="rounded bg-black px-4 py-2 text-white">
        Masuk dengan Google
      </button>
    </main>
  );
}
