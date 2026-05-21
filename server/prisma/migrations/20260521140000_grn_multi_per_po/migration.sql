-- Allow multiple GRNs per purchase order (enterprise receive flow)
DROP INDEX IF EXISTS "goods_receipts_purchase_order_id_key";

CREATE INDEX IF NOT EXISTS "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");
