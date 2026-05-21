-- Split PR item quantity into stock vs purchase portions
ALTER TABLE "purchase_request_items"
  ADD COLUMN IF NOT EXISTS "from_stock_qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "purchase_qty" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill existing rows: before this migration, all qty are effectively purchase qty.
UPDATE "purchase_request_items"
SET
  "from_stock_qty" = COALESCE("from_stock_qty", 0),
  "purchase_qty" = COALESCE(NULLIF("purchase_qty", 0), "qty")
WHERE "deleted_at" IS NULL;

-- Extend item status enum for stock-first flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'FROM_STOCK'
      AND enumtypid = '"PurchaseRequestItemStatus"'::regtype
  ) THEN
    ALTER TYPE "PurchaseRequestItemStatus" ADD VALUE 'FROM_STOCK';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'NEED_PURCHASE'
      AND enumtypid = '"PurchaseRequestItemStatus"'::regtype
  ) THEN
    ALTER TYPE "PurchaseRequestItemStatus" ADD VALUE 'NEED_PURCHASE';
  END IF;
END $$;
