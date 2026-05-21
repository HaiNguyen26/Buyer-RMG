import { prisma } from '../config/database';
import { lineReceiveCap } from './poLineConfirmation';

/**
 * PR item ids that no longer need a new PO: status FULFILLED, or cumulative GRN
 * qty >= ordered qty on any PO line for that PR item (includes cancelled POs).
 */
export async function getProcurementCompletePrItemIdsForPurchaseRequests(
  purchaseRequestIds: string[]
): Promise<Set<string>> {
  const closed = new Set<string>();
  if (!purchaseRequestIds.length) return closed;

  const fulfilledRows = await prisma.purchaseRequestItem.findMany({
    where: {
      purchaseRequestId: { in: purchaseRequestIds },
      deletedAt: null,
      status: 'FULFILLED' as any,
    },
    select: { id: true },
  });
  for (const r of fulfilledRows) closed.add(r.id);

  const deptExcluded = await prisma.purchaseRequestItem.findMany({
    where: {
      purchaseRequestId: { in: purchaseRequestIds },
      deletedAt: null,
      OR: [
        { departmentItemOutcome: { in: ['REJECTED', 'ON_HOLD', 'REVISION_REQUIRED'] as any } },
        { branchItemOutcome: { in: ['REJECTED', 'ON_HOLD', 'REVISION_REQUIRED'] as any } },
      ],
    },
    select: { id: true },
  });
  for (const r of deptExcluded) closed.add(r.id);

  const poItems = await prisma.pOItem.findMany({
    where: {
      purchaseOrder: { purchaseRequestId: { in: purchaseRequestIds }, deletedAt: null },
    },
    select: { id: true, purchaseRequestItemId: true, qty: true, confirmedQty: true, lineStatus: true },
  });
  if (!poItems.length) return closed;

  const sums = await prisma.goodsReceiptLine.groupBy({
    by: ['poItemId'],
    where: { poItemId: { in: poItems.map((p) => p.id) } },
    _sum: { qtyReceived: true },
  });
  const got = new Map(sums.map((s) => [s.poItemId, Number(s._sum.qtyReceived || 0)]));
  for (const row of poItems) {
    if (row.lineStatus === 'CANCELLED') {
      closed.add(row.purchaseRequestItemId);
      continue;
    }
    const received = got.get(row.id) ?? 0;
    const cap = lineReceiveCap(row.confirmedQty, row.qty);
    if (cap > 0 && received + 1e-9 >= cap) closed.add(row.purchaseRequestItemId);
  }
  return closed;
}

export function parsePoItemIdsJson(raw: string | null | undefined): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  } catch {
    return null;
  }
}
