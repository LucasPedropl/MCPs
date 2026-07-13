import type {
  DecisionRecord,
  PitfallRecord,
  PreferenceRecord,
} from "../memory/memory-store.js";

export interface SlimMemoryRecall {
  preferences: Array<{ key: string; value: unknown; scope: string }>;
  decisions: Array<{
    topic: string;
    chosen_option: string;
    rationale: string;
  }>;
  pitfalls: Array<{ symptom: string; fix: string }>;
}

export function slimMemoryRecall(input: {
  preferences: PreferenceRecord[];
  decisions: DecisionRecord[];
  pitfalls: PitfallRecord[];
  preferenceLimit?: number;
  decisionLimit?: number;
  pitfallLimit?: number;
}): SlimMemoryRecall {
  return {
    preferences: input.preferences.slice(0, input.preferenceLimit ?? 6).map((pref) => ({
      key: pref.key,
      value: pref.value_json,
      scope: pref.scope,
    })),
    decisions: input.decisions.slice(0, input.decisionLimit ?? 5).map((decision) => ({
      topic: decision.topic,
      chosen_option: decision.chosen_option,
      rationale: decision.rationale ?? "",
    })),
    pitfalls: input.pitfalls.slice(0, input.pitfallLimit ?? 5).map((pitfall) => ({
      symptom: pitfall.symptom,
      fix: pitfall.fix,
    })),
  };
}
