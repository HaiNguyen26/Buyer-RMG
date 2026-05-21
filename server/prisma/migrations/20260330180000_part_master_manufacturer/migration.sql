-- Runs before 20260331100000_create_part_masters on timeline; table may not exist on shadow DB.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'part_masters'
  ) THEN
    ALTER TABLE "part_masters"
    ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
  END IF;
END $$;
