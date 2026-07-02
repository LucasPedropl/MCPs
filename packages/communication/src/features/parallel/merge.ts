import type {
  MergeStrategy,
  ParallelMergeResult,
  ParallelProviderResult,
  ParallelTargetProvider,
} from "./types.js";

function scoreResponse(text: string): number {
  let score = text.length;
  const codeBlocks = (text.match(/```/g) ?? []).length / 2;
  score += codeBlocks * 200;
  if (/\n[-*]\s/.test(text)) {
    score += 100;
  }
  if (/\berro\b|\berror\b|\bfalha\b|\bfailed\b/i.test(text)) {
    score -= 150;
  }
  return score;
}

function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 24);
}

function mergeConsensus(results: ParallelProviderResult[]): {
  merged: string;
  consensusScore: number;
  winnerProvider?: ParallelTargetProvider;
} {
  const successful = results.filter((r) => r.success && r.response);
  if (successful.length === 0) {
    return { merged: "Nenhum provider retornou resposta válida.", consensusScore: 0 };
  }
  const [only] = successful;
  if (successful.length === 1 && only) {
    return {
      merged: only.response ?? "",
      consensusScore: 1,
      winnerProvider: only.provider,
    };
  }

  const lineCounts = new Map<string, { count: number; original: string; providers: Set<string> }>();

  for (const result of successful) {
    const seenInProvider = new Set<string>();
    for (const line of extractLines(result.response ?? "")) {
      if (seenInProvider.has(line)) {
        continue;
      }
      seenInProvider.add(line);
      const entry = lineCounts.get(line) ?? {
        count: 0,
        original: result.response?.split(/\r?\n/).find((l) => normalizeLine(l) === line) ?? line,
        providers: new Set<string>(),
      };
      entry.count += 1;
      entry.providers.add(result.provider);
      lineCounts.set(line, entry);
    }
  }

  const consensusLines = [...lineCounts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.original);

  const consensusScore =
    consensusLines.length > 0
      ? consensusLines.length / Math.max(...successful.map((r) => extractLines(r.response ?? "").length), 1)
      : 0;

  if (consensusLines.length >= 2) {
    const providers = [
      ...new Set(
        [...lineCounts.values()]
          .filter((e) => e.count >= 2)
          .flatMap((e) => [...e.providers]),
      ),
    ];
    const winnerProvider = providers[0] as ParallelTargetProvider | undefined;
    return {
      merged: consensusLines.join("\n"),
      consensusScore,
      winnerProvider,
    };
  }

  const best = mergeBestOf(results);
  return {
    merged: best.merged,
    consensusScore: 0,
    winnerProvider: best.winnerProvider,
  };
}

function mergeBestOf(results: ParallelProviderResult[]): {
  merged: string;
  winnerProvider?: ParallelTargetProvider;
} {
  const successful = results.filter((r) => r.success && r.response);
  if (successful.length === 0) {
    const errors = results.map((r) => `[${r.provider}] ${r.error ?? "sem resposta"}`).join("\n");
    return { merged: errors };
  }

  const winner = successful.reduce((best, current) =>
    scoreResponse(current.response ?? "") > scoreResponse(best.response ?? "") ? current : best,
  );

  return { merged: winner.response ?? "", winnerProvider: winner.provider };
}

function mergeRawAll(results: ParallelProviderResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      provider: r.provider,
      success: r.success,
      response: r.response ?? null,
      error: r.error ?? null,
      model: r.model ?? null,
      durationMs: r.durationMs,
    })),
    null,
    2,
  );
}

/** Aplica estratégia de merge sobre resultados paralelos. */
export function mergeParallelResults(
  strategy: MergeStrategy,
  results: ParallelProviderResult[],
): ParallelMergeResult {
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  if (strategy === "raw_all") {
    return {
      strategy,
      merged: mergeRawAll(results),
      providerResults: results,
      successCount,
      failureCount,
    };
  }

  if (strategy === "best_of") {
    const { merged, winnerProvider } = mergeBestOf(results);
    return {
      strategy,
      merged,
      providerResults: results,
      winnerProvider,
      successCount,
      failureCount,
    };
  }

  const { merged, consensusScore, winnerProvider } = mergeConsensus(results);
  return {
    strategy,
    merged,
    providerResults: results,
    winnerProvider,
    consensusScore,
    successCount,
    failureCount,
  };
}
