-- Repair: phiếu xuất kho — nếu migration 20260401140000 chưa chạy thì bảng không tồn tại → API list 500.
-- Idempotent: an toàn khi bảng đã có.

DO $$ BEGIN
  CREATE TYPE "StockIssueStatus" AS ENUM ('DRAFT', 'RESERVED', 'APPROVED', 'ISSUED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReservationRefType" AS ENUM ('ISSUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "stock_issues" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "issue_number" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "sales_po_id" TEXT,
    "status" "StockIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT,
    "notes" TEXT,
    "warehouse_code" TEXT,
    "approved_by_id" TEXT,
    "issued_by_id" TEXT,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "stock_issues_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "sales_po_id" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "warehouse_code" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "issued_by_id" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "rejected_reason" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "stock_issue_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "stock_issue_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "part_internal_code" TEXT NOT NULL,
    "part_name" TEXT,
    "unit" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "qty_shipped" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "stock_issue_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_issue_items" ADD COLUMN IF NOT EXISTS "qty_shipped" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "inventory_reservations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "ref_type" "ReservationRefType" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "inventory_balance_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_issues_issue_number_key" ON "stock_issues"("issue_number");
CREATE INDEX IF NOT EXISTS "stock_issues_company_id_idx" ON "stock_issues"("company_id");
CREATE INDEX IF NOT EXISTS "stock_issues_requestor_id_idx" ON "stock_issues"("requestor_id");
CREATE INDEX IF NOT EXISTS "stock_issues_sales_po_id_idx" ON "stock_issues"("sales_po_id");
CREATE INDEX IF NOT EXISTS "stock_issues_status_idx" ON "stock_issues"("status");
CREATE INDEX IF NOT EXISTS "stock_issues_deleted_at_idx" ON "stock_issues"("deleted_at");

CREATE INDEX IF NOT EXISTS "stock_issue_items_stock_issue_id_idx" ON "stock_issue_items"("stock_issue_id");
CREATE INDEX IF NOT EXISTS "stock_issue_items_company_id_idx" ON "stock_issue_items"("company_id");

CREATE INDEX IF NOT EXISTS "inventory_reservations_ref_type_ref_id_idx" ON "inventory_reservations"("ref_type", "ref_id");
CREATE INDEX IF NOT EXISTS "inventory_reservations_inventory_balance_id_idx" ON "inventory_reservations"("inventory_balance_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_requestor_id_fkey') THEN
    ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_requestor_id_fkey"
      FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_approved_by_id_fkey') THEN
    ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_approved_by_id_fkey"
      FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_issued_by_id_fkey') THEN
    ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_issued_by_id_fkey"
      FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_sales_po_id_fkey') THEN
    ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_sales_po_id_fkey"
      FOREIGN KEY ("sales_po_id") REFERENCES "sales_pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issue_items_stock_issue_id_fkey') THEN
    ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_stock_issue_id_fkey"
      FOREIGN KEY ("stock_issue_id") REFERENCES "stock_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_inventory_balance_id_fkey') THEN
    ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventory_balance_id_fkey"
      FOREIGN KEY ("inventory_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
