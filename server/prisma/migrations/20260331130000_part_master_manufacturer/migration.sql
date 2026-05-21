-- AlterTable (idempotent)
ALTER TABLE "part_masters" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
