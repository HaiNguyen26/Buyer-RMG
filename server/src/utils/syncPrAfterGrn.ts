import { Prisma } from '@prisma/client';
import { itemDepartmentOutcomeAllowsProcurement } from './departmentPrItemReview';
import { lineReceiveCap } from './poLineConfirmation';

const PR_STATUSES_NO_AUTO_SYNC = new Set([
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
  'BUDGET_REJECTED',
  'PAYMENT_DONE',
  'CANCELLED',
  'CLOSED',
]);

function itemProcurementSatisfied(
  item: { id: string; status: string; departmentItemOutcome: string | null },
  fulfilledPrItemIds: Set<string>
): boolean {
  if (!itemDepartmentOutcomeAllowsProcurement(item.departmentItemOutcome)) return true;
  if (item.status === 'FULFILLED' || item.status === 'FROM_STOCK') return true;
  return fulfilledPrItemIds.has(item.id);
}

/**
 * Sau GRN: đánh dấu dòng PR FULFILLED khi đã nhận đủ (theo confirm/cap),
 * và đóng PR (CLOSED) khi mọi dòng còn trong luồng mua đã hoàn tất.
 */
export async function syncPurchaseRequestAfterGoodsReceipt(
  tx: Prisma.TransactionClient,
  purchaseRequestId: string
): Promise<{ prStatus: string | null; itemsMarkedFulfilled: number }> {
  const pr = await tx.purchaseRequest.findUnique({
    where: { id: purchaseRequestId },
    select: {
      id: true,
      status: true,
      items: {
        where: { deletedAt: null },
        select: { id: true, status: true, departmentItemOutcome: true },
      },
    },
  });
  if (!pr || PR_STATUSES_NO_AUTO_SYNC.has(pr.status)) {
    return { prStatus: null, itemsMarkedFulfilled: 0 };
  }

  const poItems = await tx.pOItem.findMany({
    where: { purchaseOrder: { purchaseRequestId, deletedAt: null } },
    select: {
      id: true,
      purchaseRequestItemId: true,
      qty: true,
      confirmedQty: true,
      lineStatus: true,
    },
  });

  const receivedMap = new Map<string, number>();
  if (poItems.length > 0) {
    const sums = await tx.goodsReceiptLine.groupBy({
      by: ['poItemId'],
      where: { poItemId: { in: poItems.map((p) => p.id) } },
      _sum: { qtyReceived: true },
    });
    for (const row of sums) {
      receivedMap.set(row.poItemId, Number(row._sum.qtyReceived || 0));
    }
  }

  const fulfilledPrItemIds = new Set<string>();
  let itemsMarkedFulfilled = 0;

  for (const row of poItems) {
    if (row.lineStatus === 'CANCELLED') {
      fulfilledPrItemIds.add(row.purchaseRequestItemId);
      continue;
    }
    const received = receivedMap.get(row.id) ?? 0;
    const cap = lineReceiveCap(row.confirmedQty, row.qty);
    if (cap <= 0) continue;
    if (received + 1e-9 >= cap) {
      fulfilledPrItemIds.add(row.purchaseRequestItemId);
      const updated = await tx.purchaseRequestItem.updateMany({
        where: {
          id: row.purchaseRequestItemId,
          deletedAt: null,
          status: { not: 'FULFILLED' as any },
        },
        data: { status: 'FULFILLED' as any },
      });
      itemsMarkedFulfilled += updated.count;
    }
  }

  const allDone = pr.items.every((item) =>
    itemProcurementSatisfied(
      {
        id: item.id,
        status: item.status,
        departmentItemOutcome: item.departmentItemOutcome,
      },
      fulfilledPrItemIds
    )
  );

  if (!allDone) {
    return { prStatus: pr.status, itemsMarkedFulfilled };
  }

  if (pr.status !== 'CLOSED') {
    await tx.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: 'CLOSED' as any },
    });
    return { prStatus: 'CLOSED', itemsMarkedFulfilled };
  }

  return { prStatus: 'CLOSED', itemsMarkedFulfilled };
}
