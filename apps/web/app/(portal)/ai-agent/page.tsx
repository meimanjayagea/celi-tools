import AiAgentSettings from "../../components/ai-agent-settings";
import { auth } from "../../../auth";
import { isAiAgentAdmin } from "../../lib/ai-agent/admin";
import { redirect } from "next/navigation";

export default async function AiAgentSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !isAiAgentAdmin(session.user.email)) redirect("/dashboard");
  return <main id="portal-content" className="page-shell"><AiAgentSettings /></main>;
}
