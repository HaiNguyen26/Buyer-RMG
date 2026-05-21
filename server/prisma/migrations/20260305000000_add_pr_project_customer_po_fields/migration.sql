-- Add PR fields for linking to Customer PO / Project (Part 1 - Thông tin dự án / PO khách hàng)
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "customer_po" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "project_code" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "project_name" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "customer_name" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "sales_person_id" TEXT;

-- PROJECT / OFFICE are already in PRType from 20260304999999_pr_type_enum
