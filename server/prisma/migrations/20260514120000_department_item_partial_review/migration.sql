-- Department item-level outcome (partial review) + PR total snapshot + audit log

CREATE TYPE "DepartmentItemOutcome" AS ENUM ('APPROVED', 'REJECTED', 'ON_HOLD');

ALTER TABLE "purchase_requests"
ADD COLUMN IF NOT EXISTS "total_amount_snapshot" DECIMAL(15,2);

ALTER TABLE "purchase_request_items"
ADD COLUMN IF NOT EXISTS "department_item_outcome" "DepartmentItemOutcome",
ADD COLUMN IF NOT EXISTS "department_decision_note" TEXT,
ADD COLUMN IF NOT EXISTS "department_decided_by_id" TEXT,
ADD COLUMN IF NOT EXISTS "department_decided_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "purchase_request_items_department_item_outcome_idx"
ON "purchase_request_items"("department_item_outcome");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_request_items_department_decided_by_id_fkey'
  ) THEN
    ALTER TABLE "purchase_request_items"
    ADD CONSTRAINT "purchase_request_items_department_decided_by_id_fkey"
    FOREIGN KEY ("department_decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "pr_item_department_decisions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_item_id" TEXT NOT NULL,
    "purchase_request_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "outcome" "DepartmentItemOutcome" NOT NULL,
    "note" TEXT,
    "line_amount_at_decision" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pr_item_department_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pr_item_department_decisions_purchase_request_id_idx"
ON "pr_item_department_decisions"("purchase_request_id");
CREATE INDEX IF NOT EXISTS "pr_item_department_decisions_purchase_request_item_id_idx"
ON "pr_item_department_decisions"("purchase_request_item_id");
CREATE INDEX IF NOT EXISTS "pr_item_department_decisions_actor_id_idx"
ON "pr_item_department_decisions"("actor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pr_item_department_decisions_purchase_request_item_id_fkey'
  ) THEN
    ALTER TABLE "pr_item_department_decisions"
    ADD CONSTRAINT "pr_item_department_decisions_purchase_request_item_id_fkey"
    FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pr_item_department_decisions_purchase_request_id_fkey'
  ) THEN
    ALTER TABLE "pr_item_department_decisions"
    ADD CONSTRAINT "pr_item_department_decisions_purchase_request_id_fkey"
    FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pr_item_department_decisions_actor_id_fkey'
  ) THEN
    ALTER TABLE "pr_item_department_decisions"
    ADD CONSTRAINT "pr_item_department_decisions_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
