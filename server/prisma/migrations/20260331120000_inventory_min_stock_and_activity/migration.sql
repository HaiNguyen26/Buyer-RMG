-- AlterTable
ALTER TABLE "inventory_balances" ADD COLUMN "min_stock" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "inventory_activities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "part_internal_code" TEXT NOT NULL,
    "warehouse_code" TEXT NOT NULL,
    "part_name" TEXT,
    "change_type" TEXT NOT NULL,
    "delta_available" DECIMAL(18,4) NOT NULL,
    "quantity_after" DECIMAL(18,4),
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_activities_company_id_created_at_idx" ON "inventory_activities"("company_id", "created_at");
