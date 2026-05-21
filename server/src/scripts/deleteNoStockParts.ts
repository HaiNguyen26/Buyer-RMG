/**
 * Xóa vật tư danh mục không có tồn khả dụng (company_id = null).
 *
 * Tiêu chí xóa:
 * - Không có bản ghi tồn kho, HOẶC
 * - Tổng tồn khả dụng <= 0 (sum(quantity_available - quantity_reserved) <= 0)
 *
 * Chạy:
 *   npx tsx src/scripts/deleteNoStockParts.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';

async function run(): Promise<void> {
  console.log('\n🧹 Bắt đầu dọn danh mục vật tư không có tồn...\n');

  const masters = await prisma.partMaster.findMany({
    where: { companyId: null },
    select: { id: true, partInternalCode: true, partName: true },
  });

  if (masters.length === 0) {
    console.log('Không có part master nào để xử lý.');
    return;
  }

  const stockRows = await prisma.inventoryBalance.groupBy({
    by: ['partInternalCode'],
    where: { companyId: null },
    _sum: { quantityAvailable: true, quantityReserved: true },
  });

  const stockByCode = new Map<string, number>();
  for (const row of stockRows) {
    const available = Number(row._sum.quantityAvailable ?? 0);
    const reserved = Number(row._sum.quantityReserved ?? 0);
    stockByCode.set(row.partInternalCode, available - reserved);
  }

  const toDelete = masters.filter((p) => {
    const net = stockByCode.get(p.partInternalCode);
    if (net == null) return true; // không có tồn kho ở bất kỳ kho nào
    return net <= 0;
  });

  if (toDelete.length === 0) {
    console.log('✅ Không có vật tư nào thuộc diện "chưa có tồn".');
    return;
  }

  const codes = toDelete.map((p) => p.partInternalCode);
  const result = await prisma.partMaster.deleteMany({
    where: {
      companyId: null,
      partInternalCode: { in: codes },
    },
  });

  console.log(`✅ Đã xóa ${result.count} vật tư chưa có tồn.`);
  console.log(`   Tổng part master đã quét: ${masters.length}`);
  console.log(`   Tổng part bị xóa: ${toDelete.length}\n`);
}

async function main() {
  try {
    await run();
  } catch (error) {
    console.error('❌ Lỗi khi xóa vật tư chưa có tồn:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();

