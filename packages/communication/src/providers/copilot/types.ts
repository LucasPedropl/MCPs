/**
 * Modelos conhecidos do GitHub Copilot CLI (SDK @github/copilot SUPPORTED_MODELS).
 * O plano da conta pode restringir quais estão disponíveis de fato.
 * Use "auto" para deixar o Copilot escolher.
 */
export const KNOWN_COPILOT_MODELS = [
  "auto",
  "claude-sonnet-4.6",
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
  "claude-fable-5",
  "claude-opus-4.8",
  "claude-opus-4.7",
  "claude-opus-4.7-1m-internal",
  "claude-opus-4.7-high",
  "claude-opus-4.7-xhigh",
  "claude-opus-4.6",
  "claude-opus-4.6-fast",
  "claude-opus-4.6-1m",
  "claude-opus-4.5",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-5.2",
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gemini-3.1-pro-preview",
  "gemini-3.5-flash",
] as const;

export type CopilotModel = typeof KNOWN_COPILOT_MODELS[number] | (string & {});

/**
 * Default model to use when delegating to Copilot.
 */
export const DEFAULT_COPILOT_MODEL: CopilotModel = "auto";

/**
 * Input payload to delegate a task to Copilot.
 */
export interface DelegateToCopilotInput {
  /**
   * The prompt or instruction to send to Copilot.
   */
  prompt: string;

  /**
   * The model to use for generation.
   * @default "claude-sonnet-4.6"
   */
  model?: CopilotModel;

  /**
   * Optional timeout in milliseconds.
   */
  timeoutMs?: number;

  /**
   * The workspace path to operate on. If not provided, the current workspace may be used.
   */
  workspacePath?: string;

  /**
   * Whether to enable agentic mode (allow tool use like write, shell).
   * Equivalente a writeTools=true.
   */
  agenticMode?: boolean;

  /** Permite tools de leitura/pesquisa sem escrita (review leve). */
  readTools?: boolean;

  /** Permite tools de escrita/shell (equivale agenticMode). */
  writeTools?: boolean;

  /** Resume sessão Copilot existente. */
  sessionId?: string;

  onChunk?: (delta: string) => void | Promise<void>;
}

/**
 * Result returned after delegating a task to Copilot.
 */
export interface DelegateToCopilotResult {
  /**
   * The primary response text/content from Copilot.
   */
  response: string;

  /**
   * Optional session ID if the conversation can be resumed.
   */
  sessionId?: string;

  /**
   * The model that was actually used for generation.
   */
  model?: CopilotModel;

  /**
   * Exit code if the interaction involved running tasks or terminal commands.
   */
  exitCode?: number;

  /** Perfil usado na delegação. */
  usageProfile?: "light" | "full";
}
