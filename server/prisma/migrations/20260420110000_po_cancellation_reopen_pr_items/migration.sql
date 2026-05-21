-- Add PO cancellation lifecycle statuses
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'CANCEL_REQUESTED';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Allow a PR item to appear in multiple POs over time
DROP INDEX IF EXISTS "po_items_purchase_request_item_id_key";
