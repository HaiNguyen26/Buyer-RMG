-- Per-item revision: new enum value + timestamp when requestor resubmits for re-review

DO $$
BEGIN
  ALTER TYPE "DepartmentItemOutcome" ADD VALUE 'REVISION_REQUIRED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "purchase_request_items"
ADD COLUMN IF NOT EXISTS "department_revision_submitted_at" TIMESTAMP(3);
