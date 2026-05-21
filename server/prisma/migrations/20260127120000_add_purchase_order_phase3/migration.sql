-- Add new PRStatus enum values (RFQ_COMPLETED, PO_PENDING, PO_IN_PROGRESS, PO_ISSUED, CLOSED)
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'RFQ_COMPLETED';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'PO_PENDING';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'PO_IN_PROGRESS';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'PO_ISSUED';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- CreateEnum POStatus
DO $$ BEGIN
  CREATE TYPE "POStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'ISSUED',
    'PARTIAL_RECEIVED',
    'FULLY_RECEIVED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable purchase_orders
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "payment_terms" TEXT,
    "delivery_address" TEXT,
    "incoterms" TEXT,
    "project_code" TEXT,
    "delivery_date" TIMESTAMP(3),
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_id" TEXT,
    "reject_reason" TEXT,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");
CREATE INDEX "purchase_orders_company_id_idx" ON "purchase_orders"("company_id");
CREATE INDEX "purchase_orders_purchase_request_id_idx" ON "purchase_orders"("purchase_request_id");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_deleted_at_idx" ON "purchase_orders"("deleted_at");

-- CreateTable po_items
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "purchase_request_item_id" TEXT NOT NULL,
    "quotation_item_id" TEXT,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "po_items_purchase_request_item_id_key" ON "po_items"("purchase_request_item_id");
CREATE INDEX "po_items_purchase_order_id_idx" ON "po_items"("purchase_order_id");
CREATE INDEX "po_items_purchase_request_item_id_idx" ON "po_items"("purchase_request_item_id");

-- CreateTable po_attachments
CREATE TABLE "po_attachments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_order_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "po_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "po_attachments_company_id_idx" ON "po_attachments"("company_id");
CREATE INDEX "po_attachments_purchase_order_id_idx" ON "po_attachments"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "po_attachments" ADD CONSTRAINT "po_attachments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
