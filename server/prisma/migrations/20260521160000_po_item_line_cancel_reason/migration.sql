ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "line_cancel_reason" TEXT;
ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "cancelled_remaining_qty" DECIMAL(10, 2);
