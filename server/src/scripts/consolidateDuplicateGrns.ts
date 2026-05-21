/**
 * LEGACY — Gộp GRN trùng PO (nhiều phiếu → 1 phiếu). Chỉ dùng khi dọn DB cũ thủ công.
 * Luồng vận hành: nhiều GRN / PO — không gọi script này trong app.
 *
 * Chạy: npm run consolidate-grns
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { consolidateDuplicateGrnsForPo } from '../utils/grnOnePerPo';

async function main() {
  const dupGroups = await prisma.goodsReceipt.groupBy({
    by: ['purchaseOrderId'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (!dupGroups.length) {
    console.log('OK — Không có PO nào có nhiều hơn 1 GRN. Có thể chạy: npx prisma db push');
    return;
  }

  console.log(`Tìm thấy ${dupGroups.length} PO có nhiều GRN — đang gộp...\n`);

  for (const g of dupGroups) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: g.purchaseOrderId },
      select: { poNumber: true },
    });
    const before = await prisma.goodsReceipt.findMany({
      where: { purchaseOrderId: g.purchaseOrderId },
      select: { id: true, grnNumber: true },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    });

    const kept = await prisma.$transaction((tx) =>
      consolidateDuplicateGrnsForPo(tx, g.purchaseOrderId)
    );

    console.log(
      `PO ${po?.poNumber ?? g.purchaseOrderId}: ${before.length} GRN → giữ ${kept?.grnNumber ?? '—'}`
    );
    const removed = before.filter((b) => b.id !== kept?.id).map((b) => b.grnNumber);
    if (removed.length) console.log(`  Đã xóa: ${removed.join(', ')}`);
  }

  const remaining = await prisma.goodsReceipt.groupBy({
    by: ['purchaseOrderId'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (remaining.length) {
    console.error(`\nFAIL — Vẫn còn ${remaining.length} PO trùng GRN.`);
    process.exit(1);
  }

  console.log('\nOK — Mỗi PO còn đúng 1 GRN. Chạy tiếp: npx prisma db push');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
