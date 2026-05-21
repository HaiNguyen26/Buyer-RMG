-- Supplier selection per item: lưu selected_supplier_per_item (mix NCC theo item)
-- Mỗi dòng = (PR, item, quotation được chọn). Một PR có thể có nhiều dòng (mỗi item một NCC).

-- Drop unique on quotation_id (nhiều item có thể chọn cùng 1 quotation)
ALTER TABLE "supplier_selections" DROP CONSTRAINT IF EXISTS "supplier_selections_quotation_id_key";

-- Add purchase_request_item_id (nullable để tương thích dữ liệu cũ; bản ghi mới luôn có)
ALTER TABLE "supplier_selections" ADD COLUMN IF NOT EXISTS "purchase_request_item_id" TEXT;

-- Unique: mỗi item của PR chỉ được chọn 1 lần (PostgreSQL cho phép nhiều (pr_id, NULL))
ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_purchase_request_id_purchase_request_item_id_key"
  UNIQUE ("purchase_request_id", "purchase_request_item_id");

CREATE INDEX IF NOT EXISTS "supplier_selections_purchase_request_item_id_idx"
  ON "supplier_selections" ("purchase_request_item_id");
