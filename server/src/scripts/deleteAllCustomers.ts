/**
 * Xóa toàn bộ khách hàng (customers).
 * Bảng sales_pos có FK RESTRICT → tự xóa hết Sales PO trước (PR/stock issue được SET NULL qua delete sales_pos).
 * Chạy: npx tsx src/scripts/deleteAllCustomers.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';

async function main() {
  const so = await prisma.salesPO.count();
  const cu = await prisma.customer.count();
  console.log(`Hiện có ${so} sales_pos, ${cu} customers.`);

  const delSo = await prisma.salesPO.deleteMany({});
  console.log(`Đã xóa ${delSo.count} Sales PO.`);

  const delCu = await prisma.customer.deleteMany({});
  console.log(`Đã xóa ${delCu.count} khách hàng (customers).`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
