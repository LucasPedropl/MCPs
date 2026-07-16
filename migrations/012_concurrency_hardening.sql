-- 012: Reforço de concorrência no banco (complementa as correções code-side).
--
-- 1) workspace_locks: no máximo UM lock exclusivo ativo por workspace.
--    O código faz insert-then-verify; este índice único parcial transforma a
--    corrida residual (duas inserções no mesmo instante) em erro de constraint
--    — que o código já trata retornando acquired=false.
--
-- 2) delegation_jobs: colunas de claim para diagnóstico multi-instância.
--    Nullable e sem default — nenhuma mudança de comportamento para o código
--    atual; o claim atômico (UPDATE ... WHERE status='pending') continua sendo
--    a fonte da verdade. claimed_by/heartbeat_at permitem inspecionar QUAL
--    instância pegou o job e desde quando.
--
-- Aplicar no projeto Supabase do agent-os (SQL Editor ou supabase db push).

-- 1) Lock exclusivo único por workspace ------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS workspace_locks_exclusive_unique
  ON public.workspace_locks (workspace)
  WHERE lock_type = 'exclusive';

-- 2) Colunas de claim em delegation_jobs ------------------------------------
ALTER TABLE public.delegation_jobs
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

COMMENT ON COLUMN public.delegation_jobs.claimed_by IS
  'Identificador da instância agent-os que reivindicou o job (hostname-pid). Informativo.';
COMMENT ON COLUMN public.delegation_jobs.heartbeat_at IS
  'Último sinal de vida da instância executora. Informativo (orphan recovery usa started_at).';

-- Índice parcial para as consultas de recovery (running/pending antigos).
CREATE INDEX IF NOT EXISTS delegation_jobs_recovery_idx
  ON public.delegation_jobs (status, started_at)
  WHERE status IN ('running', 'pending');
