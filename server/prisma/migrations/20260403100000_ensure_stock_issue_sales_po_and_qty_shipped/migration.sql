-- Idempotent repair: fixes P2022 when stock_issues exists but sales_po_id / qty_shipped
-- were never applied (skipped migration, wrong DB, or drift vs schema).

ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "sales_po_id" TEXT;

CREATE INDEX IF NOT EXISTS "stock_issues_sales_po_id_idx" ON "stock_issues"("sales_po_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_sales_po_id_fkey') THEN
    ALTER TABLE "stock_issues"
      ADD CONSTRAINT "stock_issues_sales_po_id_fkey"
      FOREIGN KEY ("sales_po_id") REFERENCES "sales_pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_issue_items'
      AND column_name = 'qty_shipped'
  ) THEN
    ALTER TABLE "stock_issue_items"
      ADD COLUMN "qty_shipped" DECIMAL(18, 4) NOT NULL DEFAULT 0;
  END IF;
END $$;
