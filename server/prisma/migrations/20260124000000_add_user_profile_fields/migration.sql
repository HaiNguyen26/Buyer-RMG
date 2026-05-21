-- Add missing user profile fields to match Prisma schema
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "direct_manager_code" TEXT;
