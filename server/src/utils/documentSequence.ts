/**
 * Cấp số chứng từ tuần tự, không trùng (PostgreSQL + pg_advisory_xact_lock trong transaction).
 */
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export async function lockSequenceKey(tx: Prisma.TransactionClient, sequenceKey: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sequenceKey}::text))`;
}

/** Bảng document_sequences chưa migrate / client Prisma chưa generate — vẫn cho phép preview & cấp số (đã có advisory lock trong transaction). */
function isDocumentSequenceUnavailable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021' || e.code === 'P2022') return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/document_sequences/i.test(msg)) return true;
  if (/documentSequence/i.test(msg) && /Unknown|does not exist|not exist/i.test(msg)) return true;
  if (/Cannot read propert/i.test(msg) && /findUnique/i.test(msg)) return true;
  return false;
}

/** Preview số: mọi lỗi khi đọc bảng sequence → coi như chưa migrate, không làm 500. */
function shouldPeekFallbackAny(e: unknown): boolean {
  return isDocumentSequenceUnavailable(e) || e instanceof TypeError;
}

/**
 * Trả về số thứ tự tiếp theo (đã tăng counter), trong transaction.
 * counter = số đã cấp lần cuối; lần đầu đồng bộ với scanMax (dữ liệu cũ trước khi có bảng sequence).
 */
export async function allocateNextCounter(
  tx: Prisma.TransactionClient,
  sequenceKey: string,
  scanMaxFromDb: () => Promise<number>
): Promise<number> {
  await lockSequenceKey(tx, sequenceKey);
  try {
    let row = await tx.documentSequence.findUnique({ where: { sequenceKey } });
    if (!row) {
      const initialMax = await scanMaxFromDb();
      row = await tx.documentSequence.create({
        data: { sequenceKey, counter: initialMax },
      });
    }
    const next = row.counter + 1;
    await tx.documentSequence.update({
      where: { sequenceKey },
      data: { counter: next },
    });
    return next;
  } catch (e) {
    if (isDocumentSequenceUnavailable(e) || e instanceof TypeError) {
      console.warn(
        '[documentSequence] allocateNextCounter: thiếu bảng sequence hoặc client lỗi — dùng scanMax+1. Chạy: npx prisma migrate deploy && npx prisma generate',
        e instanceof Error ? e.message : e
      );
      const initialMax = await scanMaxFromDb();
      return initialMax + 1;
    }
    throw e;
  }
}

/** Xem trước số tiếp theo (không tăng counter) — dùng cho API getNext* */
export async function peekNextCounter(
  prisma: PrismaClient,
  sequenceKey: string,
  scanMaxFromDb: () => Promise<number>
): Promise<number> {
  try {
    const row = await prisma.documentSequence.findUnique({ where: { sequenceKey } });
    if (row) return row.counter + 1;
  } catch (e) {
    if (shouldPeekFallbackAny(e)) {
      console.warn(
        '[documentSequence] peekNextCounter: không đọc được document_sequences — dùng scanMax+1. Chạy: npx prisma migrate deploy && npx prisma generate',
        e instanceof Error ? e.message : e
      );
    } else {
      throw e;
    }
  }
  const initialMax = await scanMaxFromDb();
  return initialMax + 1;
}

// --- Scan max từ bảng nghiệp vụ (khi chưa có dòng sequence hoặc đồng bộ lần đầu) ---

export async function scanMaxPRSeq(
  db: DbClient,
  dept: string,
  yyyymmdd: string,
  siteCode?: string
): Promise<number> {
  const safeSite = siteCode?.trim().toUpperCase();
  const prefix = safeSite ? `${safeSite}-${dept}-${yyyymmdd}-` : `${dept}-${yyyymmdd}-`;
  const rows = await db.purchaseRequest.findMany({
    where: { prNumber: { startsWith: prefix }, deletedAt: null },
    select: { prNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.prNumber.match(/-(\d{4})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxSalesPOSuffix(db: DbClient, year: number): Promise<number> {
  const prefix = `SO-${year}-`;
  const rows = await db.salesPO.findMany({
    where: { salesPONumber: { startsWith: prefix } },
    select: { salesPONumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.salesPONumber.match(/-(\d{3})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxRFQPRBuyerSuffix(db: DbClient, prPrefix: string, buyerTag: string): Promise<number> {
  const prefix = `RFQ-PR-${prPrefix}-${buyerTag}-`;
  const rows = await db.rFQ.findMany({
    where: { rfqNumber: { startsWith: prefix } },
    select: { rfqNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.rfqNumber.match(/-(\d{3})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxRFQGlobalYearSuffix(db: DbClient, year: number): Promise<number> {
  const prefix = `RFQ-${year}-`;
  const rows = await db.rFQ.findMany({
    where: { rfqNumber: { startsWith: prefix } },
    select: { rfqNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.rfqNumber.match(/-(\d{4})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxStockIssueDaySuffix(db: DbClient, yyyymmdd: string): Promise<number> {
  const prefix = `PX-${yyyymmdd}-`;
  const rows = await db.stockIssue.findMany({
    where: { issueNumber: { startsWith: prefix }, deletedAt: null },
    select: { issueNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.issueNumber.match(/-(\d{4})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxPODraftYearSuffix(db: DbClient, year: number): Promise<number> {
  const prefix = `PO-DRAFT-${year}-`;
  const rows = await db.purchaseOrder.findMany({
    where: { poNumber: { startsWith: prefix }, deletedAt: null },
    select: { poNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.poNumber.match(/-(\d{3})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function scanMaxGrnYearSuffix(db: DbClient, year: number): Promise<number> {
  const prefix = `GRN-${year}-`;
  const rows = await db.goodsReceipt.findMany({
    where: { grnNumber: { startsWith: prefix } },
    select: { grnNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.grnNumber.match(/-(\d{5})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export function prSequenceKey(dept: string, yyyymmdd: string, siteCode?: string): string {
  const safeSite = siteCode?.trim().toUpperCase();
  return safeSite ? `PR:${safeSite}:${dept}:${yyyymmdd}` : `PR:${dept}:${yyyymmdd}`;
}

export function soSequenceKey(year: number): string {
  return `SO:${year}`;
}

export function rfqPrBuyerSequenceKey(prPrefix: string, buyerTag: string): string {
  return `RFQ:PR:${prPrefix}:${buyerTag}`;
}

export function rfqGlobalYearSequenceKey(year: number): string {
  return `RFQ:GLOBAL:${year}`;
}

export function stockIssueSequenceKey(yyyymmdd: string): string {
  return `PX:${yyyymmdd}`;
}

export function poDraftSequenceKey(year: number): string {
  return `PO-DRAFT:${year}`;
}

export function grnSequenceKey(year: number): string {
  return `GRN:${year}`;
}
