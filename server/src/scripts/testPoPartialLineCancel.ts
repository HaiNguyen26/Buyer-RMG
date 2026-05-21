/**
 * Unit checks — partial PO line cancel (enterprise flow).
 * Run: npx tsx src/scripts/testPoPartialLineCancel.ts
 */
import assert from 'node:assert/strict';
import {
  buildLineCancelApprovalRows,
  isPoLifecycleComplete,
  resolveOperationalPoStatusAfterLineCancel,
} from '../utils/poPartialLineCancel';

// PO A+B: hủy B, A chưa nhận → PO SENT/CONFIRMED, không CLOSED
const afterCancelB = [
  {
    id: 'a',
    purchaseRequestItemId: 'pr-a',
    qty: 10,
    confirmedQty: 10,
    received: 0,
    lineStatus: 'CONFIRMED',
  },
  {
    id: 'b',
    purchaseRequestItemId: 'pr-b',
    qty: 5,
    confirmedQty: 5,
    received: 0,
    lineStatus: 'CANCELLED',
  },
];
assert.equal(
  resolveOperationalPoStatusAfterLineCancel(afterCancelB, { supplierConfirmedAt: new Date() }),
  'CONFIRMED'
);
assert.equal(isPoLifecycleComplete(afterCancelB), false);

// A nhận đủ, B cancelled → CLOSED
const afterAReceived = [
  {
    id: 'a',
    purchaseRequestItemId: 'pr-a',
    qty: 10,
    confirmedQty: 10,
    received: 10,
    lineStatus: 'FULLY_RECEIVED',
  },
  {
    id: 'b',
    purchaseRequestItemId: 'pr-b',
    qty: 5,
    confirmedQty: 5,
    received: 0,
    lineStatus: 'CANCELLED',
  },
];
assert.equal(isPoLifecycleComplete(afterAReceived), true);
assert.equal(
  resolveOperationalPoStatusAfterLineCancel(afterAReceived, { supplierConfirmedAt: new Date() }),
  'CLOSED'
);

// buildLineCancelApprovalRows — chỉ dòng trong cancel list
const rows = buildLineCancelApprovalRows(
  [
    { id: 'a', purchaseRequestItemId: 'pr-a', qty: 10, confirmedQty: 10 },
    { id: 'b', purchaseRequestItemId: 'pr-b', qty: 5, confirmedQty: 5 },
  ],
  new Map([
    ['a', 0],
    ['b', 0],
  ]),
  ['b']
);
assert.equal(rows.cancelLines.length, 1);
assert.equal(rows.cancelLines[0]?.id, 'b');
assert.equal(rows.cancelLines[0]?.remaining, 5);
assert.equal(rows.fulfilledNotCancelled.length, 0);

console.log('testPoPartialLineCancel: OK');
