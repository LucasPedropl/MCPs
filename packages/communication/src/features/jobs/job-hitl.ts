import { appendJobEvent, updateJob } from "./job-store.js";
import type { PipelineStepRole } from "../pipeline/types.js";

export interface AwaitingApprovalState {
  stepIndex: number;
  role: PipelineStepRole;
  prompt: string;
  requestedAt: string;
  comment?: string;
}

export function isHitlEnabled(): boolean {
  return process.env["BRIDGE_HITL_ENABLED"] === "1";
}

export function isAgenticRole(role: PipelineStepRole): boolean {
  return role === "implement" || role === "fix";
}

/** Pausa pipeline aguardando aprovação humana antes de step agentic. */
export async function pauseForApproval(
  jobId: string,
  state: AwaitingApprovalState,
  metadata: Record<string, unknown>,
): Promise<void> {
  await updateJob(jobId, {
    status: "awaiting_approval",
    metadata: {
      ...metadata,
      awaitingApproval: state,
    },
  });
  await appendJobEvent(jobId, "awaiting_approval", {
    role: state.role,
    stepIndex: state.stepIndex,
  });
}
