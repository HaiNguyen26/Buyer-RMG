/**
 * Xóa toàn bộ phiếu xuất kho: nhả InventoryReservation + giảm quantityReserved, sau đó xóa stock_issues (cascade items).
 * Chạy từ thư mục server: npx tsx src/scripts/deleteAllStockIssues.ts
 */
import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { releaseReservationsForIssueItem } from '../utils/inventoryReservation';

export async function runDeleteAllStockIssues(client: PrismaClient = prisma): Promise<{ issues: number; items: number }> {
  const items = await client.stockIssueItem.findMany({ select: { id: true } });
  const issues = await client.stockIssue.findMany({ select: { id: true } });
  console.log(`[Stock issue] Tìm thấy ${issues.length} phiếu, ${items.length} dòng hàng.`);

  if (issues.length === 0) {
    return { issues: 0, items: 0 };
  }

  let deletedIssues = 0;
  await client.$transaction(async (tx) => {
    for (const { id } of items) {
      await releaseReservationsForIssueItem(tx, id, null, 'Script xóa toàn bộ phiếu xuất kho');
    }
    const deleted = await tx.stockIssue.deleteMany({});
    deletedIssues = deleted.count;
    console.log(`[Stock issue] Đã xóa ${deletedIssues} phiếu (cascade dòng hàng).`);
  });

  return { issues: deletedIssues, items: items.length };
}

async function main() {
  try {
    await runDeleteAllStockIssues();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require.main === module) {
  void main();
}
