-- Link spec/datasheet trên danh mục vật tư; gắn phiếu xuất với PR (kho tra cứu giữ chỗ)
ALTER TABLE "part_masters" ADD COLUMN IF NOT EXISTS "reference_url" TEXT;

ALTER TABLE "stock_issues" ADD COLUMN IF NOT EXISTS "purchase_request_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_issues_purchase_request_id_fkey'
  ) THEN
    ALTER TABLE "stock_issues"
      ADD CONSTRAINT "stock_issues_purchase_request_id_fkey"
      FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stock_issues_purchase_request_id_idx" ON "stock_issues" ("purchase_request_id");
