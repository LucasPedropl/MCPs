/**
 * Known supported models for the Cursor provider.
 */
export const KNOWN_CURSOR_MODELS = [
  'composer-2.5',
  'claude-4.6-sonnet-medium-thinking',
  'gpt-5.3-codex',
] as const;

export type CursorModel = typeof KNOWN_CURSOR_MODELS[number] | (string & {});

/**
 * Default model to use when delegating to Cursor.
 */
export const DEFAULT_CURSOR_MODEL: CursorModel = 'composer-2.5';

/**
 * Input payload to delegate a task to Cursor.
 */
export interface DelegateToCursorInput {
  /**
   * The prompt or instruction to send to Cursor.
   */
  prompt: string;
  
  /**
   * The model to use for generation.
   * @default "composer-2.5"
   */
  model?: CursorModel;
  
  /**
   * Optional timeout in milliseconds.
   */
  timeoutMs?: number;
  
  /**
   * The workspace path to operate on. If not provided, the current workspace may be used.
   */
  workspacePath?: string;
  onChunk?: (delta: string) => void | Promise<void>;

  /**
   * Abort signal — kills the cursor-agent process tree when aborted.
   */
  signal?: AbortSignal;
}

/**
 * Result returned after delegating a task to Cursor.
 */
export interface DelegateToCursorResult {
  /**
   * The primary response text/content from Cursor.
   */
  response: string;
  
  /**
   * Optional session ID if the conversation can be resumed.
   */
  sessionId?: string;
  
  /**
   * The model that was actually used for generation.
   */
  model?: CursorModel;
  
  /**
   * Exit code if the interaction involved running tasks or terminal commands.
   */
  exitCode?: number;
}
