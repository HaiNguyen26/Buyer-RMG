-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "buyer_supplier_tax_code" TEXT;
