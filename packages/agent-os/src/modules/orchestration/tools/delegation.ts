import { AntigravityClient } from "../client/antigravity-client.js";
import { resolveInstance } from "../client/discovery.js";
import { prepareProviderPrompt } from "../features/delegation/delegation-lang.js";
import type { BridgeProvider } from "../client/types.js";
import { getTargetWorkspacePath } from "../client/workspace.js";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import {
  finalizeDelegationWorkspace,
  isAutoMergeEnabled,
  type MergeDelegationResult,
} from "../features/workspace/git-merge.js";
import {
  isWorktreeIsolationEnabled,
  prepareDelegationWorkspace,
  releaseDelegationWorkspace,
  type DelegationWorkspace,
} from "../features/workspace/git-worktree.js";
import { delegateToAntigravity } from "../providers/antigravity/service.js";
import { isAntigravityParallelEnabled } from "../providers/antigravity/config.js";
import { isHeadlessAntigravityEnabled, isHeadlessAvailable } from "../providers/antigravity/headless.js";
import { withWorkspaceLock } from "../features/workspace/lock-store.js";
import { delegateToCursor } from "../providers/cursor/service.js";
import { createGrowingTextEmitter } from "../features/observability/chunk-emitter.js";

export type DelegationMode = "subagent" | "bridge" | "parallel" | "pipeline";

export type ChunkHandler = (delta: string) => void | Promise<void>;

export interface DelegateParams {
  provider: BridgeProvider;
  prompt: string;
  model?: string;
  mode: DelegationMode;
  agentic_mode: boolean;
  read_tools?: boolean;
  timeout_ms: number;
  holder_id?: string;
  session_id?: string;
  workspace_path?: string;
  on_chunk?: ChunkHandler;
}

export type DelegationSuccess = {
  success: true;
  provider: BridgeProvider;
  mode: "subagent" | "bridge" | "headless";
  response: string;
  sessionId?: string;
  model?: string;
  exitCode?: number;
  cascadeId?: string;
  messageId?: string;
  isolatedBranch?: string;
  worktreePath?: string;
  isolationNote?: string;
  merge?: MergeDelegationResult;
};

export type DelegationFailure = {
  success: false;
  message: string;
};

export type DelegationResult = DelegationSuccess | DelegationFailure;

let cachedClient: AntigravityClient | null = null;
let cachedInstanceKey = "";

async function getAntigravityClient(): Promise<AntigravityClient> {
  const instance = await resolveInstance();
  const key = `${instance.port}:${instance.csrfToken}:${instance.workspace}`;

  if (!cachedClient || cachedInstanceKey !== key) {
    cachedClient = new AntigravityClient(instance);
    cachedInstanceKey = key;
  }

  return cachedClient;
}

export { getAntigravityClient as getClient };

function finalizeIsolatedWorkspace(
  delegated: DelegationWorkspace,
  success: boolean,
): MergeDelegationResult | undefined {
  if (!delegated.isolated) {
    return undefined;
  }
  if (success && isAutoMergeEnabled()) {
    return finalizeDelegationWorkspace(delegated);
  }
  releaseDelegationWorkspace(delegated);
  return undefined;
}

function shouldUseWorktree(provider: BridgeProvider, agentic: boolean): boolean {
  if (!agentic || !isWorktreeIsolationEnabled()) {
    return false;
  }
  if (provider === "antigravity") {
    if (isAntigravityParallelEnabled()) {
      return true;
    }
    return isHeadlessAntigravityEnabled() && isHeadlessAvailable();
  }
  return provider === "cursor";
}

function needsAgenticLock(provider: BridgeProvider, agentic: boolean, isolated: boolean): boolean {
  if (!agentic) {
    return false;
  }
  if (provider === "antigravity" && isolated && isAntigravityParallelEnabled()) {
    return false;
  }
  return true;
}

/** Executa delegação síncrona para Antigravity ou Cursor. */
export async function runDelegation(params: DelegateParams): Promise<DelegationResult> {
  const { provider, prompt, model, mode, agentic_mode, read_tools, timeout_ms, on_chunk, holder_id, session_id } =
    params;

  const delegatedPrompt = prepareProviderPrompt(prompt, provider);
  const baseWorkspace = resolveWorkspacePath(params.workspace_path);
  const holderId = holder_id ?? `sync-${Date.now()}`;
  const useWorktree = shouldUseWorktree(provider, agentic_mode);
  const delegated = useWorktree
    ? prepareDelegationWorkspace(baseWorkspace, provider, holderId, true)
    : {
        path: baseWorkspace,
        branch: "current",
        baseBranch: "current",
        basePath: baseWorkspace,
        isolated: false,
      };

  const run = async (): Promise<DelegationResult> => {
  try {
    if (mode === "parallel") {
      releaseDelegationWorkspace(delegated);
      return {
        success: false,
        message: "Use delegate_parallel para delegação paralela (sync ou async).",
      };
    }

    if (provider === "cursor") {
      const result = await delegateToCursor({
        prompt: delegatedPrompt,
        model,
        timeoutMs: timeout_ms,
        workspacePath: delegated.path,
        onChunk: on_chunk,
      });
      const merge = finalizeIsolatedWorkspace(delegated, true);
      return {
        success: true,
        provider,
        mode: "subagent",
        response: result.response,
        sessionId: result.sessionId,
        model: result.model,
        exitCode: result.exitCode,
        isolatedBranch: delegated.isolated ? delegated.branch : undefined,
        worktreePath: delegated.worktreePath,
        merge,
      };
    }

    const client = await getAntigravityClient();
    const emitProgress = on_chunk ? createGrowingTextEmitter(on_chunk) : undefined;
    const result = await delegateToAntigravity(client, {
      prompt: delegatedPrompt,
      model,
      mode: mode === "bridge" ? "bridge" : "subagent",
      agenticMode: agentic_mode,
      timeoutMs: timeout_ms,
      workspacePath: delegated.isolated ? delegated.path : undefined,
      onProgress: emitProgress
        ? (partial) => {
            emitProgress(partial.response);
          }
        : undefined,
    });

    const isolationNote =
      agentic_mode && !delegated.isolated && isWorktreeIsolationEnabled()
        ? "Antigravity agentic no workspace principal (serializado). Paralelo: BRIDGE_ANTIGRAVITY_PARALLEL=1 + agy headless."
        : undefined;

    const merge = finalizeIsolatedWorkspace(delegated, true);
    return {
      success: true,
      provider,
      mode: result.modeUsed ?? (mode === "bridge" ? "bridge" : "subagent"),
      cascadeId: result.cascadeId,
      model: result.model,
      messageId: result.messageId,
      response: result.response,
      isolatedBranch: delegated.isolated ? delegated.branch : undefined,
      worktreePath: delegated.worktreePath,
      isolationNote,
      merge,
    };
  } catch (error) {
    finalizeIsolatedWorkspace(delegated, false);
    throw error;
  }
  };

  if (needsAgenticLock(provider, agentic_mode, delegated.isolated)) {
    return withWorkspaceLock(
      {
        workspace: delegated.path,
        holderId,
        metadata: { provider, mode },
      },
      run,
    );
  }

  return run();
}
