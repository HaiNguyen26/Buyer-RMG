import { Prisma } from '@prisma/client';
import { toPoNum } from './poLineConfirmation';

export type GrnLineQtySnap = { poItemId: string; qtyReceived: Prisma.Decimal };

/** Gộp số lượng nhận theo poItemId (nhiều phiếu GRN cùng PO → một bộ dòng). */
export function mergeGrnLineQtys(lineGroups: GrnLineQtySnap[][]): GrnLineQtySnap[] {
  const totals = new Map<string, number>();
  for (const lines of lineGroups) {
    for (const line of lines) {
      totals.set(line.poItemId, (totals.get(line.poItemId) ?? 0) + toPoNum(line.qtyReceived));
    }
  }
  return [...totals.entries()].map(([poItemId, qty]) => ({
    poItemId,
    qtyReceived: new Prisma.Decimal(qty),
  }));
}

type GrnCollapsible<TPo, TReceiver> = {
  id: string;
  purchaseOrderId: string;
  grnNumber: string;
  receivedAt: Date;
  note: string | null;
  lines: GrnLineQtySnap[];
  receivedBy: TReceiver;
  purchaseOrder: TPo;
};

/** Một dòng lịch sử / chi tiết cho mỗi PO (không tách theo từng lần bấm nhận). */
export function collapseGrnsByPurchaseOrder<T extends GrnCollapsible<unknown, unknown>>(
  grns: T[]
): T[] {
  const byPo = new Map<string, T[]>();
  for (const g of grns) {
    const list = byPo.get(g.purchaseOrderId) ?? [];
    list.push(g);
    byPo.set(g.purchaseOrderId, list);
  }

  const collapsed: T[] = [];
  for (const group of byPo.values()) {
    group.sort(
      (a, b) =>
        a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id)
    );
    const primary = group[0]!;
    const latest = group.reduce(
      (best, g) => (g.receivedAt > best.receivedAt ? g : best),
      primary
    );
    const mergedLines = mergeGrnLineQtys(group.map((g) => g.lines));
    collapsed.push({
      ...primary,
      lines: mergedLines,
      receivedAt: latest.receivedAt,
      receivedBy: latest.receivedBy,
      note: latest.note ?? primary.note,
    });
  }

  return collapsed.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

/**
 * Gộp mọi GRN trùng PO về phiếu đầu tiên (theo thời gian), xóa phiếu dư.
 * Gọi trước khi cập nhật lần nhận tiếp theo.
 */
export async function consolidateDuplicateGrnsForPo(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string
): Promise<{ id: string; grnNumber: string } | null> {
  const all = await tx.goodsReceipt.findMany({
    where: { purchaseOrderId },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    include: { lines: true },
  });
  if (!all.length) return null;

  const primary = all[0]!;
  for (let i = 1; i < all.length; i++) {
    const extra = all[i]!;
    for (const line of extra.lines) {
      const existing = await tx.goodsReceiptLine.findFirst({
        where: { goodsReceiptId: primary.id, poItemId: line.poItemId },
      });
      if (existing) {
        await tx.goodsReceiptLine.update({
          where: { id: existing.id },
          data: {
            qtyReceived: new Prisma.Decimal(
              toPoNum(existing.qtyReceived) + toPoNum(line.qtyReceived)
            ),
          },
        });
      } else {
        await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: primary.id,
            poItemId: line.poItemId,
            qtyReceived: line.qtyReceived,
          },
        });
      }
    }
    await tx.goodsReceiptLine.deleteMany({ where: { goodsReceiptId: extra.id } });
    await tx.goodsReceipt.delete({ where: { id: extra.id } });
  }

  return { id: primary.id, grnNumber: primary.grnNumber };
}
