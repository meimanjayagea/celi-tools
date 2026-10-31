import type { Metadata } from "next";
import JsonWorkbench from "../../components/json-workbench";
import { requireAuth } from "../../lib/require-auth";
import { pathWithSearchParams } from "../../lib/redirect-path";
export const metadata: Metadata = { title: "JSON Workspace — Celi Tools" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth(pathWithSearchParams("/json", await searchParams));
  return <JsonWorkbench />;
}
