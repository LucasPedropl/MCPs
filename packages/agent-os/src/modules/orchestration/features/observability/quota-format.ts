export interface AntigravityModelConfigRaw {
  label?: string;
  modelOrAlias?: { model?: string };
  quotaInfo?: { remainingFraction?: number; resetTime?: string };
}

export interface QuotaPool {
  name: string;
  usedPercent: number;
  remainingPercent: number;
  resetTime: string | null;
  models: string[];
}

export interface QuotaFormatResult {
  pools: QuotaPool[];
}

function isExternalModel(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes("claude") || lower.includes("gpt");
}

function buildPool(name: string, configs: AntigravityModelConfigRaw[]): QuotaPool {
  const models = configs.map((c) => c.label ?? c.modelOrAlias?.model ?? "unknown");
  const remainingFraction = configs[0]?.quotaInfo?.remainingFraction ?? 1;
  const remainingPercent = Number((remainingFraction * 100).toFixed(1));
  const usedPercent = Number((100 - remainingPercent).toFixed(1));

  return {
    name,
    usedPercent,
    remainingPercent,
    resetTime: configs[0]?.quotaInfo?.resetTime ?? null,
    models,
  };
}

/** Agrupa quotas Antigravity em pools Gemini vs Claude/GPT com % usado e restante. */
export function formatAntigravityQuotas(
  rawConfigs: AntigravityModelConfigRaw[],
): QuotaFormatResult {
  const geminiConfigs: AntigravityModelConfigRaw[] = [];
  const externalConfigs: AntigravityModelConfigRaw[] = [];

  for (const config of rawConfigs) {
    const label = config.label ?? config.modelOrAlias?.model ?? "";
    if (isExternalModel(label)) {
      externalConfigs.push(config);
    } else {
      geminiConfigs.push(config);
    }
  }

  const pools: QuotaPool[] = [];
  if (geminiConfigs.length > 0) {
    pools.push(buildPool("gemini", geminiConfigs));
  }
  if (externalConfigs.length > 0) {
    pools.push(buildPool("external", externalConfigs));
  }

  return { pools };
}
