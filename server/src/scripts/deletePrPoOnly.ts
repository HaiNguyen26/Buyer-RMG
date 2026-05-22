/**
 * Xóa GRN + toàn bộ PR/PO/RFQ/báo giá. Giữ NCC (suppliers).
 * npm run delete-pr-po-only
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { runDeleteAllPRs } from './deleteAllPRs';

async function main() {
  console.log('\n🗑️  Xóa GRN + PR + PO + RFQ (giữ NCC)…\n');

  const gl = await prisma.goodsReceiptLine.deleteMany({});
  const g = await prisma.goodsReceipt.deleteMany({});
  console.log(`   GRN: ${g.count}, lines: ${gl.count}`);

  await runDeleteAllPRs();

  const seq = await prisma.documentSequence.deleteMany({
    where: {
      OR: [
        { sequenceKey: { startsWith: 'PR:' } },
        { sequenceKey: { startsWith: 'RFQ:' } },
        { sequenceKey: { startsWith: 'PO-DRAFT:' } },
        { sequenceKey: { startsWith: 'PO:' } },
        { sequenceKey: { startsWith: 'GRN:' } },
      ],
    },
  });
  console.log(`   Reset sequences: ${seq.count}`);

  const notif = await prisma.notification.deleteMany({
    where: {
      relatedType: { in: ['PR', 'RFQ', 'PURCHASE_REQUEST', 'PO', 'PURCHASE_ORDER'] },
    },
  });
  console.log(`   Notifications: ${notif.count}`);

  const [pr, po, rfq] = await Promise.all([
    prisma.purchaseRequest.count(),
    prisma.purchaseOrder.count(),
    prisma.rFQ.count(),
  ]);
  const suppliers = await prisma.supplier.count({ where: { deletedAt: null } });
  console.log(`\n✅ Còn lại — PR: ${pr}, PO: ${po}, RFQ: ${rfq}, NCC: ${suppliers}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
