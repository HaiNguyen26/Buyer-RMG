import { Prisma } from '@prisma/client';
import { lineRemainingQty, poItemLabel, toPoNum } from './poLineConfirmation';

export type GrnHistoryDisplayStatus = 'FULL' | 'PARTIAL' | 'PENDING_QC' | 'CANCELLED';

export type GrnTimelineEvent = {
  title: string;
  desc: string;
  date: string;
  done: boolean;
};

export type PoItemSnap = {
  id: string;
  lineNo: number;
  qty: Prisma.Decimal;
  confirmedQty: Prisma.Decimal | null;
  lineStatus?: string;
  description: string;
  purchaseRequestItem: { partNo: string | null; description: string | null };
};

/** Kho không còn chờ nhận thêm trên PO (đủ hàng hoặc buyer đã hủy phần còn lại → CLOSED). */
export function isPoWarehouseReceiptSettled(poHeaderStatus: string): boolean {
  const s = String(poHeaderStatus ?? '').toUpperCase();
  return s === 'FULLY_RECEIVED' || s === 'CLOSED';
}

import { formatGrnHistoryDateTime, formatTimelineStamp } from './grnReceiveDate';

export { formatGrnHistoryDateTime, formatTimelineStamp };

/** Trạng thái hiển thị một phiếu GRN theo dòng nhận lần này vs còn lại trước phiếu. */
export function computeGrnDisplayStatus(
  note: string | null | undefined,
  lines: { poItemId: string; qtyReceived: Prisma.Decimal }[],
  poItems: Map<string, PoItemSnap>,
  receivedBeforeByItem: Map<string, number>
): GrnHistoryDisplayStatus {
  const noteUp = (note ?? '').trim().toUpperCase();
  if (noteUp.includes('CANCEL') || noteUp.includes('HỦY') || noteUp.includes('HUY')) {
    return 'CANCELLED';
  }
  if (noteUp.includes('QC') || noteUp.includes('KIỂM TRA') || noteUp.includes('KIEM TRA')) {
    return 'PENDING_QC';
  }

  if (!lines.length) return 'CANCELLED';

  let allFull = true;
  let anyPositive = false;

  for (const line of lines) {
    const qty = toPoNum(line.qtyReceived);
    if (qty <= 0) continue;
    anyPositive = true;
    const it = poItems.get(line.poItemId);
    if (!it) {
      allFull = false;
      continue;
    }
    const before = receivedBeforeByItem.get(line.poItemId) ?? 0;
    const remaining =
      String(it.lineStatus ?? '') === 'CANCELLED'
        ? 0
        : lineRemainingQty(it.confirmedQty, it.qty, before);
    if (qty < remaining - 1e-9) allFull = false;
  }

  if (!anyPositive) return 'CANCELLED';
  return allFull ? 'FULL' : 'PARTIAL';
}

/** Badge lịch sử GRN — nếu PO đã kết thúc nhận kho (CLOSED / FULLY_RECEIVED) thì phiếu cũ hiển thị FULL. */
export function resolveGrnListDisplayStatus(
  receiptStatus: GrnHistoryDisplayStatus,
  poHeaderStatus: string
): GrnHistoryDisplayStatus {
  if (receiptStatus === 'CANCELLED' || receiptStatus === 'PENDING_QC') {
    return receiptStatus;
  }
  if (isPoWarehouseReceiptSettled(poHeaderStatus)) return 'FULL';
  return receiptStatus;
}

export function resolveGrnDisplayStatusForPo(
  note: string | null | undefined,
  lines: { poItemId: string; qtyReceived: Prisma.Decimal }[],
  poItems: Map<string, PoItemSnap>,
  receivedBeforeByItem: Map<string, number>,
  poHeaderStatus: string
): GrnHistoryDisplayStatus {
  const receipt = computeGrnDisplayStatus(note, lines, poItems, receivedBeforeByItem);
  return resolveGrnListDisplayStatus(receipt, poHeaderStatus);
}

export function buildGrnTimeline(input: {
  po: {
    poNumber: string;
    issuedAt: Date | null;
    supplierConfirmedAt: Date | null;
    status: string;
  };
  grn: { receivedAt: Date; note: string | null };
  receiverDisplay: string;
  displayStatus: GrnHistoryDisplayStatus;
}): GrnTimelineEvent[] {
  const { po, grn, receiverDisplay, displayStatus } = input;
  const events: GrnTimelineEvent[] = [];

  if (po.issuedAt) {
    events.push({
      title: 'PO đã gửi',
      desc: `PO ${po.poNumber} — phát hành cho NCC`,
      date: formatTimelineStamp(po.issuedAt),
      done: true,
    });
  }

  if (po.supplierConfirmedAt) {
    events.push({
      title: 'NCC xác nhận',
      desc: 'Buyer ghi nhận xác nhận nhà cung cấp',
      date: formatTimelineStamp(po.supplierConfirmedAt),
      done: true,
    });
  }

  events.push({
    title: 'Incoming',
    desc: 'PO trong luồng chờ nhận / đang giao',
    date: po.supplierConfirmedAt
      ? formatTimelineStamp(po.supplierConfirmedAt)
      : po.issuedAt
        ? formatTimelineStamp(po.issuedAt)
        : '—',
    done: true,
  });

  const receiveTitle =
    displayStatus === 'FULL'
      ? 'Đã nhận kho (FULL)'
      : displayStatus === 'PARTIAL'
        ? 'Nhận một phần (PARTIAL)'
        : displayStatus === 'PENDING_QC'
          ? 'Đang kiểm tra chất lượng'
          : 'Phiếu nhập đã hủy';

  events.push({
    title: receiveTitle,
    desc:
      grn.note?.trim() ||
      `Ghi nhận bởi ${receiverDisplay} · trạng thái PO ${po.status}`,
    date: formatTimelineStamp(grn.receivedAt),
    done: displayStatus !== 'PENDING_QC',
  });

  return events;
}

export function grnItemLabel(it: PoItemSnap): string {
  return poItemLabel(
    it.purchaseRequestItem.partNo,
    it.purchaseRequestItem.description ?? it.description,
    it.lineNo
  );
}
