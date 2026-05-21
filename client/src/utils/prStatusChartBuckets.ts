/**
 * Bucket PR status for stacked bar: draft (moi), in-flight (cho), done (hoanTat), rejected/cancel (huy).
 */
export type PrStatusStackBucket = 'moi' | 'cho' | 'hoanTat' | 'huy';

export function bucketPrStatusForStack(statusCode: string): PrStatusStackBucket {
  const s = String(statusCode || '');
  if (s === 'DRAFT') return 'moi';
  if (
    s === 'MANAGER_REJECTED' ||
    s === 'BRANCH_MANAGER_REJECTED' ||
    s === 'BUDGET_REJECTED' ||
    s === 'CANCELLED' ||
    s === 'DEPARTMENT_HEAD_REJECTED'
  ) {
    return 'huy';
  }
  if (s === 'CLOSED' || s === 'PAYMENT_DONE' || s === 'PO_ISSUED') {
    return 'hoanTat';
  }
  return 'cho';
}

export type StatusCountRow = { status?: string; statusCode?: string; count: number };

/** Single stacked column for compact layout. */
export function aggregatePrStatusStack(rows: StatusCountRow[]): {
  name: string;
  moi: number;
  cho: number;
  hoanTat: number;
  huy: number;
}[] {
  let moi = 0;
  let cho = 0;
  let hoanTat = 0;
  let huy = 0;
  for (const row of rows) {
    const code = row.statusCode ?? row.status ?? '';
    const n = row.count || 0;
    if (n <= 0) continue;
    const b = bucketPrStatusForStack(code);
    if (b === 'moi') moi += n;
    else if (b === 'cho') cho += n;
    else if (b === 'hoanTat') hoanTat += n;
    else huy += n;
  }
  return [{ name: 'Tất cả PR', moi, cho, hoanTat, huy }];
}
