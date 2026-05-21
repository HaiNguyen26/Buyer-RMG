/**
 * Xóa toàn bộ dữ liệu kho + mua hàng nội bộ (phiếu xuất, GRN, tồn, PR/PO/RFQ…).
 *
 * Giữ: User, Supplier, Customer, SalesPO, Branch, Department, ApprovalRule, ImportHistory (trừ khi audit xóa ref).
 *
 * Chạy (bắt buộc --confirm):
 *   cd server && npm run reset-warehouse-procurement -- --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { runDeleteAllPRs } from './deleteAllPRs';
import { runDeleteAllStockIssues } from './deleteAllStockIssues';

async function resetDocumentSequencesProcurement(): Promise<number> {
  const rows = await prisma.documentSequence.findMany({
    where: {
      OR: [
        { sequenceKey: { startsWith: 'PR:' } },
        { sequenceKey: { startsWith: 'PX:' } },
        { sequenceKey: { startsWith: 'RFQ:' } },
        { sequenceKey: { startsWith: 'PO-DRAFT:' } },
        { sequenceKey: { startsWith: 'GRN:' } },
      ],
    },
    select: { sequenceKey: true },
  });
  if (rows.length === 0) return 0;
  const r = await prisma.documentSequence.deleteMany({
    where: { sequenceKey: { in: rows.map((x) => x.sequenceKey) } },
  });
  return r.count;
}

const AUDIT_TABLES = [
  'stock_issues',
  'stock_issue_items',
  'goods_receipts',
  'goods_receipt_lines',
  'inventory_balances',
  'inventory_activities',
  'inventory_reservations',
  'purchase_orders',
  'po_items',
  'po_attachments',
  'purchase_requests',
  'purchase_request_items',
  'rfqs',
  'quotations',
] as const;

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('\n❌ Thiếu cờ --confirm. Chạy:\n   npm run reset-warehouse-procurement -- --confirm\n');
    process.exit(1);
  }

  console.log('\n🗑️  ========== RESET KHO + PR / PO / RFQ ==========');
  console.log('⚠️  Xóa: phiếu xuất, GRN, activity/reserve/balance/part master, toàn bộ PR & phụ thuộc (PO, RFQ, báo giá…).');
  console.log('✅  Giữ: User, NCC, Customer, Sales PO, chi nhánh, phòng ban, quy tắc duyệt (mặc định).');
  console.log('⚠️  Không hoàn tác. Sao lưu DB trước khi chạy.\n');

  try {
    console.log('1️⃣  Phiếu xuất kho (nhả reserve + xóa phiếu)…');
    await runDeleteAllStockIssues();

    console.log('2️⃣  Giữ chỗ tồn: xóa reservation / activity còn sót…');
    const resDel = await prisma.inventoryReservation.deleteMany({});
    const actDel = await prisma.inventoryActivity.deleteMany({});
    console.log(`   ✅ Reservations: ${resDel.count}, activities: ${actDel.count}`);

    console.log('3️⃣  GRN (phòng trường hợp chưa cascade)…');
    const grl = await prisma.goodsReceiptLine.deleteMany({});
    const gr = await prisma.goodsReceipt.deleteMany({});
    console.log(`   ✅ goods_receipt_lines: ${grl.count}, goods_receipts: ${gr.count}`);

    console.log('4️⃣  PR / PO / RFQ / báo giá / … (runDeleteAllPRs)…');
    await runDeleteAllPRs();

    console.log('5️⃣  Tồn kho: balance + danh mục vật tư (Part master)…');
    const bal = await prisma.inventoryBalance.deleteMany({});
    const pm = await prisma.partMaster.deleteMany({});
    console.log(`   ✅ inventory_balances: ${bal.count}, part_masters: ${pm.count}`);

    const seqN = await resetDocumentSequencesProcurement();
    console.log(`6️⃣  Document sequences (PR/PX/RFQ/PO-DRAFT/GRN): đã xóa ${seqN} khóa.`);

    const audit = await prisma.auditLog.deleteMany({
      where: { tableName: { in: [...AUDIT_TABLES] } },
    });
    console.log(`7️⃣  Audit log (bảng liên quan): ${audit.count} dòng.\n`);

    console.log('✅ Hoàn tất. Có thể tạo lại PR / nhập tồn từ đầu.\n');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\n❌ Lỗi:', msg);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
