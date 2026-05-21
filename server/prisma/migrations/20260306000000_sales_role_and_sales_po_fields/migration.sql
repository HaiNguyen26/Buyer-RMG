-- Add SALES role (idempotent: may already exist from db push / earlier runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    JOIN pg_catalog.pg_type t ON e.enumtypid = t.oid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND (t.typname = 'Role' OR t.typname = 'role')
      AND e.enumlabel = 'SALES'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'SALES';
  END IF;
END $$;

-- Extend sales_pos for Customer PO form (Section 3–5)
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "project_manager" TEXT;
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "delivery_deadline" TIMESTAMP(3);
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT;
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "advance_percent" DECIMAL(5,2);
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "project_description" TEXT;
