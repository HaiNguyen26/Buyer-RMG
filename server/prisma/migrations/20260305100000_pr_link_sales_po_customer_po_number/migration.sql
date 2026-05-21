-- Add customer_po_number to sales_pos for display in PR dropdown (PO Number | Customer | Project)
ALTER TABLE "sales_pos" ADD COLUMN IF NOT EXISTS "customer_po_number" TEXT;

-- Link PurchaseRequest to SalesPO (Customer PO)
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "sales_po_id" TEXT;

-- FK and index (FK may already exist from 20260107041229_add_purchase_request_items)
CREATE INDEX IF NOT EXISTS "purchase_requests_sales_po_id_idx" ON "purchase_requests"("sales_po_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_sales_po_id_fkey') THEN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_sales_po_id_fkey"
      FOREIGN KEY ("sales_po_id") REFERENCES "sales_pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
