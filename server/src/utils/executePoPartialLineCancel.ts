import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { computePRStatusFromItemStatuses } from './prStatusFromItems';
import { parsePoItemIdsJson } from './procurementItemGates';
import {
  buildLineCancelApprovalRows,
  isPoLifecycleComplete,
  lineStatusAfterCancelApproval,
  resolveOperationalPoStatusAfterLineCancel,
  type PoLineCancelSnapshot,
} from './poPartialLineCancel';

export type ExecutePoPartialLineCancelResult = {
  cancelledLineCount: number;
  fulfilledLineCount: number;
  poNextStatus: string;
  poRemainsActive: boolean;
};

async function sumReceivedByPoItemIds(
  poItemIds: string[]
): Promise<Map<string, number>> {
  if (poItemIds.length === 0) return new Map();
  const rows = await prisma.goodsReceiptLine.groupBy({
    by: ['poItemId'],
    where: { poItemId: { in: poItemIds } },
    _sum: { qtyReceived: true },
  });
  return new Map(rows.map((row) => [row.poItemId, Number(row._sum.qtyReceived || 0)]));
}

/**
 * Hủy phần còn lại của các dòng PO (đã nhận kho một phần) — áp dụng ngay, không chờ duyệt.
 */
export async function executePoPartialLineCancel(params: {
  purchaseOrderId: string;
  cancelPoItemIds: string[];
  lineCancelReason: string;
  actorUserId?: string | null;
}): Promise<ExecutePoPartialLineCancelResult> {
  const { purchaseOrderId, cancelPoItemIds, lineCancelReason, actorUserId } = params;
  const reason = lineCancelReason.trim();
  if (!reason) {
    throw new Error('Lý do hủy dòng PO là bắt buộc');
  }
  if (!cancelPoItemIds.length) {
    throw new Error('Chưa chọn dòng PO để hủy');
  }

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, deletedAt: null },
    include: { purchaseRequest: true },
  });
  if (!po) {
    throw new Error('PO not found');
  }

  const poItems = await prisma.pOItem.findMany({
    where: { purchaseOrderId: po.id },
    select: {
      id: true,
      purchaseRequestItemId: true,
      qty: true,
      confirmedQty: true,
      lineStatus: true,
    },
  });

  const receivedMap = await sumReceivedByPoItemIds(poItems.map((it) => it.id));

  const { cancelLines, fulfilledNotCancelled, invalidCancelIds } = buildLineCancelApprovalRows(
    poItems.map((it) => ({
      id: it.id,
      purchaseRequestItemId: it.purchaseRequestItemId,
      qty: it.qty,
      confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
    })),
    receivedMap,
    cancelPoItemIds
  );

  if (invalidCancelIds.length > 0) {
    throw new Error('Danh sách dòng hủy không hợp lệ hoặc không thuộc PO này.');
  }
  if (cancelLines.length === 0) {
    throw new Error(
      'Không có dòng nào còn phần chưa nhận kho trong yêu cầu hủy. Chỉ hủy được phần còn lại của dòng đã chọn.'
    );
  }

  const poHeaderBefore = po as { supplierConfirmedAt?: Date | null };

  await prisma.$transaction(async (tx) => {
    if (fulfilledNotCancelled.length > 0) {
      await Promise.all(
        fulfilledNotCancelled.map((f) =>
          tx.purchaseRequestItem.update({
            where: { id: f.purchaseRequestItemId },
            data: {
              status: 'FULFILLED' as any,
              purchaseQty: new Prisma.Decimal(0),
            },
          })
        )
      );
      await tx.pOItem.updateMany({
        where: { id: { in: fulfilledNotCancelled.map((f) => f.id) } },
        data: { lineStatus: 'FULLY_RECEIVED' } as any,
      });
      await tx.supplierSelection.deleteMany({
        where: {
          purchaseRequestId: po.purchaseRequestId,
          purchaseRequestItemId: {
            in: fulfilledNotCancelled.map((f) => f.purchaseRequestItemId),
          },
        },
      });
    }

    const reopenPrItemIds = cancelLines.map((c) => c.purchaseRequestItemId);
    await Promise.all(
      cancelLines.map((c) =>
        tx.purchaseRequestItem.update({
          where: { id: c.purchaseRequestItemId },
          data: {
            purchaseQty: new Prisma.Decimal(c.remaining),
            status: 'ASSIGNED' as any,
          },
        })
      )
    );
    await Promise.all(
      cancelLines.map((c) =>
        tx.pOItem.update({
          where: { id: c.id },
          data: {
            lineStatus: 'CANCELLED',
            lineCancelReason: reason,
            cancelledRemainingQty: new Prisma.Decimal(c.remaining),
          } as any,
        })
      )
    );
    await tx.supplierSelection.deleteMany({
      where: {
        purchaseRequestId: po.purchaseRequestId,
        purchaseRequestItemId: { in: reopenPrItemIds },
      },
    });

    const cancelIdSet = new Set(cancelLines.map((c) => c.id));
    for (const it of poItems) {
      if (cancelIdSet.has(it.id)) continue;
      const received = receivedMap.get(it.id) ?? 0;
      const nextLineStatus = lineStatusAfterCancelApproval({
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: Number(it.qty),
        confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
        received,
        lineStatus: String((it as { lineStatus?: string }).lineStatus ?? 'OPEN'),
      });
      await tx.pOItem.update({
        where: { id: it.id },
        data: { lineStatus: nextLineStatus as any },
      });
    }

    const snapshots: PoLineCancelSnapshot[] = poItems.map((it) => {
      const received = receivedMap.get(it.id) ?? 0;
      const lineStatus = cancelIdSet.has(it.id)
        ? 'CANCELLED'
        : lineStatusAfterCancelApproval({
            id: it.id,
            purchaseRequestItemId: it.purchaseRequestItemId,
            qty: Number(it.qty),
            confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
            received,
            lineStatus: String((it as { lineStatus?: string }).lineStatus ?? 'OPEN'),
          });
      return {
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: Number(it.qty),
        confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
        received,
        lineStatus,
      };
    });

    const poNextStatus = resolveOperationalPoStatusAfterLineCancel(snapshots, {
      supplierConfirmedAt: poHeaderBefore.supplierConfirmedAt,
    });

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: poNextStatus as any,
        rejectReason: reason,
        cancelRequestedPoItemIds: null,
        ...(actorUserId
          ? { approvedAt: new Date(), approvedById: actorUserId }
          : {}),
      } as any,
    });

    const prItemStatuses = await tx.purchaseRequestItem.findMany({
      where: { purchaseRequestId: po.purchaseRequestId, deletedAt: null },
      select: { status: true },
    });
    const aggregatedStatus = computePRStatusFromItemStatuses(
      prItemStatuses.map((i) => String(i.status)) as Parameters<
        typeof computePRStatusFromItemStatuses
      >[0]
    );
    if (aggregatedStatus) {
      await tx.purchaseRequest.update({
        where: { id: po.purchaseRequestId },
        data: { status: aggregatedStatus as any },
      });
    }
  });

  const cancelledCount = cancelLines.length;
  const activeRemain = poItems.length - cancelledCount - fulfilledNotCancelled.length;
  const poRemainsActive =
    activeRemain > 0 ||
    !isPoLifecycleComplete(
      poItems.map((it) => ({
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: Number(it.qty),
        confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
        received: receivedMap.get(it.id) ?? 0,
        lineStatus: cancelLines.some((c) => c.id === it.id)
          ? 'CANCELLED'
          : String((it as { lineStatus?: string }).lineStatus ?? 'OPEN'),
      }))
    );

  return {
    cancelledLineCount: cancelledCount,
    fulfilledLineCount: fulfilledNotCancelled.length,
    poNextStatus: resolveOperationalPoStatusAfterLineCancel(
      poItems.map((it) => ({
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: Number(it.qty),
        confirmedQty: it.confirmedQty != null ? Number(it.confirmedQty) : null,
        received: receivedMap.get(it.id) ?? 0,
        lineStatus: cancelLines.some((c) => c.id === it.id)
          ? 'CANCELLED'
          : String((it as { lineStatus?: string }).lineStatus ?? 'OPEN'),
      })),
      { supplierConfirmedAt: poHeaderBefore.supplierConfirmedAt }
    ),
    poRemainsActive,
  };
}

