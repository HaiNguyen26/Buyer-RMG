-- AlterTable
ALTER TABLE "stock_issues" ADD COLUMN "sales_po_id" TEXT;

-- AlterTable
ALTER TABLE "stock_issue_items" ADD COLUMN "qty_shipped" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "stock_issues_sales_po_id_idx" ON "stock_issues"("sales_po_id");

-- AddForeignKey
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_sales_po_id_fkey" FOREIGN KEY ("sales_po_id") REFERENCES "sales_pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
