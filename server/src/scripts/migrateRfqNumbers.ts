/**
 * Đổi toàn bộ mã RFQ cũ (RFQ-PR-… / RFQ-YYYY-…) sang dạng gọn: SITE-DEPT-YYYYMM-NNN
 *
 *   npm run migrate-rfq-numbers -- --dry-run
 *   npm run migrate-rfq-numbers -- --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import {
  formatRfqNumber,
  isCompactRfqNumber,
  resolveRfqNumberParts,
  rfqBucketKey,
  type RfqNumberParts,
} from '../utils/rfqNumber';
import { rfqSiteDeptMonthSequenceKey } from '../utils/documentSequence';

type PlanRow = {
  id: string;
  oldNumber: string;
  newNumber: string;
  parts: RfqNumberParts;
};

function buildRenumberPlan(
  rows: Array<{
    id: string;
    rfqNumber: string;
    createdAt: Date;
    prNumber: string;
    department: string | null;
    location: string | null;
  }>
): PlanRow[] {
  const buckets = new Map<string, typeof rows>();

  for (const row of rows) {
    const parts = resolveRfqNumberParts(row.prNumber, {
      department: row.department,
      location: row.location,
    });
    const key = rfqBucketKey(parts);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const plan: PlanRow[] = [];

  for (const [, list] of buckets) {
    const sorted = [...list].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
    );
    const parts = resolveRfqNumberParts(sorted[0].prNumber, {
      department: sorted[0].department,
      location: sorted[0].location,
    });
    sorted.forEach((row, idx) => {
      plan.push({
        id: row.id,
        oldNumber: row.rfqNumber,
        newNumber: formatRfqNumber(parts, idx + 1),
        parts,
      });
    });
  }

  return plan;
}

async function syncDocumentSequences(plan: PlanRow[]): Promise<void> {
  const maxByKey = new Map<string, number>();
  for (const row of plan) {
    const key = rfqSiteDeptMonthSequenceKey(row.parts.site, row.parts.dept, row.parts.yyyymm);
    const m = row.newNumber.match(/-(\d{3})$/);
    const seq = m ? parseInt(m[1], 10) : 0;
    maxByKey.set(key, Math.max(maxByKey.get(key) ?? 0, seq));
  }

  for (const [sequenceKey, counter] of maxByKey) {
    await prisma.documentSequence.upsert({
      where: { sequenceKey },
      create: { sequenceKey, counter },
      update: { counter },
    });
  }

  const legacy = await prisma.documentSequence.findMany({
    where: {
      OR: [
        { sequenceKey: { startsWith: 'RFQ:PR:' } },
        { sequenceKey: { startsWith: 'RFQ:GLOBAL:' } },
      ],
    },
    select: { sequenceKey: true },
  });
  if (legacy.length > 0) {
    await prisma.documentSequence.deleteMany({
      where: { sequenceKey: { in: legacy.map((r) => r.sequenceKey) } },
    });
    console.log(`   ✅ Đã xóa ${legacy.length} sequence key RFQ cũ.`);
  }
}

async function patchNotifications(numberMap: Map<string, string>): Promise<number> {
  const rfqNotifs = await prisma.notification.findMany({
    where: {
      deletedAt: null,
      OR: [
        { type: 'RFQ_SUBMITTED' },
        { type: 'RFQ_REQUIRED' },
        { message: { contains: 'RFQ' } },
      ],
    },
    select: { id: true, message: true, metadata: true },
  });

  let updated = 0;
  for (const n of rfqNotifs) {
    let message = n.message;
    let meta = n.metadata;
    let changed = false;

    for (const [oldN, newN] of numberMap) {
      if (message.includes(oldN)) {
        message = message.split(oldN).join(newN);
        changed = true;
      }
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        const rec = meta as Record<string, unknown>;
        if (rec.rfqNumber === oldN) {
          meta = { ...rec, rfqNumber: newN };
          changed = true;
        }
      }
    }

    if (changed) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { message, metadata: meta as object },
      });
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.argv.includes('--confirm');

  if (!dryRun && !confirm) {
    console.error('\n❌ Chạy với --dry-run (xem trước) hoặc --confirm (áp dụng):\n');
    console.error('   npm run migrate-rfq-numbers -- --dry-run');
    console.error('   npm run migrate-rfq-numbers -- --confirm\n');
    process.exit(1);
  }

  const rfqs = await prisma.rFQ.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      rfqNumber: true,
      createdAt: true,
      purchaseRequest: {
        select: { prNumber: true, department: true, location: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows = rfqs
    .filter((r) => !String(r.rfqNumber).toUpperCase().startsWith('MOCK-'))
    .map((r) => ({
      id: r.id,
      rfqNumber: r.rfqNumber,
      createdAt: r.createdAt,
      prNumber: r.purchaseRequest.prNumber,
      department: r.purchaseRequest.department,
      location: r.purchaseRequest.location,
    }));

  const plan = buildRenumberPlan(rows);
  const toChange = plan.filter((p) => p.oldNumber !== p.newNumber);
  const alreadyCompact = plan.filter((p) => isCompactRfqNumber(p.oldNumber) && p.oldNumber === p.newNumber);

  console.log('\n📋 ========== MIGRATE MÃ RFQ ==========');
  console.log(`   Tổng RFQ: ${plan.length}`);
  console.log(`   Cần đổi: ${toChange.length}`);
  console.log(`   Đã đúng format (giữ số): ${alreadyCompact.length}\n`);

  if (toChange.length > 0) {
    console.log('   Ví dụ đổi mã:');
    for (const row of toChange.slice(0, 15)) {
      console.log(`   • ${row.oldNumber}  →  ${row.newNumber}`);
    }
    if (toChange.length > 15) console.log(`   … và ${toChange.length - 15} RFQ khác\n`);
  }

  const newNumbers = plan.map((p) => p.newNumber);
  const dupNew = newNumbers.filter((n, i) => newNumbers.indexOf(n) !== i);
  if (dupNew.length > 0) {
    console.error('❌ Trùng mã mới:', [...new Set(dupNew)].join(', '));
    process.exit(1);
  }

  if (dryRun) {
    console.log('ℹ️  Dry-run — không ghi DB.\n');
    return;
  }

  const numberMap = new Map(toChange.map((p) => [p.oldNumber, p.newNumber]));

  await prisma.$transaction(
    async (tx) => {
      for (const row of toChange) {
        await tx.rFQ.update({
          where: { id: row.id },
          data: { rfqNumber: `__MIG__${row.id}` },
        });
      }
      for (const row of toChange) {
        await tx.rFQ.update({
          where: { id: row.id },
          data: { rfqNumber: row.newNumber },
        });
      }
    },
    { timeout: 120000 }
  );

  console.log(`✅ Đã cập nhật ${toChange.length} mã RFQ.`);

  await syncDocumentSequences(plan);
  console.log('✅ Đã đồng bộ document_sequences.');

  const notifN = await patchNotifications(numberMap);
  console.log(`✅ Đã cập nhật ${notifN} thông báo (message/metadata).\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
