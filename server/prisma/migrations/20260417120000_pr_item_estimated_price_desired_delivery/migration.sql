-- Requestor dự kiến giá (VND) và ngày mong muốn giao theo dòng PR (tham chiếu dự toán / buyer sau)
ALTER TABLE "purchase_request_items"
  ADD COLUMN IF NOT EXISTS "estimated_unit_price_vnd" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "desired_delivery_date" DATE;
