-- Xóa dữ liệu demo đã chèn qua migration seed (Samsung + SO-2026-001).
-- An toàn khi chạy nhiều lần; không ảnh hưởng khách hàng/SO thật khác mã.

DELETE FROM sales_pos
WHERE deleted_at IS NULL
  AND (
    sales_po_number = 'SO-2026-001'
    OR notes ILIKE '%Mock data đầy đủ để test%'
  );

DELETE FROM customers
WHERE deleted_at IS NULL
  AND (
    (code = 'SAMSUNG' AND notes ILIKE '%Mock data%')
    OR notes = 'Mock data để test tạo Customer PO'
  );
