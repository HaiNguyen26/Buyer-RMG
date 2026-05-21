-- PR item: procurement fulfilled (e.g. full GRN on a PO line after partial cancel flow)
DO $$ BEGIN
  ALTER TYPE "PurchaseRequestItemStatus" ADD VALUE 'FULFILLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- PO line lifecycle for partial cancel / GRN
CREATE TYPE "POItemLineStatus" AS ENUM ('OPEN', 'FULLY_RECEIVED', 'CANCELLED');

ALTER TABLE "po_items" ADD COLUMN "line_status" "POItemLineStatus" NOT NULL DEFAULT 'OPEN';

-- Buyer audit: JSON array of po_item ids included in cancel request (optional)
ALTER TABLE "purchase_orders" ADD COLUMN "cancel_requested_po_item_ids" TEXT;

-- Backfill line_status from cumulative GRN qty
UPDATE "po_items" poi
SET "line_status" = 'FULLY_RECEIVED'::"POItemLineStatus"
FROM (
  SELECT "po_item_id", SUM("qty_received")::numeric AS s
  FROM "goods_receipt_lines"
  GROUP BY "po_item_id"
) gr
WHERE poi.id = gr."po_item_id"
  AND gr.s >= poi.qty::numeric;
