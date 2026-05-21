/**
 * Xóa toàn bộ Sales PO (bảng sales_pos / Customer PO nội bộ).
 * FK purchase_requests.sales_po_id và stock_issues.sales_po_id là ON DELETE SET NULL — DB tự gỡ liên kết.
 * Chạy từ thư mục server: npx tsx src/scripts/deleteAllSalesOrders.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';

async function main() {
  const before = await prisma.salesPO.count();
  console.log(`Đang xóa ${before} bản ghi sales_pos...`);

  const result = await prisma.salesPO.deleteMany({});

  console.log(`Đã xóa ${result.count} Sales PO (sales_pos).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
