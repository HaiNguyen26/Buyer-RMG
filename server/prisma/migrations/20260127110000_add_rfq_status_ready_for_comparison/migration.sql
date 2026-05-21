-- Add READY_FOR_COMPARISON to RFQStatus enum (idempotent)
-- Buyer hoàn thành nhập báo giá, sẵn sàng để Buyer Leader so sánh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'RFQStatus' AND e.enumlabel = 'READY_FOR_COMPARISON'
  ) THEN
    ALTER TYPE "RFQStatus" ADD VALUE 'READY_FOR_COMPARISON';
  END IF;
END $$;
