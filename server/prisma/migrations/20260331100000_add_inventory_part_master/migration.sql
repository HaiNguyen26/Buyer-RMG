-- CreateTable
CREATE TABLE "part_masters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "part_internal_code" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "part_internal_code" TEXT NOT NULL,
    "part_name" TEXT,
    "unit" TEXT NOT NULL,
    "quantity_available" DECIMAL(18,4) NOT NULL,
    "quantity_reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "warehouse_code" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_masters_company_id_idx" ON "part_masters"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "part_masters_part_internal_code_company_id_key" ON "part_masters"("part_internal_code", "company_id");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_code_idx" ON "inventory_balances"("warehouse_code");

-- CreateIndex
CREATE INDEX "inventory_balances_company_id_idx" ON "inventory_balances"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_part_internal_code_warehouse_code_company_id_key" ON "inventory_balances"("part_internal_code", "warehouse_code", "company_id");
