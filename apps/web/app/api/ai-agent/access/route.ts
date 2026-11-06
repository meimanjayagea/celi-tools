import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { isAiAgentAdmin } from "../../../lib/ai-agent/admin";
import { aiJson } from "../../../lib/ai-agent/http";
import { listProviderProfiles } from "../../../lib/ai-agent/repository";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return aiJson({ isAdmin:false, available:false }, 401);
    const isAdmin = isAiAgentAdmin(session.user.email);
    let available = false;
    try {
      if (pool) {
        const { rows } = await pool.query(`SELECT EXISTS(SELECT 1 FROM celi_app.ai_provider_profiles WHERE is_active AND api_key_ciphertext IS NOT NULL) AS configured`);
        available = Boolean(rows[0]?.configured);
      }
    } catch { available = false; }
    if (isAdmin && pool && process.env.AI_AGENT_CREDENTIALS_ENCRYPTION_KEY) {
      try { await listProviderProfiles(); } catch { /* Migration not applied yet. */ }
    }
    return aiJson({ isAdmin, available });
  } catch { return aiJson({ isAdmin:false, available:false }, 503); }
}
