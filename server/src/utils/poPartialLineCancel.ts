import type { POStatus } from '@prisma/client';
import { lineReceiveCap, resolveLineStatusAfterReceive } from './poLineConfirmation';

export type PoLineCancelSnapshot = {
  id: string;
  purchaseRequestItemId: string;
  qty: number;
  confirmedQty: number | null;
  received: number;
  lineStatus: string;
};

export type LineCancelApprovalRow = {
  id: string;
  purchaseRequestItemId: string;
  remaining: number;
  received: number;
  ordered: number;
};

/** Mọi dòng: đã nhận đủ (active) hoặc đã hủy phần còn lại (CANCELLED). */
export function isPoLifecycleComplete(lines: PoLineCancelSnapshot[]): boolean {
  return lines.every((l) => {
    if (l.lineStatus === 'CANCELLED') return true;
    const cap = lineReceiveCap(l.confirmedQty, l.qty);
    return l.received + 1e-9 >= cap;
  });
}

/**
 * PO vẫn active nếu còn dòng OPEN/CONFIRMED/PARTIAL chưa nhận đủ.
 * Chỉ CLOSED khi mọi dòng đã nhận đủ hoặc CANCELLED.
 */
export function resolveOperationalPoStatusAfterLineCancel(
  lines: PoLineCancelSnapshot[],
  opts: { supplierConfirmedAt: Date | null | undefined }
): POStatus {
  if (lines.length === 0) return 'CLOSED';

  if (isPoLifecycleComplete(lines)) {
    return 'CLOSED';
  }

  const active = lines.filter((l) => l.lineStatus !== 'CANCELLED');
  if (active.length === 0) {
    return 'CLOSED';
  }

  const anyPartial = active.some((l) => {
    const cap = lineReceiveCap(l.confirmedQty, l.qty);
    return l.received > 1e-9 && l.received + 1e-9 < cap;
  });
  if (anyPartial) return 'PARTIAL_RECEIVED';

  const anyReceived = active.some((l) => l.received > 1e-9);
  if (anyReceived) return 'PARTIAL_RECEIVED';

  if (opts.supplierConfirmedAt) return 'CONFIRMED';
  return 'SENT';
}

export function buildLineCancelApprovalRows(
  poItems: Array<{
    id: string;
    purchaseRequestItemId: string;
    qty: number | { toString(): string };
    confirmedQty?: number | null;
  }>,
  receivedMap: Map<string, number>,
  cancelPoItemIds: string[]
): {
  cancelLines: LineCancelApprovalRow[];
  fulfilledNotCancelled: Array<{ id: string; purchaseRequestItemId: string }>;
  invalidCancelIds: string[];
} {
  const cancelSet = new Set(cancelPoItemIds);
  const poItemById = new Map(poItems.map((it) => [it.id, it]));

  const invalidCancelIds: string[] = [];
  for (const id of cancelSet) {
    if (!poItemById.has(id)) invalidCancelIds.push(id);
  }

  const cancelLines: LineCancelApprovalRow[] = [];
  const fulfilledNotCancelled: Array<{ id: string; purchaseRequestItemId: string }> = [];

  for (const it of poItems) {
    const ordered = Number(it.qty);
    const received = receivedMap.get(it.id) ?? 0;
    const remaining = Math.max(0, ordered - received);

    if (cancelSet.has(it.id)) {
      if (remaining > 1e-9) {
        cancelLines.push({
          id: it.id,
          purchaseRequestItemId: it.purchaseRequestItemId,
          remaining,
          received,
          ordered,
        });
      }
      continue;
    }

    if (received + 1e-9 >= ordered) {
      fulfilledNotCancelled.push({ id: it.id, purchaseRequestItemId: it.purchaseRequestItemId });
    }
  }

  return { cancelLines, fulfilledNotCancelled, invalidCancelIds };
}

export function lineStatusAfterCancelApproval(
  line: PoLineCancelSnapshot
): string {
  if (line.lineStatus === 'CANCELLED') return 'CANCELLED';
  return resolveLineStatusAfterReceive(
    line.confirmedQty,
    line.qty,
    line.received,
    line.lineStatus
  );
}
