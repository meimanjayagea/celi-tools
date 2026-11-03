import type { Metadata } from "next";
import Dashboard from "../../components/dashboard";
import { requireAuth } from "../../lib/require-auth";
export const metadata: Metadata = {
  title: "Dashboard — celimanapp",
  description: "Workspace JSON, konversi, encoding, dan kriptografi dalam satu portal.",
};
export default async function Page() { await requireAuth("/dashboard"); return <Dashboard />; }
