-- Backfill after CONFIRMED/PARTIAL enum values are committed

UPDATE "po_items" poi
SET
  "confirmed_qty" = poi.qty,
  "expected_delivery_date" = po."delivery_date",
  "supplier_confirmed_at" = COALESCE(po."supplier_confirmed_at", po."updated_at")
FROM "purchase_orders" po
WHERE poi."purchase_order_id" = po.id
  AND po."deleted_at" IS NULL
  AND po.status IN ('CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED')
  AND poi."confirmed_qty" IS NULL;

UPDATE "po_items" poi
SET "line_status" = CASE
  WHEN gr.s >= COALESCE(poi."confirmed_qty", poi.qty)::numeric THEN 'FULLY_RECEIVED'::"POItemLineStatus"
  WHEN gr.s > 0 THEN 'PARTIAL'::"POItemLineStatus"
  WHEN poi."confirmed_qty" IS NOT NULL THEN 'CONFIRMED'::"POItemLineStatus"
  ELSE poi."line_status"
END
FROM (
  SELECT "po_item_id", SUM("qty_received")::numeric AS s
  FROM "goods_receipt_lines"
  GROUP BY "po_item_id"
) gr
WHERE poi.id = gr."po_item_id";

UPDATE "po_items" poi
SET "line_status" = 'CONFIRMED'::"POItemLineStatus"
FROM "purchase_orders" po
WHERE poi."purchase_order_id" = po.id
  AND po.status IN ('CONFIRMED', 'PARTIAL_RECEIVED')
  AND poi."confirmed_qty" IS NOT NULL
  AND poi."line_status" = 'OPEN'::"POItemLineStatus";
