export interface WorkspaceLockRow {
  id: string;
  workspace: string;
  holder_id: string;
  lock_type: "exclusive" | "read";
  acquired_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

export interface AcquireLockInput {
  workspace: string;
  holderId: string;
  lockType?: "exclusive" | "read";
  ttlMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AcquireLockResult {
  acquired: boolean;
  lockId?: string;
  reason?: string;
  expiresAt?: string;
}

export class WorkspaceLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceLockError";
  }
}
