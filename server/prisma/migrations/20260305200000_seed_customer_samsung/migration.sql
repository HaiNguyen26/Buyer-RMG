-- Seed 1 khách hàng mẫu Samsung để test tạo Customer PO (chỉ insert nếu chưa có)
INSERT INTO customers (id, name, code, email, phone, address, tax_code, contact_person, notes, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'Samsung',
  'SAMSUNG',
  'contact@samsung.com.vn',
  '028 5413 5678',
  'Tầng 15, Tòa nhà Keangnam, Phạm Hùng, Nam Từ Liêm, Hà Nội',
  '0100686206',
  'Bộ phận Mua sắm',
  'Mock data để test tạo Customer PO',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customers
  WHERE (name = 'Samsung' OR code = 'SAMSUNG') AND deleted_at IS NULL
);