/**
 * PO cũ còn `CANCEL_REQUESTED` + danh sách dòng + lý do → áp dụng hủy ngay (không chờ duyệt).
 */
export async function resolveLegacyCancelRequestedPo(
  purchaseOrderId: string,
  actorUserId?: string | null
): Promise<boolean> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, deletedAt: null },
    select: {
      id: true,
      status: true,
      rejectReason: true,
      cancelRequestedPoItemIds: true,
      createdById: true,
    },
  });
  if (!po || String(po.status) !== 'CANCEL_REQUESTED') return false;

  const cancelPoItemIds = parsePoItemIdsJson(po.cancelRequestedPoItemIds);
  const lineCancelReason = po.rejectReason?.trim() ?? '';
  if (!cancelPoItemIds?.length || !lineCancelReason) return false;

  await executePoPartialLineCancel({
    purchaseOrderId: po.id,
    cancelPoItemIds,
    lineCancelReason,
    actorUserId: actorUserId ?? po.createdById,
  });
  return true;
}

export type ResolveLegacyCancelRequestedBatchResult = {
  resolved: number;
  skipped: number;
  errors: string[];
  orphanIdsCleared: number;
};

/** Dọn mọi PO kẹt trạng thái chờ duyệt hủy (migration / khởi động). */
export async function resolveAllLegacyCancelRequestedPos(): Promise<ResolveLegacyCancelRequestedBatchResult> {
  const stale = await prisma.purchaseOrder.findMany({
    where: { deletedAt: null, status: 'CANCEL_REQUESTED' as any },
    select: { id: true, createdById: true, poNumber: true },
  });

  let resolved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of stale) {
    try {
      const ok = await resolveLegacyCancelRequestedPo(row.id, row.createdById);
      if (ok) resolved += 1;
      else skipped += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${row.poNumber}: ${msg}`);
    }
  }

  const cleared = await prisma.purchaseOrder.updateMany({
    where: {
      deletedAt: null,
      cancelRequestedPoItemIds: { not: null },
      status: { not: 'CANCEL_REQUESTED' as any },
    },
    data: { cancelRequestedPoItemIds: null },
  });

  return { resolved, skipped, errors, orphanIdsCleared: cleared.count };
}

export function formatPoPartialLineCancelMessage(result: ExecutePoPartialLineCancelResult): string {
  const { cancelledLineCount, poRemainsActive } = result;
  if (poRemainsActive) {
    return `Đã hủy ${cancelledLineCount} dòng PO. PO vẫn active — kho tiếp tục nhận các dòng còn lại. ${cancelledLineCount} item trả về hàng đợi Buyer (RFQ/PO mới, cùng PR).`;
  }
  return `Đã hủy ${cancelledLineCount} dòng. ${cancelledLineCount} item trả về hàng đợi Buyer để RFQ/PO mới (cùng PR).`;
}
