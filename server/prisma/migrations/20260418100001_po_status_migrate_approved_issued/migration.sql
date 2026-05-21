-- Chạy sau khi migration 20260418100000 đã commit — lúc này CREATED/SENT/CONFIRMED đã an toàn để gán.

UPDATE "purchase_orders" SET "status" = 'CREATED' WHERE "status" = 'APPROVED';
UPDATE "purchase_orders" SET "status" = 'SENT' WHERE "status" = 'ISSUED';
