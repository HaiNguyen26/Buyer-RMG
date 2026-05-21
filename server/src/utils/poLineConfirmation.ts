import { Prisma } from '@prisma/client';

export type SupplierConfirmLineInput = {
  poItemId: string;
  confirmedQty: number;
  expectedDeliveryDate: string;
};

export type IncomingLineDisplayStatus =
  | 'AwaitingConfirm'
  | 'Incoming'
  | 'Delayed'
  | 'Partial'
  | 'Received';

export function toPoNum(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

export function parseIsoDateOnly(raw: string): Date | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayDateOnlyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseSupplierConfirmLines(
  raw: unknown
): { ok: true; lines: SupplierConfirmLineInput[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Thiếu body lines' };
  }
  const arr = (raw as { lines?: unknown }).lines;
  if (!Array.isArray(arr) || arr.length === 0) {
    return { ok: false, error: 'Cần ít nhất một dòng xác nhận' };
  }
  const lines: SupplierConfirmLineInput[] = [];
  for (const row of arr) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'Dòng xác nhận không hợp lệ' };
    }
    const poItemId = String((row as { poItemId?: unknown }).poItemId ?? '').trim();
    const confirmedQty = Number((row as { confirmedQty?: unknown }).confirmedQty);
    const expectedDeliveryDate = String(
      (row as { expectedDeliveryDate?: unknown }).expectedDeliveryDate ?? ''
    ).trim();
    if (!poItemId) return { ok: false, error: 'Thiếu poItemId' };
    if (!Number.isFinite(confirmedQty) || confirmedQty < 0) {
      return { ok: false, error: `SL confirm không hợp lệ (dòng ${poItemId})` };
    }
    if (confirmedQty > 0) {
      if (!expectedDeliveryDate) {
        return { ok: false, error: `Thiếu ETA cho dòng có SL confirm > 0` };
      }
      if (!parseIsoDateOnly(expectedDeliveryDate)) {
        return { ok: false, error: `ETA không hợp lệ (YYYY-MM-DD)` };
      }
    }
    lines.push({ poItemId, confirmedQty, expectedDeliveryDate });
  }
  const anyPositive = lines.some((l) => l.confirmedQty > 0);
  if (!anyPositive) {
    return { ok: false, error: 'Cần ít nhất một dòng có SL confirm > 0' };
  }
  return { ok: true, lines };
}

export function lineReceiveCap(
  confirmedQty: Prisma.Decimal | number | null,
  orderedQty: Prisma.Decimal | number
): number {
  if (confirmedQty != null) {
    return typeof confirmedQty === 'number' ? confirmedQty : toPoNum(confirmedQty);
  }
  return typeof orderedQty === 'number' ? orderedQty : toPoNum(orderedQty);
}

export function lineRemainingQty(
  confirmedQty: Prisma.Decimal | number | null,
  orderedQty: Prisma.Decimal | number,
  receivedQty: number
): number {
  const cap = lineReceiveCap(confirmedQty, orderedQty);
  return Math.max(0, cap - receivedQty);
}

export function computeIncomingLineDisplayStatus(opts: {
  poHeaderStatus: string;
  confirmedQty: number | null;
  receivedQty: number;
  expectedDate: string | null;
  today?: string;
}): IncomingLineDisplayStatus {
  const today = opts.today ?? todayDateOnlyUtc();
  const cap = opts.confirmedQty;
  const remaining =
    cap != null ? Math.max(0, cap - opts.receivedQty) : Math.max(0, (cap ?? 0) - opts.receivedQty);

  if (
    (opts.poHeaderStatus === 'SENT' || opts.poHeaderStatus === 'ISSUED') &&
    cap == null
  ) {
    return 'AwaitingConfirm';
  }

  if (remaining <= 1e-9) return 'Received';
  if (opts.receivedQty > 1e-9) return 'Partial';
  if (opts.expectedDate && opts.expectedDate < today) return 'Delayed';
  return 'Incoming';
}

export function resolveLineStatusAfterReceive(
  confirmedQty: Prisma.Decimal | number | null,
  orderedQty: Prisma.Decimal | number,
  receivedQty: number,
  currentStatus: string
): 'OPEN' | 'CONFIRMED' | 'PARTIAL' | 'FULLY_RECEIVED' | 'CANCELLED' {
  if (currentStatus === 'CANCELLED') return 'CANCELLED';
  const cap = lineReceiveCap(confirmedQty, orderedQty);
  if (receivedQty + 1e-9 >= cap) return 'FULLY_RECEIVED';
  if (receivedQty > 1e-9) return 'PARTIAL';
  if (confirmedQty != null) return 'CONFIRMED';
  return 'OPEN';
}

export function poItemLabel(partNo: string | null | undefined, description: string, lineNo: number): string {
  return (partNo?.trim() || description || `Dòng ${lineNo}`).trim();
}
