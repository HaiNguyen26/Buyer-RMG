-- GRN (goods receipt) + lines; inventory updated in application layer

CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_order_id" TEXT NOT NULL,
    "grn_number" TEXT NOT NULL,
    "warehouse_code" TEXT NOT NULL DEFAULT 'MAIN',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goods_receipts_grn_number_key" ON "goods_receipts"("grn_number");
CREATE INDEX "goods_receipts_company_id_idx" ON "goods_receipts"("company_id");
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");
CREATE INDEX "goods_receipts_received_at_idx" ON "goods_receipts"("received_at");

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_id_fkey"
  FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "po_item_id" TEXT NOT NULL,
    "qty_received" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goods_receipt_lines_goods_receipt_id_idx" ON "goods_receipt_lines"("goods_receipt_id");
CREATE INDEX "goods_receipt_lines_po_item_id_idx" ON "goods_receipt_lines"("po_item_id");

ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey"
  FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_po_item_id_fkey"
  FOREIGN KEY ("po_item_id") REFERENCES "po_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
