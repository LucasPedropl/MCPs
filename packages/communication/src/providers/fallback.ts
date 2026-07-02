import type { BridgeProvider } from "../client/types.js";
import {
  runDelegation,
  type DelegateParams,
  type DelegationResult,
} from "../tools/delegation.js";
import {
  getCircuitBreakerStats,
  isProviderCircuitAvailable,
  recordProviderFailure,
  recordProviderSuccess,
} from "./circuit-breaker.js";

export const DEFAULT_FALLBACK_CHAIN: BridgeProvider[] = ["antigravity", "cursor", "copilot"];

export function isFallbackEnabled(): boolean {
  return process.env["BRIDGE_FALLBACK_ENABLED"] !== "0";
}

function resolveChain(preferred: BridgeProvider, chain?: BridgeProvider[]): BridgeProvider[] {
  const base = chain ?? DEFAULT_FALLBACK_CHAIN;
  if (base[0] === preferred) {
    return base;
  }
  const rest = base.filter((p) => p !== preferred);
  return [preferred, ...rest];
}

export type FallbackDelegationResult = DelegationResult & {
  attemptedProviders: BridgeProvider[];
  fallbackUsed: boolean;
  skippedProviders?: BridgeProvider[];
};

/** Executa delegação com fallback chain e circuit breaker. */
export async function runDelegationWithFallback(
  params: DelegateParams,
  chain?: BridgeProvider[],
): Promise<FallbackDelegationResult> {
  if (!isFallbackEnabled()) {
    const result = await runDelegation(params);
    return {
      ...result,
      attemptedProviders: [params.provider],
      fallbackUsed: false,
    };
  }

  const providers = resolveChain(params.provider, chain);
  const attempted: BridgeProvider[] = [];
  const skipped: BridgeProvider[] = [];
  const failureLog: Array<{ provider: BridgeProvider; error: string }> = [];

  for (const provider of providers) {
    if (!isProviderCircuitAvailable(provider)) {
      skipped.push(provider);
      continue;
    }

    attempted.push(provider);
    try {
      const result = await runDelegation({ ...params, provider });
      if (result.success) {
        recordProviderSuccess(provider);
        return {
          ...result,
          attemptedProviders: attempted,
          fallbackUsed: provider !== params.provider,
          skippedProviders: skipped.length > 0 ? skipped : undefined,
        };
      }

      failureLog.push({ provider, error: result.message });
      recordProviderFailure(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failureLog.push({ provider, error: message });
      recordProviderFailure(provider);
    }
  }

  const failureSummary = failureLog.map((f) => `${f.provider}: ${f.error}`).join(" | ");

  return {
    success: false,
    message: `Fallback esgotado (${attempted.join(" → ") || "nenhum"}): ${failureSummary || "Nenhum provider disponível"}`,
    attemptedProviders: attempted,
    fallbackUsed: attempted.length > 1,
    skippedProviders: skipped.length > 0 ? skipped : undefined,
  };
}

export { getCircuitBreakerStats };
