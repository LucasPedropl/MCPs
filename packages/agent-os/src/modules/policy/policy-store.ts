import picomatch from "picomatch";
import { toPosix } from "@mcps/shared";
import { getSupabaseClient, isSupabaseConfigured } from "../../features/supabase-client.js";

export interface PolicyRule {
  effect: "allow" | "deny";
  reason?: string;
}

export interface PolicyRecord {
  id: string;
  intent: string;
  action_pattern: string;
  rule: PolicyRule;
  enabled: boolean;
  created_at: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  matchedPolicy?: PolicyRecord;
  matchedCount: number;
  reason?: string;
  warning?: string;
}

function parsePolicyRule(raw: unknown): PolicyRule {
  if (typeof raw === "object" && raw !== null && "effect" in raw) {
    const record = raw as { effect?: string; reason?: string };
    const effect = record.effect === "allow" ? "allow" : "deny";
    return { effect, reason: record.reason };
  }
  return { effect: "deny" };
}

function looksLikeGlob(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?") || pattern.includes("[");
}

function matchGlob(text: string, pattern: string): boolean {
  try {
    const matcher = picomatch(toPosix(pattern), { dot: true, nocase: true });
    return matcher(toPosix(text));
  } catch {
    return false;
  }
}

/**
 * Matching de patterns de policy, em ordem de precedência:
 * 1. "*" ou vazio → sempre casa
 * 2. Glob (contém * ? [) → picomatch case-insensitive, paths normalizados
 * 3. Regex EXPLÍCITA entre barras ("/.../") → RegExp case-insensitive
 * 4. Texto simples → igualdade ou prefixo com fronteira de palavra
 *    ("rm" casa "rm -rf x" mas NÃO "format" — substring gerava falsos positivos)
 */
export function matchesPattern(text: string, pattern: string): boolean {
  if (!pattern || pattern === "*") {
    return true;
  }

  if (looksLikeGlob(pattern)) {
    return matchGlob(text, pattern);
  }

  if (pattern.length > 2 && pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      return new RegExp(pattern.slice(1, -1), "i").test(text);
    } catch {
      return false;
    }
  }

  const normalizedText = text.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();
  if (normalizedText === normalizedPattern) {
    return true;
  }
  return (
    normalizedText.startsWith(normalizedPattern) &&
    !/[a-z0-9_]/.test(normalizedText.charAt(normalizedPattern.length))
  );
}

/**
 * Matching de actions com taxonomia "<tipo>:<valor>":
 * write:<glob de path>, shell:<cmd>, delegate_task:<provider>, sql:<op>...
 * Se pattern e action têm prefixo tipado, o tipo deve bater e o valor é
 * comparado com matchesPattern. Sem prefixo, compara a string inteira.
 */
export function matchesAction(action: string, pattern: string): boolean {
  if (!pattern || pattern === "*") {
    return true;
  }

  const actionSep = action.indexOf(":");
  const patternSep = pattern.indexOf(":");

  if (actionSep > 0 && patternSep > 0) {
    const actionType = action.slice(0, actionSep).toLowerCase();
    const patternType = pattern.slice(0, patternSep).toLowerCase();
    if (actionType !== patternType) {
      return false;
    }
    return matchesPattern(action.slice(actionSep + 1), pattern.slice(patternSep + 1));
  }

  return matchesPattern(action, pattern);
}

export async function listPolicies(): Promise<PolicyRecord[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar policies: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as Omit<PolicyRecord, "rule">),
    rule: parsePolicyRule((row as { rule: unknown }).rule),
  }));
}

export async function upsertPolicy(input: {
  id?: string;
  intent: string;
  actionPattern: string;
  rule: PolicyRule;
  enabled?: boolean;
}): Promise<PolicyRecord> {
  const client = getSupabaseClient();
  const payload = {
    intent: input.intent,
    action_pattern: input.actionPattern,
    rule: input.rule,
    enabled: input.enabled ?? true,
  };

  if (input.id) {
    const { data, error } = await client
      .from("agent_policies")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Falha ao atualizar policy: ${error.message}`);
    }

    return {
      ...(data as Omit<PolicyRecord, "rule">),
      rule: parsePolicyRule((data as { rule: unknown }).rule),
    };
  }

  const { data, error } = await client
    .from("agent_policies")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao criar policy: ${error.message}`);
  }

  return {
    ...(data as Omit<PolicyRecord, "rule">),
    rule: parsePolicyRule((data as { rule: unknown }).rule),
  };
}

export async function deletePolicy(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_policies").delete().eq("id", id);
  if (error) {
    throw new Error(`Falha ao deletar policy: ${error.message}`);
  }
}

/** Avalia policies habilitadas contra intent e action. Deny tem precedência. */
export async function checkPolicy(input: {
  intent: string;
  action: string;
}): Promise<PolicyCheckResult> {
  if (!isSupabaseConfigured()) {
    return {
      allowed: true,
      matchedCount: 0,
      reason: "Supabase não configurado — policy check ignorado.",
      warning: "Nenhuma policy foi avaliada (Supabase ausente). Não trate como allow explícito.",
    };
  }

  const policies = await listPolicies();
  const matched = policies.filter(
    (policy) =>
      policy.enabled &&
      matchesPattern(input.intent, policy.intent) &&
      matchesAction(input.action, policy.action_pattern),
  );

  const deny = matched.find((policy) => policy.rule.effect === "deny");
  if (deny) {
    return {
      allowed: false,
      matchedPolicy: deny,
      matchedCount: matched.length,
      reason: deny.rule.reason ?? `Bloqueado pela policy ${deny.id}`,
    };
  }

  const allow = matched.find((policy) => policy.rule.effect === "allow");
  if (allow) {
    return {
      allowed: true,
      matchedPolicy: allow,
      matchedCount: matched.length,
      reason: allow.rule.reason,
    };
  }

  return {
    allowed: true,
    matchedCount: 0,
    warning:
      "Nenhuma policy casou com intent/action — allow por default, não por regra explícita. " +
      "Verifique se o action_pattern das suas policies cobre esta action.",
  };
}

/**
 * Avalia apenas policies deny contra uma action (sem intent), útil para
 * enforcement em hooks (write:<path>, shell:<cmd>).
 */
export function evaluateDenyPolicies(
  action: string,
  policies: PolicyRecord[],
): PolicyCheckResult {
  const matched = policies.filter(
    (policy) =>
      policy.enabled &&
      policy.rule.effect === "deny" &&
      matchesAction(action, policy.action_pattern),
  );

  const deny = matched[0];
  if (deny) {
    return {
      allowed: false,
      matchedPolicy: deny,
      matchedCount: matched.length,
      reason: deny.rule.reason ?? `Bloqueado pela policy ${deny.id}`,
    };
  }

  return { allowed: true, matchedCount: 0 };
}
