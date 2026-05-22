/**
 * Run: npx tsx src/scripts/testBuyerPrDisplayStatus.ts
 */
import assert from 'node:assert/strict';
import { computeBuyerPrDisplayStatus } from '../utils/buyerPrDisplayStatus';

const base = {
  assignments: [{ scope: 'FULL', assignedItemIds: null }],
  items: [
    { id: 'a', status: 'FULFILLED', purchaseQty: 0 },
    { id: 'b', status: 'ASSIGNED', purchaseQty: 1 },
  ],
};

// RFQ xong + item B chờ mua lại → AWAITING_REORDER
const reopen = computeBuyerPrDisplayStatus({
  ...base,
  buyerRfqs: [{ status: 'READY_FOR_COMPARISON' }],
});
assert.equal(reopen.status, 'AWAITING_REORDER');
assert.equal(reopen.awaitingPurchaseCount, 1);

// RFQ xong, không còn item chờ → QUOTATION_COMPLETED
const done = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [
    { id: 'a', status: 'FULFILLED', purchaseQty: 0 },
    { id: 'b', status: 'FULFILLED', purchaseQty: 0 },
  ],
  buyerRfqs: [{ status: 'READY_FOR_COMPARISON' }],
});
assert.equal(done.status, 'QUOTATION_COMPLETED');

// Chưa RFQ, item ASSIGNED → READY_FOR_RFQ (không nhầm với chờ mua lại)
const fresh = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [{ id: 'x', status: 'ASSIGNED', purchaseQty: 2 }],
  buyerRfqs: [],
});
assert.equal(fresh.status, 'READY_FOR_RFQ');

// Có dòng RFQ_CREATED nhưng query RFQ chưa kịp → vẫn "đang thu thập"
const rfqItemsOnly = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [{ id: 'x', status: 'RFQ_CREATED', purchaseQty: 1 }],
  buyerRfqs: [],
});
assert.equal(rfqItemsOnly.status, 'COLLECTING_QUOTATION');

// PR RFQ_COMPLETED — buyer vẫn thấy "Chờ tạo PO"
const awaitPo = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [{ id: 'a', status: 'SUPPLIER_SELECTED', purchaseQty: 0 }],
  buyerRfqs: [{ status: 'CLOSED' }],
  prStatus: 'RFQ_COMPLETED',
});
assert.equal(awaitPo.status, 'AWAITING_PO');

// BUDGET_EXCEPTION nhưng dòng đã SUPPLIER_SELECTED → Chờ tạo PO (không nhầm với chờ GĐ CN)
const budgetExReadyPo = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [
    { id: 'a', status: 'SUPPLIER_SELECTED', purchaseQty: 0 },
    { id: 'b', status: 'SUPPLIER_SELECTED', purchaseQty: 0 },
  ],
  buyerRfqs: [{ status: 'CLOSED' }],
  prStatus: 'BUDGET_EXCEPTION',
});
assert.equal(budgetExReadyPo.status, 'AWAITING_PO');

const budgetExPending = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [
    { id: 'a', status: 'RFQ_CREATED', purchaseQty: 1 },
    { id: 'b', status: 'ASSIGNED', purchaseQty: 1 },
  ],
  buyerRfqs: [{ status: 'DRAFT' }],
  prStatus: 'BUDGET_EXCEPTION',
});
assert.equal(budgetExPending.status, 'BUDGET_EXCEPTION_PENDING');

const rfqDoneAllNcc = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [
    { id: 'a', status: 'SUPPLIER_SELECTED', purchaseQty: 0 },
    { id: 'b', status: 'SUPPLIER_SELECTED', purchaseQty: 0 },
  ],
  buyerRfqs: [{ status: 'READY_FOR_COMPARISON' }],
  prStatus: 'QUOTATION_RECEIVED',
});
assert.equal(rfqDoneAllNcc.status, 'AWAITING_PO');

const rfqDoneFulfilledOnly = computeBuyerPrDisplayStatus({
  assignments: base.assignments,
  items: [
    { id: 'a', status: 'FULFILLED', purchaseQty: 0 },
    { id: 'b', status: 'FULFILLED', purchaseQty: 0 },
  ],
  buyerRfqs: [{ status: 'READY_FOR_COMPARISON' }],
  prStatus: 'QUOTATION_RECEIVED',
});
assert.equal(rfqDoneFulfilledOnly.status, 'QUOTATION_COMPLETED');

console.log('testBuyerPrDisplayStatus: OK');
