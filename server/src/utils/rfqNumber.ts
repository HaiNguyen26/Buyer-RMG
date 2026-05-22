/**
 * Mã RFQ gọn: {SITE}-{DEPT}-{YYYYMM}-{seq}
 * Ví dụ: HCM-IT-202605-001 (từ PR HCM-IT-20260521-0001)
 */
import type { Prisma } from '@prisma/client';
import {
  allocateNextCounter,
  rfqSiteDeptMonthSequenceKey,
  scanMaxRfqSiteDeptMonthSuffix,
} from './documentSequence';

export type RfqNumberParts = {
  site: string;
  dept: string;
  yyyymm: string;
};

const normalizeToken = (raw: string, maxLen = 12) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, maxLen) || 'GEN';

/** Parse PR dạng SITE-DEPT-YYYYMMDD-SEQ */
export function parsePrNumberForRfq(prNumber: string): RfqNumberParts | null {
  const parts = prNumber.trim().split('-').filter(Boolean);
  if (parts.length < 4) return null;
  const seqPart = parts[parts.length - 1];
  const datePart = parts[parts.length - 2];
  if (!/^\d{4,8}$/.test(seqPart) || !/^\d{8}$/.test(datePart)) return null;
  const dept = parts[parts.length - 3];
  const site = parts.slice(0, parts.length - 3).join('-');
  if (!site || !dept) return null;
  return {
    site: normalizeToken(site, 8),
    dept: normalizeToken(dept, 12),
    yyyymm: datePart.slice(0, 6),
  };
}

export function resolveRfqNumberParts(
  prNumber: string,
  opts?: { department?: string | null; location?: string | null }
): RfqNumberParts {
  const parsed = parsePrNumberForRfq(prNumber);
  if (parsed) return parsed;

  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const site = normalizeToken(String(opts?.location ?? 'HCM'), 8);
  const dept = normalizeToken(String(opts?.department ?? 'GEN'), 12);
  return { site, dept, yyyymm };
}

export function formatRfqNumber(parts: RfqNumberParts, seq: number): string {
  return `${parts.site}-${parts.dept}-${parts.yyyymm}-${String(seq).padStart(3, '0')}`;
}

/** Mã RFQ gọn: HCM-IT-202605-001 */
export function isCompactRfqNumber(rfqNumber: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]*-[A-Z0-9][A-Z0-9_-]*-\d{6}-\d{3}$/i.test(rfqNumber.trim());
}

export function rfqBucketKey(parts: RfqNumberParts): string {
  return `${parts.site}:${parts.dept}:${parts.yyyymm}`;
}

/** Cấp số RFQ trong transaction (không trùng theo site + dept + tháng). */
export async function allocateNextRfqNumber(
  tx: Prisma.TransactionClient,
  prNumber: string,
  opts?: { department?: string | null; location?: string | null }
): Promise<string> {
  const parts = resolveRfqNumberParts(prNumber, opts);
  const seqKey = rfqSiteDeptMonthSequenceKey(parts.site, parts.dept, parts.yyyymm);
  const seq = await allocateNextCounter(tx, seqKey, () =>
    scanMaxRfqSiteDeptMonthSuffix(tx, parts.site, parts.dept, parts.yyyymm)
  );
  return formatRfqNumber(parts, seq);
}
