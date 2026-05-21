-- Chỉ thêm literal enum — KHÔNG được dùng giá trị mới (UPDATE/…) trong cùng transaction (PostgreSQL E55P04).
-- Dữ liệu cũ được cập nhật ở migration kế tiếp.

ALTER TYPE "POStatus" ADD VALUE 'CREATED';
ALTER TYPE "POStatus" ADD VALUE 'SENT';
ALTER TYPE "POStatus" ADD VALUE 'CONFIRMED';
