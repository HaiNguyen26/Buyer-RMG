/**
 * Debug một PR trên tracking Requestor.
 * npx tsx src/scripts/diagnosePrTracking.ts HCM-IT-20260522-0001
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import {
  buildProcurementListSnapshot,
  buildBusinessTimeline,
  enrichProcurementCostInsight,
  deriveItemProcurementRow,
  mapRequestorTrackingPoLines,
  buildSelectedQuotationDeliveryByPrItem,
  isPreWarehouseReceiptPhase,
  isReadyForStockIssuePickup,
} from '../utils/requestorProcurementTracking';
import { computeProcurementCostInsight } from '../utils/requestorProcurementTracking';

const prNumber = process.argv[2] || 'HCM-IT-20260522-0001';

async function main() {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { prNumber, deletedAt: null },
    include: {
      items: { where: { deletedAt: null } },
      purchaseOrders: {
        where: { deletedAt: null },
        include: { items: true },
      },
      supplierSelections: {
        include: {
          quotation: {
            include: {
              items: { where: { deletedAt: null }, select: { purchaseRequestItemId: true, deliveryDate: true } },
            },
          },
        },
      },
    },
  });
  if (!pr) {
    console.log('PR not found:', prNumber);
    return;
  }

  const prStatus = String(pr.status);
  const poLines = mapRequestorTrackingPoLines(
    pr.purchaseOrders.map((po) => ({
      poNumber: po.poNumber,
      status: String(po.status),
      items: po.items.map((it) => ({
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: it.qty,
        confirmedQty: it.confirmedQty,
        expectedDeliveryDate: it.expectedDeliveryDate,
        lineStatus: String(it.lineStatus),
      })),
    }))
  );

  const poItemIds = poLines.map((l) => l.id);
  const receivedRows =
    poItemIds.length > 0
      ? await prisma.goodsReceiptLine.groupBy({
          by: ['poItemId'],
          where: { poItemId: { in: poItemIds } },
          _sum: { qtyReceived: true },
        })
      : [];
  const receivedByPoItemId = new Map(
    receivedRows.map((r) => [r.poItemId, Number(r._sum.qtyReceived || 0)])
  );

  const quotationDeliveryByPrItem = buildSelectedQuotationDeliveryByPrItem(
    pr.supplierSelections as Parameters<typeof buildSelectedQuotationDeliveryByPrItem>[0]
  );

  const prItemInputs = pr.items.map((item) => ({
    id: item.id,
    lineNo: item.lineNo,
    description: item.description,
    partNo: item.partNo,
    qty: item.qty,
    purchaseQty: item.purchaseQty,
    status: String(item.status),
    departmentItemOutcome: item.departmentItemOutcome,
    branchItemOutcome: item.branchItemOutcome,
    desiredDeliveryDate: item.desiredDeliveryDate,
  }));

  const itemRows = prItemInputs.map((item) =>
    deriveItemProcurementRow(item, poLines, receivedByPoItemId, prStatus, quotationDeliveryByPrItem)
  );

  const timeline = buildBusinessTimeline(prStatus, itemRows, poLines);
  const snapshot = buildProcurementListSnapshot(
    prStatus,
    prItemInputs,
    poLines,
    receivedByPoItemId,
    quotationDeliveryByPrItem
  );

  const costBase = computeProcurementCostInsight(
    pr.totalAmount ? Number(pr.totalAmount) : null,
    pr.supplierSelections as Parameters<typeof computeProcurementCostInsight>[1],
    pr.purchaseOrders.map((po) => ({
      status: String(po.status),
      totalAmount: po.totalAmount,
      items: po.items.map((it) => ({
        qty: it.qty,
        unitPrice: it.unitPrice,
        amount: it.amount,
        confirmedQty: it.confirmedQty,
      })),
    }))
  );

  const cost = enrichProcurementCostInsight(
    costBase,
    {
      receivedCount: snapshot.receivedCount,
      totalCount: snapshot.totalCount,
      partialCount: snapshot.partialCount,
    },
    [],
    receivedByPoItemId,
    pr.purchaseOrders.map((po) => ({ status: String(po.status), totalAmount: po.totalAmount, items: [] })),
    { prStatus, trackingPoLines: poLines }
  );

  const pickup = isReadyForStockIssuePickup(
    {
      receivedCount: snapshot.receivedCount,
      totalCount: snapshot.totalCount,
      partialCount: snapshot.partialCount,
      nextEta: snapshot.nextEta,
      waitingReorderCount: 0,
      waitingReorderQty: 0,
    },
    prStatus,
    poLines
  );

  console.log(JSON.stringify(
    {
      prNumber: pr.prNumber,
      prStatus,
      itemStatuses: pr.items.map((i) => ({ line: i.lineNo, status: i.status })),
      pos: pr.purchaseOrders.map((po) => ({
        poNumber: po.poNumber,
        status: po.status,
        items: po.items.length,
      })),
      preWarehouse: isPreWarehouseReceiptPhase(prStatus, poLines),
      itemRows: itemRows.map((r) => ({
        label: r.label,
        statusKey: r.statusKey,
        qtyReceived: r.qtyReceived,
        qtyCap: r.qtyCap,
      })),
      snapshot,
      timelinePct: timeline.percentage,
      currentStage: timeline.stages.find((s) => s.current)?.label,
      completedStage: timeline.stages.find((s) => s.key === 'COMPLETED')?.completed,
      costPhase: cost.purchasePhase,
      stockIssuePickupReady: pickup,
    },
    null,
    2
  ));
}

main()
  .finally(() => prisma.$disconnect());
