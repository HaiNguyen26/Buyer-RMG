/**
 * npx tsx src/scripts/diagnoseRfqAward.ts HCM-IT-202605-001
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import {
  isRfqAwardCompleteFromCounts,
  prHasActivePurchaseOrder,
} from '../utils/rfqAwardComplete';

const rfqNumber = process.argv[2] || 'HCM-IT-202605-001';

function parseRfqItemIds(notes: string | null): string[] {
  if (!notes) return [];
  const match = notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed?.itemIds) ? (parsed.itemIds as string[]) : [];
  } catch {
    return [];
  }
}

async function main() {
  const rfq = await prisma.rFQ.findFirst({
    where: { rfqNumber, deletedAt: null },
    include: {
      purchaseRequest: {
        include: {
          items: { where: { deletedAt: null } },
          purchaseOrders: { where: { deletedAt: null }, select: { poNumber: true, status: true } },
          supplierSelections: true,
        },
      },
    },
  });
  if (!rfq) {
    console.log('RFQ not found:', rfqNumber);
    return;
  }
  const itemIds = parseRfqItemIds(rfq.notes);
  const selectedCount = rfq.purchaseRequest.supplierSelections.filter((s) =>
    itemIds.includes(s.purchaseRequestItemId)
  ).length;

  const settledItemCount = rfq.purchaseRequest.items.filter(
    (i) =>
      itemIds.includes(i.id) &&
      (String(i.status) === 'FULFILLED' ||
        (String(i.status) === 'SUPPLIER_SELECTED' && Number(i.purchaseQty) <= 0))
  ).length;
  const hasNonDraftPo = prHasActivePurchaseOrder(rfq.purchaseRequest.purchaseOrders);
  const awardComplete = isRfqAwardCompleteFromCounts({
    rfqStatus: String(rfq.status),
    prStatus: String(rfq.purchaseRequest.status),
    itemIds,
    selectedCount,
    hasNonDraftPo,
    settledItemCount,
  });

  console.log(
    JSON.stringify(
      {
        rfqNumber: rfq.rfqNumber,
        rfqStatus: rfq.status,
        prNumber: rfq.purchaseRequest.prNumber,
        prStatus: rfq.purchaseRequest.status,
        rfqItemIds: itemIds,
        selectedCount,
        awardComplete,
        hasNonDraftPo,
        settledItemCount,
        pos: rfq.purchaseRequest.purchaseOrders,
        items: rfq.purchaseRequest.items.map((i) => ({
          line: i.lineNo,
          status: i.status,
          purchaseQty: Number(i.purchaseQty),
        })),
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
