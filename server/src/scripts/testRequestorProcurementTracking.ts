/**
 * Smoke test for requestor procurement tracking (multi-line PR scenarios).
 * Run: npm run test:procurement-tracking  (or tsx src/scripts/testRequestorProcurementTracking.ts)
 */
import { Prisma } from '@prisma/client';
import {
  buildBusinessTimeline,
  buildBusinessTimelineFromPrStatus,
  buildCurrentStepBadge,
  buildDeliverySummary,
  buildProcurementListSnapshot,
  buildSelectedQuotationDeliveryByPrItem,
  computeProcurementCostInsight,
  enrichProcurementCostInsight,
  allPurchaseOrdersSettledForReceipt,
  deriveItemProcurementRow,
  isReadyForStockIssuePickup,
  type PoLineInput,
} from '../utils/requestorProcurementTracking';

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const prStatus = 'PO_IN_PROGRESS';

const items = [
  {
    id: 'item-rfq',
    lineNo: 1,
    description: 'Bolt M8',
    partNo: 'BOLT-M8',
    qty: dec(100),
    status: 'RFQ_CREATED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
  {
    id: 'item-po',
    lineNo: 2,
    description: 'Steel plate',
    partNo: 'STL-01',
    qty: dec(50),
    status: 'ASSIGNED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: new Date('2026-05-25'),
  },
  {
    id: 'item-grn',
    lineNo: 3,
    description: 'Gasket',
    partNo: 'GSK-1',
    qty: dec(20),
    status: 'ASSIGNED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
  {
    id: 'item-rev',
    lineNo: 4,
    description: 'Washer',
    partNo: null,
    qty: dec(10),
    status: 'ASSIGNED',
    departmentItemOutcome: 'REVISION_REQUIRED',
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
];

const poLines = [
  {
    id: 'po-line-2',
    purchaseRequestItemId: 'item-po',
    qty: dec(50),
    confirmedQty: dec(50),
    expectedDeliveryDate: new Date('2026-05-25'),
    lineStatus: 'CONFIRMED',
    purchaseOrder: { poNumber: 'PO-2026-001', status: 'CONFIRMED' },
  },
  {
    id: 'po-line-3',
    purchaseRequestItemId: 'item-grn',
    qty: dec(20),
    confirmedQty: dec(20),
    expectedDeliveryDate: new Date('2026-05-20'),
    lineStatus: 'PARTIAL_RECEIVED',
    purchaseOrder: { poNumber: 'PO-2026-001', status: 'PARTIAL_RECEIVED' },
  },
];

const receivedByPoItemId = new Map<string, number>([['po-line-3', 8]]);

const rows = items.map((item) =>
  deriveItemProcurementRow(item, poLines, receivedByPoItemId, prStatus)
);

assert(rows[0]!.statusKey === 'RFQ', `line1 RFQ got ${rows[0]!.statusKey}`);
assert(rows[1]!.statusKey === 'INCOMING', `line2 confirmed+ETA got ${rows[1]!.statusKey}`);
assert(rows[1]!.eta === '2026-05-25', `line2 eta ${rows[1]!.eta}`);
assert(rows[2]!.statusKey === 'PARTIAL_RECEIVED', `line3 partial GRN got ${rows[2]!.statusKey}`);
assert(rows[2]!.qtyReceived === 8 && rows[2]!.qtyCap === 20, 'line3 qty received/cap');
assert(rows[3]!.statusKey === 'REVISION_REQUIRED', `line4 revision got ${rows[3]!.statusKey}`);
assert(rows[3]!.eta === null, 'revision line has no ETA');

const quoteMap = buildSelectedQuotationDeliveryByPrItem([
  {
    purchaseRequestItemId: 'item-quote',
    quotation: {
      items: [
        {
          purchaseRequestItemId: 'item-quote',
          deliveryDate: new Date('2026-03-14'),
          leadTimeDays: 10,
        },
      ],
    },
  },
]);
const quoteRow = deriveItemProcurementRow(
  {
    id: 'item-quote',
    lineNo: 5,
    description: 'Cable',
    partNo: 'CBL-1',
    qty: dec(5),
    status: 'SUPPLIER_SELECTED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: new Date('2026-03-10'),
  },
  [],
  new Map(),
  'SUPPLIER_SELECTED',
  quoteMap
);
assert(quoteRow.eta === '2026-03-14', `quotation eta ${quoteRow.eta}`);
assert(quoteRow.etaOriginal === '2026-03-10', `eta original ${quoteRow.etaOriginal}`);
assert(quoteRow.etaRevised === '2026-03-14', `eta revised ${quoteRow.etaRevised}`);

const timeline = buildBusinessTimeline(prStatus, rows, poLines);
assert(timeline.stages.length === 7, '7 business stages');
assert(timeline.stages.some((s) => s.key === 'VENDOR_CONFIRMED' && s.completed), 'vendor confirmed stage');
assert(timeline.stages.some((s) => s.key === 'INCOMING' && (s.completed || s.current)), 'incoming stage');
const currentStage = timeline.stages.find((s) => s.current);
assert(
  currentStage?.key === 'INCOMING' || currentStage?.key === 'VENDOR_CONFIRMED',
  `current stage should reflect actual progress, got ${currentStage?.key}`
);

const headerOnly = buildBusinessTimelineFromPrStatus('ASSIGNED_TO_BUYER');
const headerCurrent = headerOnly.stages.find((s) => s.current);
assert(
  headerCurrent?.key === 'PROCUREMENT',
  `header-only current should be procurement not PO_SENT, got ${headerCurrent?.key}`
);

const delivery = buildDeliverySummary(rows);
assert(delivery.totalCount === 3, `trackable lines ${delivery.totalCount}`);
assert(delivery.receivedCount === 0, 'none fully received');
assert(delivery.partialCount === 1, 'one partial');
assert(delivery.nextEta === '2026-05-20', `nextEta min ${delivery.nextEta}`);

const badge = buildCurrentStepBadge(prStatus, rows, delivery, poLines);
assert(
  badge.label === 'Chờ nhận kho' || badge.label === 'Trễ hạn giao',
  `badge incoming/delay ${badge.label}`
);

const pendingRows = items.slice(0, 1).map((item) =>
  deriveItemProcurementRow(
    { ...item, status: 'SUBMITTED' },
    [],
    new Map(),
    'MANAGER_PENDING'
  )
);
assert(pendingRows[0]!.statusKey === 'PENDING_APPROVAL', 'approval pending item');

const snapshot = buildProcurementListSnapshot(prStatus, items, poLines, receivedByPoItemId);
assert(snapshot.itemPreview.length === 3, 'preview max 3');
assert(snapshot.totalCount === 3, 'trackable lines');
assert(snapshot.nextEta === '2026-05-20', `nextEta min ${snapshot.nextEta}`);
assert(snapshot.partialCount === 1, 'one partial');

const awardOnly = computeProcurementCostInsight(
  10_000_000,
  [
    {
      purchaseRequestItemId: 'item-a',
      quotation: {
        totalAmount: dec(0),
        items: [{ purchaseRequestItemId: 'item-a', totalPrice: dec(6_500_000) }],
      },
    },
    {
      purchaseRequestItemId: 'item-b',
      quotation: {
        totalAmount: dec(0),
        items: [{ purchaseRequestItemId: 'item-b', totalPrice: dec(4_000_000) }],
      },
    },
  ],
  []
);
assert(awardOnly.costSource === 'award', 'award source');
assert(awardOnly.procurementCostAmount === 10_500_000, `award total ${awardOnly.procurementCostAmount}`);
assert(awardOnly.isFinalized === true, 'award locks cost');

const poSentAwaiting = computeProcurementCostInsight(
  10_000_000,
  [],
  [
    {
      status: 'SENT',
      totalAmount: dec(10_555_545),
      items: [
        { qty: dec(1), unitPrice: dec(5_000_000), amount: dec(5_000_000), confirmedQty: null },
        { qty: dec(1), unitPrice: dec(5_555_545), amount: dec(5_555_545), confirmedQty: null },
      ],
    },
  ]
);
assert(poSentAwaiting.costSource === 'po', 'po source');
assert(poSentAwaiting.isFinalized === false, 'sent without NCC confirm');
assert(poSentAwaiting.awaitingVendorConfirm === true, 'awaiting vendor');

const poConfirmed = computeProcurementCostInsight(
  10_000_000,
  [],
  [
    {
      status: 'CONFIRMED',
      totalAmount: dec(10_555_545),
      items: [
        { qty: dec(1), unitPrice: dec(5_000_000), amount: dec(5_000_000), confirmedQty: dec(1) },
        { qty: dec(1), unitPrice: dec(5_555_545), amount: dec(5_555_545), confirmedQty: dec(1) },
      ],
    },
  ]
);
assert(poConfirmed.isFinalized === true, 'confirmed PO locks cost');
assert(poConfirmed.costSource === 'po', 'po confirmed');

const poWinsOverAward = computeProcurementCostInsight(
  10_000_000,
  [
    {
      purchaseRequestItemId: 'item-a',
      quotation: {
        totalAmount: dec(0),
        items: [{ purchaseRequestItemId: 'item-a', totalPrice: dec(9_000_000) }],
      },
    },
  ],
  [{ status: 'SENT', totalAmount: dec(10_555_545), items: [] }]
);
assert(poWinsOverAward.procurementCostAmount === 10_555_545, 'PO overrides award');

const poItemId = 'po-line-1';
const trackingPoLinesSent: PoLineInput[] = [
  {
    id: poItemId,
    purchaseRequestItemId: 'item-a',
    qty: 1,
    confirmedQty: 1,
    expectedDeliveryDate: null,
    lineStatus: 'OPEN',
    purchaseOrder: { poNumber: 'PO-1', status: 'SENT' },
  },
  {
    id: 'po-line-2',
    purchaseRequestItemId: 'item-b',
    qty: 1,
    confirmedQty: 1,
    expectedDeliveryDate: null,
    lineStatus: 'OPEN',
    purchaseOrder: { poNumber: 'PO-1', status: 'SENT' },
  },
];

const enrichedCompleted = enrichProcurementCostInsight(
  poConfirmed,
  { receivedCount: 2, totalCount: 2, partialCount: 0 },
  [
    {
      id: poItemId,
      unitPrice: dec(5_000_000),
      qty: dec(1),
      amount: dec(5_500_000),
      vatPercent: dec(10),
    },
    {
      id: 'po-line-2',
      unitPrice: dec(4_000_000),
      qty: dec(1),
      amount: dec(4_400_000),
      vatPercent: dec(10),
    },
  ],
  new Map([
    [poItemId, 1],
    ['po-line-2', 1],
  ]),
  [{ status: 'SENT', totalAmount: dec(9_900_000), items: [] }],
  { prStatus: 'CLOSED', trackingPoLines: trackingPoLinesSent }
);
assert(enrichedCompleted.purchasePhase === 'completed', 'phase completed when fully received');
assert(
  enrichedCompleted.finalPurchaseAmount === 9_000_000,
  `final GRN ex-VAT ${enrichedCompleted.finalPurchaseAmount}`
);
assert(
  enrichedCompleted.finalPurchaseAmount !== poConfirmed.procurementCostAmount,
  'must not equal PO total with VAT'
);

const enrichedSourcing = enrichProcurementCostInsight(
  poConfirmed,
  { receivedCount: 1, totalCount: 2, partialCount: 0 },
  [],
  new Map()
);
assert(enrichedSourcing.purchasePhase === 'sourcing', 'still sourcing when partial receipt');

const partialPoClosed = enrichProcurementCostInsight(
  { ...poConfirmed, procurementCostAmount: 11_000_000, buyerTargetAmount: 11_000_000 },
  {
    receivedCount: 0,
    totalCount: 1,
    partialCount: 0,
    waitingReorderCount: 1,
    waitingReorderQty: 1,
  },
  [
    {
      id: 'po-partial',
      unitPrice: dec(1_000_000),
      qty: dec(2),
      amount: dec(2_200_000),
      vatPercent: dec(10),
    },
  ],
  new Map([['po-partial', 1]]),
  [{ status: 'CLOSED', totalAmount: dec(2_200_000), items: [] }]
);
assert(
  allPurchaseOrdersSettledForReceipt([{ status: 'CLOSED', totalAmount: 0, items: [] }]),
  'CLOSED PO is settled'
);
assert(
  partialPoClosed.procurementCostAmount === 1_000_000,
  `closed PO cost = GRN qty only, got ${partialPoClosed.procurementCostAmount}`
);
assert(
  partialPoClosed.finalPurchaseAmount === 1_000_000,
  'final amount matches one received unit'
);
assert(partialPoClosed.purchasePhase === 'sourcing', 'PR still awaiting reorder stays sourcing phase');

// PR chờ tạo PO: dòng FULFILLED trong DB không được coi Hoàn tất / 3-3 nhận kho
const awaitingPoItems = [
  {
    id: 'it-1',
    lineNo: 1,
    description: 'Laptop',
    partNo: 'LP-1',
    qty: dec(1),
    status: 'FULFILLED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
  {
    id: 'it-2',
    lineNo: 2,
    description: 'Mouse',
    partNo: 'MS-1',
    qty: dec(1),
    status: 'FULFILLED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
  {
    id: 'it-3',
    lineNo: 3,
    description: 'Bag',
    partNo: 'BG-1',
    qty: dec(1),
    status: 'FULFILLED',
    departmentItemOutcome: null,
    branchItemOutcome: null,
    desiredDeliveryDate: null,
  },
];
const awaitingPoRows = awaitingPoItems.map((item) =>
  deriveItemProcurementRow(item, [], new Map(), 'PO_PENDING')
);
assert(
  awaitingPoRows.every((r) => r.statusKey === 'SUPPLIER_SELECTED'),
  'PO_PENDING + FULFILLED DB → still awaiting PO for requestor'
);
const awaitingDelivery = buildDeliverySummary(awaitingPoRows);
assert(awaitingDelivery.receivedCount === 0, 'no false 3/3 received');
const awaitingTimeline = buildBusinessTimeline('PO_PENDING', awaitingPoRows, []);
assert(
  !awaitingTimeline.stages.find((s) => s.key === 'COMPLETED')?.completed,
  'timeline not completed while PO_PENDING'
);
const awaitingBadge = buildCurrentStepBadge('PO_PENDING', awaitingPoRows, awaitingDelivery, []);
assert(awaitingBadge.label === 'Chờ tạo PO', `badge ${awaitingBadge.label}`);
assert(
  !isReadyForStockIssuePickup(awaitingDelivery, 'PO_PENDING', []),
  'no stock pickup banner before PO phase'
);

// Buyer vừa tạo PO (PO_IN_PROGRESS + draft): FULFILLED DB không được 3/3 nhận kho
const draftPoRows = awaitingPoItems.map((item) =>
  deriveItemProcurementRow(
    item,
    [
      {
        id: 'po-draft-1',
        purchaseRequestItemId: item.id,
        qty: dec(1),
        confirmedQty: null,
        expectedDeliveryDate: new Date('2026-06-15'),
        lineStatus: 'OPEN',
        purchaseOrder: { poNumber: 'PO-DRAFT-2026-001', status: 'DRAFT' },
      },
    ],
    new Map(),
    'PO_IN_PROGRESS'
  )
);
assert(
  draftPoRows.every((r) => r.statusKey !== 'FULFILLED' && r.statusKey !== 'RECEIVED'),
  `draft PO must not show received, got ${draftPoRows.map((r) => r.statusKey).join(',')}`
);
const draftDelivery = buildDeliverySummary(draftPoRows);
assert(draftDelivery.receivedCount === 0, 'no false 3/3 after create draft PO');
assert(
  !isReadyForStockIssuePickup(draftDelivery, 'PO_IN_PROGRESS', [
    {
      id: 'po-draft-1',
      purchaseRequestItemId: 'it-1',
      qty: dec(1),
      confirmedQty: null,
      expectedDeliveryDate: null,
      lineStatus: 'OPEN',
      purchaseOrder: { poNumber: 'PO-DRAFT-2026-001', status: 'DRAFT' },
    },
  ]),
  'no pickup banner on draft PO'
);

// PR cũ: header PO_PENDING nhưng đã GRN trên PO SENT — không được 100% Hoàn tất
const legacyPoLines = [
  {
    id: 'po-legacy',
    purchaseRequestItemId: 'it-1',
    qty: dec(1),
    confirmedQty: dec(1),
    expectedDeliveryDate: new Date('2026-06-01'),
    lineStatus: 'CONFIRMED',
    purchaseOrder: { poNumber: 'PO-DRAFT-2026-001', status: 'SENT' },
  },
];
const legacyRows = awaitingPoItems.slice(0, 1).map((item) =>
  deriveItemProcurementRow(item, legacyPoLines, new Map([['po-legacy', 1]]), 'PO_PENDING')
);
assert(
  legacyRows[0]!.statusKey === 'PO_SENT',
  `legacy PO_PENDING+SENT+GRN got ${legacyRows[0]!.statusKey}`
);
const legacyTimeline = buildBusinessTimeline('PO_PENDING', legacyRows, legacyPoLines);
assert(
  !legacyTimeline.stages.find((s) => s.key === 'COMPLETED')?.completed,
  'legacy not timeline completed'
);

console.log('OK requestorProcurementTracking smoke test');
console.log(
  '  rows:',
  rows.map((r) => `${r.label}: ${r.statusLabel} (${r.qtyReceived}/${r.qtyCap})`)
);
console.log('  delivery:', delivery);
console.log('  badge:', badge.label, badge.detail);
