-- Lead time & bảo hành theo từng dòng báo giá
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "lead_time_days" INTEGER;
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "warranty_months" INTEGER;
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "delivery_date" DATE;
