import type { BridgeProvider } from "../../client/types.js";

export type SessionProvider = Exclude<BridgeProvider, "parallel" | "pipeline">;

export interface DelegationSessionRow {
  id: string;
  workspace: string;
  title: string | null;
  provider: SessionProvider;
  external_session_id: string | null;
  model: string | null;
  last_prompt: string | null;
  last_response: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SharedContextRow {
  id: string;
  session_id: string | null;
  workspace: string;
  label: string | null;
  content: string;
  content_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateSessionInput {
  workspace: string;
  provider: SessionProvider;
  title?: string;
  externalSessionId?: string;
  model?: string;
  lastPrompt?: string;
  lastResponse?: string;
  metadata?: Record<string, unknown>;
}

export interface AddContextInput {
  workspace: string;
  sessionId?: string;
  label?: string;
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionListFilters {
  workspace?: string;
  provider?: SessionProvider;
  limit?: number;
}
