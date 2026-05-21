-- CreateTable
CREATE TABLE "purchase_request_attachments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_item_attachments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_item_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_request_item_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_request_attachments_company_id_idx" ON "purchase_request_attachments"("company_id");
CREATE INDEX "purchase_request_attachments_purchase_request_id_idx" ON "purchase_request_attachments"("purchase_request_id");
CREATE INDEX "purchase_request_attachments_deleted_at_idx" ON "purchase_request_attachments"("deleted_at");

-- CreateIndex
CREATE INDEX "purchase_request_item_attachments_company_id_idx" ON "purchase_request_item_attachments"("company_id");
CREATE INDEX "purchase_request_item_attachments_purchase_request_item_id_idx" ON "purchase_request_item_attachments"("purchase_request_item_id");
CREATE INDEX "purchase_request_item_attachments_deleted_at_idx" ON "purchase_request_item_attachments"("deleted_at");

-- AddForeignKey
ALTER TABLE "purchase_request_attachments"
ADD CONSTRAINT "purchase_request_attachments_purchase_request_id_fkey"
FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_request_item_attachments"
ADD CONSTRAINT "purchase_request_item_attachments_purchase_request_item_id_fkey"
FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
