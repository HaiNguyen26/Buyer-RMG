/*
  Warnings:

  - The values [APPROVER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[username,company_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,company_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/

-- Step 1: Add company_id column first (before handling duplicates)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Step 2: Handle duplicate data before adding constraints
-- For duplicate emails, set unique company_id to avoid constraint violation
WITH duplicates AS (
  SELECT id, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) as rn
  FROM "users"
  WHERE email IS NOT NULL
)
UPDATE "users" u
SET "company_id" = CONCAT('DUP_', u.id::text)
FROM duplicates d
WHERE u.id = d.id AND d.rn > 1;

-- For duplicate usernames, set unique company_id
WITH duplicates AS (
  SELECT id, username, ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) as rn
  FROM "users"
  WHERE username IS NOT NULL
)
UPDATE "users" u
SET "company_id" = CONCAT('DUP_', u.id::text)
FROM duplicates d
WHERE u.id = d.id AND d.rn > 1;

-- CreateEnum
CREATE TYPE "SalesPOStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEED_MORE_INFO', 'APPROVED_BY_BRANCH', 'READY_FOR_RFQ', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED', 'PAYMENT_DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_new') THEN
    CREATE TYPE "Role_new" AS ENUM ('REQUESTOR', 'BUYER', 'BUYER_LEADER', 'BUYER_MANAGER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'SALES', 'BGD');
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
      ALTER TABLE "role_permissions" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
    END IF;
    DROP TYPE IF EXISTS "Role";
    ALTER TYPE "Role_new" RENAME TO "Role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'REQUESTOR';
  END IF;
END $$;

-- DropIndex (only if exists)
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_username_key";

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "contact_person" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sales_pos" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "sales_po_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "project_name" TEXT,
    "project_code" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "effective_date" TIMESTAMP(3) NOT NULL,
    "status" "SalesPOStatus" NOT NULL DEFAULT 'ACTIVE',
    "sales_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_pos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "pr_number" TEXT NOT NULL,
    "sales_po_id" TEXT,
    "requestor_id" TEXT NOT NULL,
    "department" TEXT,
    "item_name" TEXT NOT NULL,
    "specifications" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "required_date" TIMESTAMP(3),
    "purpose" TEXT,
    "location" TEXT,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_request_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "part_no" TEXT,
    "spec" TEXT,
    "manufacturer" TEXT,
    "qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "purpose" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "contact_person" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "payment_date" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "reference_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs"("company_id");
CREATE INDEX IF NOT EXISTS "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "permissions_resource_idx" ON "permissions"("resource");
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_resource_action_key" ON "permissions"("resource", "action");
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions"("role");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_permission_id_key" ON "role_permissions"("role", "permission_id");
CREATE INDEX IF NOT EXISTS "customers_company_id_idx" ON "customers"("company_id");
CREATE INDEX IF NOT EXISTS "customers_deleted_at_idx" ON "customers"("deleted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_pos_sales_po_number_key" ON "sales_pos"("sales_po_number");
CREATE INDEX IF NOT EXISTS "sales_pos_company_id_idx" ON "sales_pos"("company_id");
CREATE INDEX IF NOT EXISTS "sales_pos_customer_id_idx" ON "sales_pos"("customer_id");
CREATE INDEX IF NOT EXISTS "sales_pos_status_idx" ON "sales_pos"("status");
CREATE INDEX IF NOT EXISTS "sales_pos_deleted_at_idx" ON "sales_pos"("deleted_at");
CREATE INDEX IF NOT EXISTS "sales_pos_sales_user_id_idx" ON "sales_pos"("sales_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requests_pr_number_key" ON "purchase_requests"("pr_number");
CREATE INDEX IF NOT EXISTS "purchase_requests_company_id_idx" ON "purchase_requests"("company_id");
CREATE INDEX IF NOT EXISTS "purchase_requests_sales_po_id_idx" ON "purchase_requests"("sales_po_id");
CREATE INDEX IF NOT EXISTS "purchase_requests_requestor_id_idx" ON "purchase_requests"("requestor_id");
CREATE INDEX IF NOT EXISTS "purchase_requests_status_idx" ON "purchase_requests"("status");
CREATE INDEX IF NOT EXISTS "purchase_requests_deleted_at_idx" ON "purchase_requests"("deleted_at");
CREATE INDEX IF NOT EXISTS "purchase_request_items_company_id_idx" ON "purchase_request_items"("company_id");
CREATE INDEX IF NOT EXISTS "purchase_request_items_purchase_request_id_idx" ON "purchase_request_items"("purchase_request_id");
CREATE INDEX IF NOT EXISTS "purchase_request_items_deleted_at_idx" ON "purchase_request_items"("deleted_at");
CREATE INDEX IF NOT EXISTS "suppliers_company_id_idx" ON "suppliers"("company_id");
CREATE INDEX IF NOT EXISTS "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");
CREATE INDEX IF NOT EXISTS "payments_company_id_idx" ON "payments"("company_id");
CREATE INDEX IF NOT EXISTS "payments_purchase_request_id_idx" ON "payments"("purchase_request_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_deleted_at_idx" ON "payments"("deleted_at");
CREATE INDEX IF NOT EXISTS "users_company_id_idx" ON "users"("company_id");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_company_id_key" ON "users"("username", "company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_company_id_key" ON "users"("email", "company_id");

-- AddForeignKey (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey') THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_permission_id_fkey') THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_pos_customer_id_fkey') THEN
    ALTER TABLE "sales_pos" ADD CONSTRAINT "sales_pos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_pos_sales_user_id_fkey') THEN
    ALTER TABLE "sales_pos" ADD CONSTRAINT "sales_pos_sales_user_id_fkey" FOREIGN KEY ("sales_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_sales_po_id_fkey') THEN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_sales_po_id_fkey" FOREIGN KEY ("sales_po_id") REFERENCES "sales_pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_requestor_id_fkey') THEN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requestor_id_fkey" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_supplier_id_fkey') THEN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_request_items_purchase_request_id_fkey') THEN
    ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_purchase_request_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

