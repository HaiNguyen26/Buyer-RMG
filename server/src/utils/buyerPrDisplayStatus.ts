import type { Prisma } from '@prisma/client';

export type BuyerPrDisplayStatus =
  | 'READY_FOR_RFQ'
  | 'COLLECTING_QUOTATION'
  | 'QUOTATION_COMPLETED'
  | 'AWAITING_REORDER'
  | 'AWAITING_PO'
  | 'PO_IN_PROGRESS'
  | 'PO_ISSUED'
  | 'BUDGET_EXCEPTION_PENDING';

/** Dòng trong phạm vi buyer đã chọn NCC, còn chờ tạo PO (chưa FULFILLED / chưa có PO). */
function assignedScopeHasItemsAwaitingPo(
  items: ItemLike[],
  assignedIds: Set<string>
): boolean {
  return items.some(
    (it) => assignedIds.has(it.id) && String(it.status) === 'SUPPLIER_SELECTED'
  );
}

type AssignmentLike = { scope: string; assignedItemIds: string | null };
type ItemLike = {
  id: string;
  status: string;
  purchaseQty?: Prisma.Decimal | number | null;
};
type RfqLike = { status: string };

/** Tập item thuộc phạm vi phân công của buyer trên PR. */
export function resolveBuyerAssignedItemIdSet(
  assignments: AssignmentLike[],
  allItemIds: string[]
): Set<string> {
  const itemIdSet = new Set(allItemIds);
  const assignedSet = new Set<string>();
  for (const asg of assignments) {
    if (asg.scope === 'FULL') {
      allItemIds.forEach((id) => assignedSet.add(id));
    } else if (asg.scope === 'PARTIAL' && asg.assignedItemIds) {
      try {
        const parsed = JSON.parse(asg.assignedItemIds) as string[];
        parsed.forEach((id) => {
          if (itemIdSet.has(id)) assignedSet.add(id);
        });
      } catch {
        // ignore parse error
      }
    }
  }
  return assignedSet;
}

export function isPrItemAwaitingRepurchase(item: ItemLike): boolean {
  const pq = Number(item.purchaseQty ?? 0);
  return String(item.status) === 'ASSIGNED' && pq > 1e-9;
}

/** Dòng ASSIGNED còn purchaseQty — chờ RFQ/PO mới (sau hủy dòng PO hoặc phân công mới). */
export function countItemsAwaitingPurchase(
  items: ItemLike[],
  assignedIds: Set<string>
): number {
  let n = 0;
  for (const it of items) {
    if (!assignedIds.has(it.id)) continue;
    const pq = Number(it.purchaseQty ?? 0);
    if (isPrItemAwaitingRepurchase(it)) n++;
  }
  return n;
}

const RFQ_DONE_STATUSES = new Set(['READY_FOR_COMPARISON', 'CLOSED']);

const ITEM_RFQ_ACTIVE_STATUSES = new Set(['RFQ_CREATED', 'RFQ_SUBMITTED', 'READY_FOR_REVIEW']);

function assignedItemsHaveActiveRfqWork(items: ItemLike[], assignedIds: Set<string>): boolean {
  return items.some(
    (it) => assignedIds.has(it.id) && ITEM_RFQ_ACTIVE_STATUSES.has(String(it.status))
  );
}

/**
 * Trạng thái PR trên danh sách Buyer — ưu tiên item còn cần mua sau hủy dòng PO.
 */
export function computeBuyerPrDisplayStatus(opts: {
  buyerRfqs: RfqLike[];
  items: ItemLike[];
  assignments: AssignmentLike[];
  /** Trạng thái PR trong DB (phase PO, v.v.) */
  prStatus?: string | null;
  /** Đã có ít nhất một PO (draft hoặc đã gửi) — không hiển thị "Chờ tạo PO" nữa. */
  hasPurchaseOrders?: boolean;
}): { status: BuyerPrDisplayStatus; awaitingPurchaseCount: number } {
  const allItemIds = opts.items.map((i) => i.id);
  const assignedIds = resolveBuyerAssignedItemIdSet(opts.assignments, allItemIds);
  const awaitingPurchaseCount = countItemsAwaitingPurchase(opts.items, assignedIds);

  const prStatus = String(opts.prStatus ?? '');

  if (prStatus === 'PO_ISSUED') {
    return { status: 'PO_ISSUED', awaitingPurchaseCount };
  }
  if (prStatus === 'PO_IN_PROGRESS') {
    return { status: 'PO_IN_PROGRESS', awaitingPurchaseCount };
  }

  if (
    prStatus === 'PO_PENDING' ||
    prStatus === 'RFQ_COMPLETED' ||
    prStatus === 'SUPPLIER_SELECTED' ||
    prStatus === 'BUDGET_APPROVED'
  ) {
    if (awaitingPurchaseCount > 0) {
      return { status: 'AWAITING_REORDER', awaitingPurchaseCount };
    }
    if (opts.hasPurchaseOrders) {
      return { status: 'PO_IN_PROGRESS', awaitingPurchaseCount };
    }
    return { status: 'AWAITING_PO', awaitingPurchaseCount };
  }

  const buyerRfqs = opts.buyerRfqs || [];

  /** NCC đã chọn — ưu tiên "Chờ tạo PO" trước cờ BUDGET_EXCEPTION (PR có thể chưa sync status). */
  if (assignedScopeHasItemsAwaitingPo(opts.items, assignedIds)) {
    if (awaitingPurchaseCount > 0) {
      return { status: 'AWAITING_REORDER', awaitingPurchaseCount };
    }
    return { status: 'AWAITING_PO', awaitingPurchaseCount };
  }

  if (prStatus === 'BUDGET_EXCEPTION') {
    return { status: 'BUDGET_EXCEPTION_PENDING', awaitingPurchaseCount };
  }

  if (buyerRfqs.length === 0) {
    if (assignedItemsHaveActiveRfqWork(opts.items, assignedIds)) {
      return { status: 'COLLECTING_QUOTATION', awaitingPurchaseCount };
    }
    return { status: 'READY_FOR_RFQ', awaitingPurchaseCount };
  }

  const allRfqsDone = buyerRfqs.every((r) => RFQ_DONE_STATUSES.has(String(r.status)));

  if (awaitingPurchaseCount > 0 && allRfqsDone) {
    return { status: 'AWAITING_REORDER', awaitingPurchaseCount };
  }

  if (allRfqsDone) {
    if (assignedScopeHasItemsAwaitingPo(opts.items, assignedIds)) {
      return { status: 'AWAITING_PO', awaitingPurchaseCount };
    }
    return { status: 'QUOTATION_COMPLETED', awaitingPurchaseCount };
  }

  return { status: 'COLLECTING_QUOTATION', awaitingPurchaseCount };
}
