/**
 * Run: npx tsx src/scripts/testGrnHistoryStatus.ts
 */
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  computeGrnDisplayStatus,
  resolveGrnDisplayStatusForPo,
  resolveGrnListDisplayStatus,
} from '../utils/grnHistoryStatus';

const dec = (n: number) => new Prisma.Decimal(n);

const itemA = {
  id: 'a',
  lineNo: 1,
  qty: dec(2),
  confirmedQty: dec(2),
  lineStatus: 'PARTIAL',
  description: 'A',
  purchaseRequestItem: { partNo: 'A', description: 'A' },
};
const itemB = {
  id: 'b',
  lineNo: 2,
  qty: dec(3),
  confirmedQty: dec(3),
  lineStatus: 'CANCELLED',
  description: 'B',
  purchaseRequestItem: { partNo: 'B', description: 'B' },
};

const poItems = new Map([
  ['a', itemA],
  ['b', itemB],
]);

// GRN nhận 1/2 item A — lúc đó còn chờ item B → PARTIAL
const receiptPartial = computeGrnDisplayStatus(
  null,
  [{ poItemId: 'a', qtyReceived: dec(1) }],
  poItems,
  new Map()
);
assert.equal(receiptPartial, 'PARTIAL', 'snapshot partial when B still open');

// Sau buyer hủy dòng B, PO CLOSED → hiển thị FULL
const displayClosed = resolveGrnListDisplayStatus(receiptPartial, 'CLOSED');
assert.equal(displayClosed, 'FULL', 'CLOSED PO → GRN history FULL');

const displayResolved = resolveGrnDisplayStatusForPo(
  null,
  [{ poItemId: 'a', qtyReceived: dec(1) }],
  poItems,
  new Map(),
  'CLOSED'
);
assert.equal(displayResolved, 'FULL', 'wrapper CLOSED');

// Dòng CANCELLED không làm GRN partial
const receiptWithCancelledLine = computeGrnDisplayStatus(
  null,
  [
    { poItemId: 'a', qtyReceived: dec(2) },
    { poItemId: 'b', qtyReceived: dec(0) },
  ],
  poItems,
  new Map([['a', 1]])
);
assert.equal(receiptWithCancelledLine, 'FULL', 'A complete + B cancelled');

console.log('testGrnHistoryStatus: OK');
