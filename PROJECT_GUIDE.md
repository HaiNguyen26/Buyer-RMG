# Hướng dẫn dự án Web-App-Buyer-RMG

## Repo GitHub
- https://github.com/HaiNguyen26/Buyer-RMG.git

## Tổng quan
Hệ thống mua hàng theo luồng Requestor → Quản lý trực tiếp → GĐ Chi nhánh → Buyer Leader → Buyer.

## Tech stack
- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Backend: Fastify, TypeScript, Prisma
- Database: PostgreSQL
- Realtime: Socket.IO
- Auth: JWT
- Khác: Sentry, AWS S3 (optional), Excel import (ExcelJS)

## Cổng mặc định
- Backend API: `http://127.0.0.1:5000`
- Frontend: `http://127.0.0.1:5173` (Vite)

## Yêu cầu môi trường (máy mới)
- Node.js LTS (>= 18)
- npm (đi kèm Node)
- PostgreSQL 14+
- Git
- Windows: cài Visual Studio Build Tools (phục vụ gói native như argon2)

## Cài đặt dự án (máy mới)
1) Clone repo
```
git clone https://github.com/HaiNguyen26/Buyer-RMG.git
cd Web-App-Buyer-RMG
```

2) Cài gói backend
```
cd server
npm install
```

3) Cài gói frontend
```
cd ../client
npm install
```

4) Tạo file môi trường
- Backend: tạo `server/.env`
  - Bắt buộc: `DATABASE_URL`, `JWT_SECRET`
  - Optional: S3/Sentry nếu dùng
- Frontend: tạo `client/.env` (nếu cần cấu hình API)

### .env mẫu
**server/.env**
```
DATABASE_URL="postgresql://buyer_rmg:Hainguyen261097@localhost:5432/buyer_rmg?schema=public"
JWT_SECRET="change_this_secret"
SENTRY_DSN=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_REGION=""
S3_BUCKET=""
```

**client/.env**
```
VITE_API_BASE_URL=http://127.0.0.1:5000
```

## Hướng dẫn DB chi tiết (PostgreSQL)
1) Tạo user & database

**PowerShell (Windows)**
```
psql -U postgres -c "CREATE USER buyer_rmg WITH PASSWORD 'Hainguyen261097';"
psql -U postgres -c "CREATE DATABASE buyer_rmg OWNER buyer_rmg;"
```

**Git Bash**
```
psql -U postgres -c "CREATE USER buyer_rmg WITH PASSWORD 'Hainguyen261097';"
psql -U postgres -c "CREATE DATABASE buyer_rmg OWNER buyer_rmg;"
```

2) Cập nhật `DATABASE_URL` trong `server/.env`
```
DATABASE_URL="postgresql://buyer_rmg:Hainguyen261097@localhost:5432/buyer_rmg?schema=public"
```

3) Chạy Prisma
```
cd server
npx prisma generate
npx prisma migrate deploy
```

5) Prisma
```
cd ../server
npx prisma generate
npx prisma migrate deploy
```

## Lệnh chạy dev
Backend (watch)
```
cd server
npm run dev
```

Frontend (Vite)
```
cd client
npm run dev
```

## Build & chạy production
Backend
```
cd server
npm run build
npm start
```

Frontend
```
cd client
npm run build
npm run preview
```

## Ghi chú
- Prisma migrations: `server/prisma/migrations`
- API routes: `server/src/routes`
- Entry backend: `server/src/server.ts`
- Socket.IO đã bật mặc định

## Troubleshooting
- Không kết nối DB: kiểm tra `DATABASE_URL` trong `server/.env`
- Prisma lỗi sau khi đổi schema: chạy `npx prisma generate`
