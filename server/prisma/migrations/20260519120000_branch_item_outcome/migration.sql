-- Quyết định theo dòng ở cấp GĐ chi nhánh
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "branch_item_outcome" "DepartmentItemOutcome";
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "branch_decision_note" TEXT;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "branch_decided_by_id" TEXT;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "branch_decided_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_request_items_branch_decided_by_id_fkey'
  ) THEN
    ALTER TABLE "purchase_request_items"
      ADD CONSTRAINT "purchase_request_items_branch_decided_by_id_fkey"
      FOREIGN KEY ("branch_decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "purchase_request_items_branch_item_outcome_idx"
  ON "purchase_request_items"("branch_item_outcome");
