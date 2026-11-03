import type { Metadata } from "next";
import StickyNotes from "../../components/sticky-notes";
import { requireAuth } from "../../lib/require-auth";

export const metadata: Metadata = {
  title: "Sticky Note — celimanapp",
  description: "Catatan pribadi dengan tag, posisi bebas, dan pengingat.",
};

export default async function Page() {
  await requireAuth("/sticky-notes");
  return <StickyNotes />;
}
