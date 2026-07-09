import { checkPolicy, type PolicyCheckResult } from "../../policy/policy-store.js";
import { isSupabaseConfigured } from "../../../features/supabase-client.js";

export interface PolicyDenial {
  denied: true;
  message: string;
  policyId: string | null;
}

/**
 * Guard de policies para tools de delegação. Retorna null se permitido;
 * caso contrário retorna dados do bloqueio. Falha aberta (não bloqueia)
 * se o check em si der erro, para não derrubar delegações por instabilidade.
 */
export async function guardDelegation(
  prompt: string,
  action: string,
): Promise<PolicyDenial | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  let result: PolicyCheckResult;
  try {
    result = await checkPolicy({ intent: prompt, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[policy-guard] checkPolicy falhou (${action}): ${message}`);
    return null;
  }

  if (result.allowed) {
    return null;
  }

  return {
    denied: true,
    message: result.reason ?? "Ação bloqueada por policy.",
    policyId: result.matchedPolicy?.id ?? null,
  };
}
