-- PO line-level NCC confirmation: schema only (enum values cannot be used in same transaction)

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_confirmed_at" TIMESTAMP(3);

ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "confirmed_qty" DECIMAL(10, 2);
ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "expected_delivery_date" TIMESTAMP(3);
ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "supplier_confirmed_at" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TYPE "POItemLineStatus" ADD VALUE 'CONFIRMED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "POItemLineStatus" ADD VALUE 'PARTIAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
