-- RFQ / Quotation stack was missing from earlier migrations; only quotation_attachments
-- referenced "quotations", causing P1014 on fresh DB and shadow DB during migrate dev.

-- RFQStatus: base values (READY_FOR_COMPARISON is added in 20260127110000)
DO $$ BEGIN
  CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuotationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'SELECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "rfqs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "rfq_number" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rfqs_rfq_number_key" ON "rfqs"("rfq_number");
CREATE INDEX IF NOT EXISTS "rfqs_company_id_idx" ON "rfqs"("company_id");
CREATE INDEX IF NOT EXISTS "rfqs_purchase_request_id_idx" ON "rfqs"("purchase_request_id");
CREATE INDEX IF NOT EXISTS "rfqs_buyer_id_idx" ON "rfqs"("buyer_id");
CREATE INDEX IF NOT EXISTS "rfqs_status_idx" ON "rfqs"("status");
CREATE INDEX IF NOT EXISTS "rfqs_deleted_at_idx" ON "rfqs"("deleted_at");

CREATE TABLE IF NOT EXISTS "quotations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "rfq_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "quotation_number" TEXT,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "lead_time" INTEGER,
    "delivery_terms" TEXT,
    "payment_terms" TEXT,
    "warranty" TEXT,
    "risk_notes" TEXT,
    "valid_until" TIMESTAMP(3),
    "status" "QuotationStatus" NOT NULL DEFAULT 'PENDING',
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "recommendation_score" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quotations_company_id_idx" ON "quotations"("company_id");
CREATE INDEX IF NOT EXISTS "quotations_rfq_id_idx" ON "quotations"("rfq_id");
CREATE INDEX IF NOT EXISTS "quotations_supplier_id_idx" ON "quotations"("supplier_id");
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations"("status");
CREATE INDEX IF NOT EXISTS "quotations_deleted_at_idx" ON "quotations"("deleted_at");

CREATE TABLE IF NOT EXISTS "quotation_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "quotation_id" TEXT NOT NULL,
    "purchase_request_item_id" TEXT,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "total_price" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quotation_items_company_id_idx" ON "quotation_items"("company_id");
CREATE INDEX IF NOT EXISTS "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");
CREATE INDEX IF NOT EXISTS "quotation_items_purchase_request_item_id_idx" ON "quotation_items"("purchase_request_item_id");
CREATE INDEX IF NOT EXISTS "quotation_items_deleted_at_idx" ON "quotation_items"("deleted_at");

CREATE TABLE IF NOT EXISTS "supplier_selections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "buyer_leader_id" TEXT NOT NULL,
    "selection_reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_selections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supplier_selections_company_id_idx" ON "supplier_selections"("company_id");
CREATE INDEX IF NOT EXISTS "supplier_selections_purchase_request_id_idx" ON "supplier_selections"("purchase_request_id");
CREATE INDEX IF NOT EXISTS "supplier_selections_quotation_id_idx" ON "supplier_selections"("quotation_id");
CREATE INDEX IF NOT EXISTS "supplier_selections_buyer_leader_id_idx" ON "supplier_selections"("buyer_leader_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_selections_quotation_id_key') THEN
    ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_quotation_id_key" UNIQUE ("quotation_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfqs_purchase_request_id_fkey') THEN
    ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_purchase_request_id_fkey"
      FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfqs_buyer_id_fkey') THEN
    ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_id_fkey"
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_rfq_id_fkey') THEN
    ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rfq_id_fkey"
      FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_supplier_id_fkey') THEN
    ALTER TABLE "quotations" ADD CONSTRAINT "quotations_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_quotation_id_fkey') THEN
    ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey"
      FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_purchase_request_item_id_fkey') THEN
    ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_purchase_request_item_id_fkey"
      FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_selections_purchase_request_id_fkey') THEN
    ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_purchase_request_id_fkey"
      FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_selections_quotation_id_fkey') THEN
    ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_quotation_id_fkey"
      FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_selections_buyer_leader_id_fkey') THEN
    ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_buyer_leader_id_fkey"
      FOREIGN KEY ("buyer_leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
