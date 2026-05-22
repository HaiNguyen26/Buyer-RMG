/**
 * Đồng bộ PR cũ kẹt PO_PENDING / RFQ_COMPLETED trong khi đã có PO hoặc đã nhập kho xong.
 *
 *   npx tsx src/scripts/syncLegacyPrPoPhase.ts
 *   npx tsx src/scripts/syncLegacyPrPoPhase.ts --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { syncPurchaseRequestAfterGoodsReceipt } from '../utils/syncPrAfterGrn';

const STUCK_HEADER = new Set(['PO_PENDING', 'RFQ_COMPLETED', 'SUPPLIER_SELECTED']);

async function main() {
  const confirm = process.argv.includes('--confirm');

  const prs = await prisma.purchaseRequest.findMany({
    where: {
      deletedAt: null,
      status: { in: [...STUCK_HEADER] as any },
      purchaseOrders: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      prNumber: true,
      status: true,
      items: { where: { deletedAt: null }, select: { status: true } },
      purchaseOrders: {
        where: { deletedAt: null },
        select: { id: true, status: true, poNumber: true },
      },
    },
  });

  console.log(
    confirm ? 'APPLY syncLegacyPrPoPhase' : 'DRY RUN syncLegacyPrPoPhase',
    `— ${prs.length} PR có PO nhưng header còn ${[...STUCK_HEADER].join('/')}`
  );

  let toInProgress = 0;
  let toClosed = 0;

  for (const pr of prs) {
    const allFulfilled = pr.items.every(
      (i) => i.status === 'FULFILLED' || i.status === 'FROM_STOCK'
    );
    const hasSentPo = pr.purchaseOrders.some((po) =>
      ['SENT', 'ISSUED', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(
        String(po.status)
      )
    );

    if (allFulfilled && hasSentPo) {
      console.log(
        `  ${pr.prNumber} (${pr.status}): mọi dòng FULFILLED + PO đã gửi → chạy sync GRN → CLOSED`
      );
      if (confirm) {
        await prisma.$transaction(async (tx) => {
          await syncPurchaseRequestAfterGoodsReceipt(tx, pr.id);
        });
      }
      toClosed++;
      continue;
    }

    console.log(
      `  ${pr.prNumber} (${pr.status}): có PO [${pr.purchaseOrders.map((p) => p.poNumber).join(', ')}] → PO_IN_PROGRESS`
    );
    if (confirm) {
      await prisma.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: 'PO_IN_PROGRESS' as any },
      });
    }
    toInProgress++;
  }

  console.log(
    `\nKết quả: ${toInProgress} PR → PO_IN_PROGRESS, ${toClosed} PR → đóng sau sync GRN.`
  );
  if (!confirm && (toInProgress > 0 || toClosed > 0)) {
    console.log('Chạy lại với --confirm để ghi DB.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
