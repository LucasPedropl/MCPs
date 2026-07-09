-- Schema drift fixes

-- HITL status for delegation jobs
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'awaiting_approval';

-- mcp_test_cases updated_at
ALTER TABLE public.mcp_test_cases
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_mcp_test_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mcp_test_cases_updated_at ON public.mcp_test_cases;
CREATE TRIGGER trg_mcp_test_cases_updated_at
  BEFORE UPDATE ON public.mcp_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_mcp_test_cases_updated_at();
