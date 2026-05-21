/**
 * Sửa PR kẹt PO_IN_PROGRESS sau khi đã nhận đủ hàng (GRN).
 * Chạy: npm run sync-pr-after-grn
 */
import { prisma } from '../config/database';
import { syncPurchaseRequestAfterGoodsReceipt } from '../utils/syncPrAfterGrn';

async function main() {
  const prs = await prisma.purchaseRequest.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PO_IN_PROGRESS', 'PO_ISSUED', 'PO_PENDING', 'RFQ_COMPLETED'] as any },
    },
    select: { id: true, prNumber: true, status: true },
  });

  let closed = 0;
  let fulfilledItems = 0;

  for (const pr of prs) {
    const result = await prisma.$transaction((tx) =>
      syncPurchaseRequestAfterGoodsReceipt(tx, pr.id)
    );
    if (result.prStatus === 'CLOSED') {
      closed += 1;
      console.log(`CLOSED ${pr.prNumber} (was ${pr.status})`);
    }
    fulfilledItems += result.itemsMarkedFulfilled;
  }

  console.log(
    `Done. Scanned ${prs.length} PR(s), closed ${closed}, marked ${fulfilledItems} item(s) FULFILLED.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
