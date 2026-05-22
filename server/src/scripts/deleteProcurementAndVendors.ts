/**
 * Xóa toàn bộ luồng mua hàng (GRN, PR, PO, RFQ, báo giá…) + master NCC (suppliers).
 * Giữ: User, Customer, Sales PO, tồn kho/danh mục, chi nhánh, phòng ban (mặc định).
 *
 * Chạy:
 *   cd server
 *   npm run delete-procurement-and-vendors -- --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { runDeleteAllPRs } from './deleteAllPRs';

const AUDIT_TABLES = [
  'goods_receipts',
  'goods_receipt_lines',
  'purchase_requests',
  'purchase_request_items',
  'purchase_orders',
  'po_items',
  'po_attachments',
  'rfqs',
  'quotations',
  'quotation_items',
  'quotation_attachments',
  'supplier_selections',
  'suppliers',
  'pr_assignments',
  'pr_approvals',
  'budget_exceptions',
  'payments',
] as const;

async function deleteGrns(): Promise<void> {
  console.log('📦 Xóa GRN (lines → receipts)…');
  const lines = await prisma.goodsReceiptLine.deleteMany({});
  const grn = await prisma.goodsReceipt.deleteMany({});
  console.log(`   ✅ GRN: ${grn.count}, lines: ${lines.count}`);
}

async function deleteAllSuppliers(): Promise<void> {
  console.log('🏢 Xóa toàn bộ NCC (suppliers)…');
  const n = await prisma.supplier.deleteMany({});
  console.log(`   ✅ Suppliers: ${n.count}`);
}

async function resetProcurementSequences(): Promise<void> {
  const rows = await prisma.documentSequence.findMany({
    where: {
      OR: [
        { sequenceKey: { startsWith: 'PR:' } },
        { sequenceKey: { startsWith: 'RFQ:' } },
        { sequenceKey: { startsWith: 'PO-DRAFT:' } },
        { sequenceKey: { startsWith: 'PO:' } },
        { sequenceKey: { startsWith: 'GRN:' } },
      ],
    },
    select: { sequenceKey: true },
  });
  if (rows.length === 0) return;
  const r = await prisma.documentSequence.deleteMany({
    where: { sequenceKey: { in: rows.map((x) => x.sequenceKey) } },
  });
  console.log(`   ✅ Document sequences (PR/RFQ/PO/GRN): ${r.count}`);
}

export async function runDeleteProcurementAndVendors(): Promise<void> {
  await deleteGrns();
  await runDeleteAllPRs();
  await deleteAllSuppliers();

  const notif = await prisma.notification.deleteMany({
    where: { relatedType: { in: ['PR', 'RFQ', 'PURCHASE_REQUEST', 'PO', 'PURCHASE_ORDER'] } },
  });
  console.log(`🔔 Notifications (mua hàng): ${notif.count}`);

  const audit = await prisma.auditLog.deleteMany({
    where: { tableName: { in: [...AUDIT_TABLES] } },
  });
  console.log(`📋 Audit rows: ${audit.count}`);

  await resetProcurementSequences();
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error(
      '\n❌ Cần cờ --confirm để xóa PR, PO, RFQ, báo giá và toàn bộ NCC.\n' +
        '   npm run delete-procurement-and-vendors -- --confirm\n'
    );
    process.exit(1);
  }

  console.log('\n🗑️  ========== XÓA PR / PO / NCC (DATABASE) ==========');
  console.log('⚠️  Xóa: GRN, PR, PO, RFQ, báo giá, phân công, NCC (suppliers).');
  console.log('✅  Giữ: User, Khách hàng, Sales PO, master tồn kho (nếu có).');
  console.log('⚠️  Không hoàn tác. Sao lưu DB trước khi chạy.\n');

  try {
    await runDeleteProcurementAndVendors();
    const users = await prisma.user.count({ where: { deletedAt: null } });
    const suppliers = await prisma.supplier.count();
    const prs = await prisma.purchaseRequest.count();
    console.log('\n📊 Sau khi xóa:');
    console.log(`   Users: ${users}`);
    console.log(`   Suppliers: ${suppliers}`);
    console.log(`   PRs: ${prs}`);
    console.log('\n✅ Xong. Import NCC qua Buyer Manager → Import Excel (ghi thẳng DB).\n');
    console.log(
      '💡 Trên trình duyệt: mở DevTools → Application → Local Storage → xóa key `buyer-manager-vendors` (nếu còn).\n'
    );
    process.exit(0);
  } catch (e: unknown) {
    console.error('\n❌ Lỗi:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
