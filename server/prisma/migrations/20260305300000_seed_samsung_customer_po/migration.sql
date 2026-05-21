-- Seed 1 Customer PO (Sales PO) mẫu cho Samsung — dự án Factory Camera System
-- Requestor chọn PO này thì hệ thống tự điền thông tin khách hàng, dự án từ DB
INSERT INTO sales_pos (
  id,
  sales_po_number,
  customer_po_number,
  customer_id,
  project_name,
  project_code,
  amount,
  currency,
  effective_date,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'SO-2026-001',
  '223212',
  c.id,
  'Factory Camera System',
  'PROJ-SAMSUNG-2026-001',
  5000000000,
  'VND',
  NOW(),
  'ACTIVE',
  'Dự án hệ thống camera nhà máy Samsung — Mock data đầy đủ để test',
  NOW(),
  NOW()
FROM customers c
WHERE (c.name = 'Samsung' OR c.code = 'SAMSUNG') AND c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM sales_pos WHERE sales_po_number = 'SO-2026-001' AND deleted_at IS NULL)
LIMIT 1;
