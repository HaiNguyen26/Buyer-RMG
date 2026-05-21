-- Add missing columns to purchase_request_items (schema has them, table was created without)
-- Enum for item status
DO $$ BEGIN
  CREATE TYPE "PurchaseRequestItemStatus" AS ENUM (
    'NEW',
    'ASSIGNED',
    'RFQ_CREATED',
    'RFQ_SUBMITTED',
    'READY_FOR_REVIEW',
    'SUPPLIER_SELECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL; -- enum already exists
END $$;

-- Add unit_price if missing
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(15,2);

-- Add amount if missing
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(15,2);

-- Add status column (required for assignPR / item lifecycle)
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "status" "PurchaseRequestItemStatus" NOT NULL DEFAULT 'NEW';
