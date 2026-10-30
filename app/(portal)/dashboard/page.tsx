import type { Metadata } from "next";
import Dashboard from "../../components/dashboard";
export const metadata: Metadata = {
  title: "Dashboard — Celi Tools",
  description: "Workspace JSON, konversi, encoding, dan kriptografi dalam satu portal.",
};
export default function Page() { return <Dashboard />; }
