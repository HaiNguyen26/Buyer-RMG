/**
 * Đồng bộ trạng thái PR đã phân công cho Buyer (dữ liệu cũ trước khi sửa createRFQ / danh sách).
 *
 * Chạy xem trước:  npx tsx src/scripts/syncBuyerAssignedPrStatus.ts
 * Áp dụng:         npx tsx src/scripts/syncBuyerAssignedPrStatus.ts --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { BUYER_VISIBLE_PR_STATUSES } from '../constants/buyerAssignedPrStatuses';
import { itemDepartmentOutcomeAllowsProcurement } from '../utils/departmentPrItemReview';
import { computePRStatusFromItemStatuses } from '../utils/prStatusFromItems';

const TERMINAL_PR = new Set([
  'CLOSED',
  'CANCELLED',
  'PAYMENT_DONE',
  'BUDGET_EXCEPTION',
  'BUDGET_REJECTED',
]);

const OPEN_RFQ_STATUSES = new Set(['DRAFT', 'SENT', 'QUOTATION_RECEIVED']);

const ITEM_ACTIVE_RFQ = new Set(['RFQ_CREATED', 'RFQ_SUBMITTED', 'READY_FOR_REVIEW']);

function itemStatusesForAggregate(
  items: Array<{ status: string; departmentItemOutcome: string | null }>
): string[] {
  return items
    .filter((i) => itemDepartmentOutcomeAllowsProcurement(i.departmentItemOutcome))
    .map((i) => i.status);
}

function buyerHasOpenRfq(rfqs: Array<{ status: string }>): boolean {
  return rfqs.some((r) => OPEN_RFQ_STATUSES.has(String(r.status)));
}

function itemsHaveActiveRfqWork(statuses: string[]): boolean {
  return statuses.some((s) => ITEM_ACTIVE_RFQ.has(s));
}

function resolveTargetPrStatus(
  current: string,
  itemStatuses: string[],
  openBuyerRfq: boolean
): string | null {
  const aggregated = computePRStatusFromItemStatuses(itemStatuses);

  if (openBuyerRfq || itemsHaveActiveRfqWork(itemStatuses)) {
    if (
      !aggregated ||
      aggregated === 'RFQ_COMPLETED' ||
      aggregated === 'SUPPLIER_SELECTED' ||
      current === 'RFQ_COMPLETED'
    ) {
      if (itemStatuses.some((s) => s === 'READY_FOR_REVIEW' || s === 'RFQ_SUBMITTED')) {
        return 'QUOTATION_RECEIVED';
      }
      return 'RFQ_IN_PROGRESS';
    }
    return aggregated;
  }

  return aggregated;
}

async function main() {
  const confirm = process.argv.includes('--confirm');

  const assignments = await prisma.pRAssignment.findMany({
    where: { deletedAt: null, purchaseRequest: { deletedAt: null } },
    select: {
      buyerId: true,
      purchaseRequestId: true,
      purchaseRequest: {
        select: {
          id: true,
          prNumber: true,
          status: true,
          items: {
            where: { deletedAt: null },
            select: { status: true, departmentItemOutcome: true },
          },
          rfqs: {
            where: { deletedAt: null },
            select: { id: true, status: true, buyerId: true },
          },
        },
      },
    },
  });

  const byPr = new Map<
    string,
    {
      pr: (typeof assignments)[0]['purchaseRequest'];
      buyerIds: Set<string>;
    }
  >();

  for (const a of assignments) {
    const pr = a.purchaseRequest;
    if (!pr || TERMINAL_PR.has(pr.status)) continue;
    const row = byPr.get(pr.id) ?? { pr, buyerIds: new Set<string>() };
    row.buyerIds.add(a.buyerId);
    byPr.set(pr.id, row);
  }

  const changes: Array<{ prNumber: string; from: string; to: string; reason: string }> = [];
  const alreadyVisible: string[] = [];
  const hiddenNoFix: string[] = [];

  for (const { pr, buyerIds } of byPr.values()) {
    const itemStatuses = itemStatusesForAggregate(pr.items as any);
    const buyerRfqs = pr.rfqs.filter((r) => buyerIds.has(r.buyerId));
    const openRfq = buyerHasOpenRfq(buyerRfqs);
    const target = resolveTargetPrStatus(pr.status, itemStatuses, openRfq);

    const visible = (BUYER_VISIBLE_PR_STATUSES as readonly string[]).includes(pr.status);

    if (!target || target === pr.status) {
      if (visible) alreadyVisible.push(pr.prNumber);
      else if (!TERMINAL_PR.has(pr.status)) {
        hiddenNoFix.push(`${pr.prNumber} (${pr.status}) — không đủ tín hiệu item/RFQ để đổi`);
      }
      continue;
    }

    const reason = openRfq
      ? 'RFQ buyer còn mở (DRAFT/…) hoặc dòng RFQ_*'
      : 'Tổng hợp lại từ trạng thái item';
    changes.push({ prNumber: pr.prNumber, from: pr.status, to: target, reason });

    if (confirm) {
      await prisma.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: target as any },
      });
    }
  }

  console.log(`\n=== syncBuyerAssignedPrStatus ${confirm ? '(APPLIED)' : '(dry-run)'} ===\n`);
  console.log(`PR có phân công buyer (không terminal): ${byPr.size}`);
  console.log(`Đã hiển thị OK (không đổi status): ${alreadyVisible.length}`);
  if (alreadyVisible.length > 0 && alreadyVisible.length <= 15) {
    console.log(`  → ${alreadyVisible.join(', ')}`);
  } else if (alreadyVisible.length > 15) {
    console.log(`  → ${alreadyVisible.slice(0, 10).join(', ')} … (+${alreadyVisible.length - 10})`);
  }

  if (changes.length === 0) {
    console.log('\nKhông có PR nào cần chỉnh status trong DB.');
  } else {
    console.log(`\nSẽ cập nhật ${changes.length} PR:\n`);
    for (const c of changes) {
      console.log(`  ${c.prNumber}: ${c.from} → ${c.to}  (${c.reason})`);
    }
    if (!confirm) {
      console.log('\nChạy lại với --confirm để ghi DB.');
    } else {
      console.log('\nĐã cập nhật xong. Buyer refresh trang PR được phân công.');
    }
  }

  if (hiddenNoFix.length > 0) {
    console.log(`\nCảnh báo — vẫn có thể không hiện trên Buyer (cần xem tay): ${hiddenNoFix.length}`);
    hiddenNoFix.slice(0, 8).forEach((line) => console.log(`  ${line}`));
  }

  console.log(
    '\nLưu ý: PR cũ ở RFQ_COMPLETED / PO_PENDING đã được API hiển thị lại sau bản sửa — không bắt buộc chạy script.\n' +
      'Script này chỉ sửa PR kẹt status sai (vd RFQ_COMPLETED nhưng còn RFQ DRAFT).\n'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
