/*
  Warnings:

  - The values [READY_FOR_RFQ] on the enum `PRStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVE', 'REJECT', 'RETURN');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BudgetExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEGOTIATION_REQUESTED');

-- CreateEnum
CREATE TYPE "BudgetExceptionAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_NEGOTIATION');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('EMPLOYEE', 'DEPT', 'RULE');

-- AlterEnum
BEGIN;
CREATE TYPE "PRStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED_BY_BRANCH', 'DEPARTMENT_HEAD_PENDING', 'DEPARTMENT_HEAD_APPROVED', 'DEPARTMENT_HEAD_REJECTED', 'DEPARTMENT_HEAD_RETURNED', 'MANAGER_PENDING', 'MANAGER_APPROVED', 'MANAGER_REJECTED', 'MANAGER_RETURNED', 'BRANCH_MANAGER_PENDING', 'BRANCH_MANAGER_APPROVED', 'BRANCH_MANAGER_REJECTED', 'BRANCH_MANAGER_RETURNED', 'BUYER_LEADER_PENDING', 'NEED_MORE_INFO', 'ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED', 'RFQ_COMPLETED', 'PO_PENDING', 'PO_IN_PROGRESS', 'PO_ISSUED', 'CLOSED', 'BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'PAYMENT_DONE', 'CANCELLED');
ALTER TABLE "purchase_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "purchase_requests" ALTER COLUMN "status" TYPE "PRStatus_new" USING ("status"::text::"PRStatus_new");
ALTER TYPE "PRStatus" RENAME TO "PRStatus_old";
ALTER TYPE "PRStatus_new" RENAME TO "PRStatus";
DROP TYPE "PRStatus_old";
ALTER TABLE "purchase_requests" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'DEPARTMENT_HEAD';
ALTER TYPE "Role" ADD VALUE 'BRANCH_DIRECTOR';
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE';

-- AlterEnum
ALTER TYPE "SalesPOStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND',
ADD COLUMN     "tax" DECIMAL(5,2),
ADD COLUMN     "total_amount" DECIMAL(15,2),
ADD COLUMN     "type" "PRType" NOT NULL DEFAULT 'PRODUCTION';

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bank_account" TEXT,
ADD COLUMN     "bank_name" TEXT;

-- CreateTable
CREATE TABLE "pr_approvals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_assignments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "buyer_leader_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "scope" "AssignmentScope" NOT NULL DEFAULT 'FULL',
    "assigned_item_ids" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pr_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_exceptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "purchase_request_id" TEXT NOT NULL,
    "pr_amount" DECIMAL(15,2) NOT NULL,
    "purchase_amount" DECIMAL(15,2) NOT NULL,
    "over_percent" DECIMAL(5,2) NOT NULL,
    "status" "BudgetExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "branch_manager_id" TEXT,
    "action" "BudgetExceptionAction",
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "related_id" TEXT,
    "related_type" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "branch_director_id" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_approval_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "need_branch_manager_approval" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branch_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "department_code" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "branch_id" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "department_code" TEXT NOT NULL,
    "department_id" TEXT,
    "branch_id" TEXT,
    "pr_type" "PRType" NOT NULL,
    "need_branch_manager" BOOLEAN NOT NULL DEFAULT false,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_histories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "file_name" TEXT NOT NULL,
    "import_type" "ImportType" NOT NULL,
    "imported_by" TEXT NOT NULL,
    "success" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error_file_url" TEXT,
    "errors" JSONB,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_approvals_company_id_idx" ON "pr_approvals"("company_id");

-- CreateIndex
CREATE INDEX "pr_approvals_purchase_request_id_idx" ON "pr_approvals"("purchase_request_id");

-- CreateIndex
CREATE INDEX "pr_approvals_approver_id_idx" ON "pr_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "pr_approvals_created_at_idx" ON "pr_approvals"("created_at");

-- CreateIndex
CREATE INDEX "pr_assignments_company_id_idx" ON "pr_assignments"("company_id");

-- CreateIndex
CREATE INDEX "pr_assignments_purchase_request_id_idx" ON "pr_assignments"("purchase_request_id");

-- CreateIndex
CREATE INDEX "pr_assignments_buyer_id_idx" ON "pr_assignments"("buyer_id");

-- CreateIndex
CREATE INDEX "pr_assignments_buyer_leader_id_idx" ON "pr_assignments"("buyer_leader_id");

-- CreateIndex
CREATE INDEX "pr_assignments_deleted_at_idx" ON "pr_assignments"("deleted_at");

-- CreateIndex
CREATE INDEX "budget_exceptions_company_id_idx" ON "budget_exceptions"("company_id");

-- CreateIndex
CREATE INDEX "budget_exceptions_purchase_request_id_idx" ON "budget_exceptions"("purchase_request_id");

-- CreateIndex
CREATE INDEX "budget_exceptions_status_idx" ON "budget_exceptions"("status");

-- CreateIndex
CREATE INDEX "budget_exceptions_branch_manager_id_idx" ON "budget_exceptions"("branch_manager_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_role_idx" ON "notifications"("role");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_related_id_related_type_idx" ON "notifications"("related_id", "related_type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "branches_branch_code_key" ON "branches"("branch_code");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "branches_branch_code_idx" ON "branches"("branch_code");

-- CreateIndex
CREATE INDEX "branches_deleted_at_idx" ON "branches"("deleted_at");

-- CreateIndex
CREATE INDEX "branches_branch_director_id_idx" ON "branches"("branch_director_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_approval_rules_branch_id_key" ON "branch_approval_rules"("branch_id");

-- CreateIndex
CREATE INDEX "branch_approval_rules_company_id_idx" ON "branch_approval_rules"("company_id");

-- CreateIndex
CREATE INDEX "branch_approval_rules_branch_code_idx" ON "branch_approval_rules"("branch_code");

-- CreateIndex
CREATE INDEX "branch_approval_rules_deleted_at_idx" ON "branch_approval_rules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_department_code_key" ON "departments"("department_code");

-- CreateIndex
CREATE INDEX "departments_company_id_idx" ON "departments"("company_id");

-- CreateIndex
CREATE INDEX "departments_department_code_idx" ON "departments"("department_code");

-- CreateIndex
CREATE INDEX "departments_deleted_at_idx" ON "departments"("deleted_at");

-- CreateIndex
CREATE INDEX "departments_branch_id_idx" ON "departments"("branch_id");

-- CreateIndex
CREATE INDEX "approval_rules_company_id_idx" ON "approval_rules"("company_id");

-- CreateIndex
CREATE INDEX "approval_rules_department_code_idx" ON "approval_rules"("department_code");

-- CreateIndex
CREATE INDEX "approval_rules_department_id_idx" ON "approval_rules"("department_id");

-- CreateIndex
CREATE INDEX "approval_rules_branch_id_idx" ON "approval_rules"("branch_id");

-- CreateIndex
CREATE INDEX "approval_rules_status_idx" ON "approval_rules"("status");

-- CreateIndex
CREATE INDEX "approval_rules_deleted_at_idx" ON "approval_rules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_rules_department_code_pr_type_company_id_key" ON "approval_rules"("department_code", "pr_type", "company_id");

-- CreateIndex
CREATE INDEX "import_histories_company_id_idx" ON "import_histories"("company_id");

-- CreateIndex
CREATE INDEX "import_histories_import_type_idx" ON "import_histories"("import_type");

-- CreateIndex
CREATE INDEX "import_histories_imported_by_idx" ON "import_histories"("imported_by");

-- CreateIndex
CREATE INDEX "import_histories_imported_at_idx" ON "import_histories"("imported_at");

-- CreateIndex
CREATE INDEX "purchase_requests_type_idx" ON "purchase_requests"("type");

-- AddForeignKey
ALTER TABLE "pr_approvals" ADD CONSTRAINT "pr_approvals_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_approvals" ADD CONSTRAINT "pr_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_assignments" ADD CONSTRAINT "pr_assignments_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_assignments" ADD CONSTRAINT "pr_assignments_buyer_leader_id_fkey" FOREIGN KEY ("buyer_leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_assignments" ADD CONSTRAINT "pr_assignments_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_selections" ADD CONSTRAINT "supplier_selections_purchase_request_item_id_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_exceptions" ADD CONSTRAINT "budget_exceptions_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_exceptions" ADD CONSTRAINT "budget_exceptions_branch_manager_id_fkey" FOREIGN KEY ("branch_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_branch_director_id_fkey" FOREIGN KEY ("branch_director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_approval_rules" ADD CONSTRAINT "branch_approval_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_histories" ADD CONSTRAINT "import_histories_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "inventory_balances_part_internal_code_warehouse_code_company_id" RENAME TO "inventory_balances_part_internal_code_warehouse_code_compan_key";

-- RenameIndex
ALTER INDEX "supplier_selections_purchase_request_id_purchase_request_item_i" RENAME TO "supplier_selections_purchase_request_id_purchase_request_it_key";
