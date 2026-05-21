-- VAT % theo dòng báo giá NCC (3, 5, 8, 10)
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "vat_percent" DECIMAL(5,2);

UPDATE "quotation_items"
SET "vat_percent" = 10
WHERE "vat_percent" IS NULL;
