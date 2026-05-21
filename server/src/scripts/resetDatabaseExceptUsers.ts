/**
 * Xóa toàn bộ dữ liệu trong DB **trừ bảng users** (tài khoản đăng nhập giữ nguyên).
 * Xóa luôn permissions / role_permissions — cần chạy lại: npm run seed:permissions
 *
 * Chạy (bắt buộc có --confirm):
 *   cd server && npm run db:reset-except-users
 */
import 'dotenv/config';
import { prisma } from '../config/database';

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('\n❌ Thiếu cờ --confirm. Chạy: npm run db:reset-except-users\n');
    process.exit(1);
  }

  console.log('\n🗑️  ========== RESET DB (GIỮ USERS) ==========');
  console.log('⚠️  Xóa: PR, PO, RFQ, kho, phiếu xuất, khách hàng, SO, thông báo, chi nhánh, RBAC, …');
  console.log('✅ Giữ: bảng users (toàn bộ dòng).');
  console.log('📌 Sau đó: npm run seed:permissions\n');

  try {
    await prisma.$transaction(
      async (tx) => {
        const log = (step: string, label: string, count: number) =>
          console.log(`   ✅ ${step} ${label}: ${count}`);

        console.log('📊 Đang xóa theo thứ tự phụ thuộc…\n');

        const invRes = await tx.inventoryReservation.deleteMany({});
        log('0.', 'Inventory reservations', invRes.count);

        const invAct = await tx.inventoryActivity.deleteMany({});
        log('1.', 'Inventory activities', invAct.count);

        const sii = await tx.stockIssueItem.deleteMany({});
        const si = await tx.stockIssue.deleteMany({});
        log('2.', 'Stock issues / items', sii.count + si.count);

        // GRN phụ thuộc PO — xóa rõ ràng trước khi xóa PO (tránh sót dòng / lỗi FK tùy DB)
        const grl = await tx.goodsReceiptLine.deleteMany({});
        const gr = await tx.goodsReceipt.deleteMany({});
        log('3.', 'Goods receipt lines / GRNs', grl.count + gr.count);

        const a0 = await tx.pOAttachment.deleteMany({});
        const a1 = await tx.pOItem.deleteMany({});
        const a2 = await tx.purchaseOrder.deleteMany({});
        log('4.', 'PO / items / attachments', a0.count + a1.count + a2.count);

        const b0 = await tx.quotationAttachment.deleteMany({});
        const b1 = await tx.quotationItem.deleteMany({});
        const b2 = await tx.supplierSelection.deleteMany({});
        const b3 = await tx.quotation.deleteMany({});
        const b4 = await tx.rFQ.deleteMany({});
        log('5.', 'RFQ / quotations / selections / q-attachments', b0.count + b1.count + b2.count + b3.count + b4.count);

        const c0 = await tx.budgetException.deleteMany({});
        log('6.', 'Budget exceptions', c0.count);

        const d0 = await tx.pRAssignment.deleteMany({});
        const d1 = await tx.pRApproval.deleteMany({});
        log('7.', 'PR assignments / approvals', d0.count + d1.count);

        const e0 = await tx.payment.deleteMany({});
        log('8.', 'Payments', e0.count);

        const f0 = await tx.purchaseRequestItem.deleteMany({});
        const f1 = await tx.purchaseRequest.deleteMany({});
        log('9.', 'PR / PR items', f0.count + f1.count);

        const g0 = await tx.supplier.deleteMany({});
        log('10.', 'Suppliers', g0.count);

        const h0 = await tx.salesPO.deleteMany({});
        const h1 = await tx.customer.deleteMany({});
        log('11.', 'Sales PO / Customers', h0.count + h1.count);

        const i0 = await tx.notification.deleteMany({});
        log('12.', 'Notifications', i0.count);

        const j0 = await tx.importHistory.deleteMany({});
        log('13.', 'Import history', j0.count);

        const k0 = await tx.auditLog.deleteMany({});
        log('14.', 'Audit logs', k0.count);

        const l0 = await tx.approvalRule.deleteMany({});
        log('15.', 'Approval rules', l0.count);

        const m0 = await tx.department.deleteMany({});
        log('16.', 'Departments', m0.count);

        const n0 = await tx.branchApprovalRule.deleteMany({});
        log('17.', 'Branch approval rules', n0.count);

        const o0 = await tx.branch.deleteMany({});
        log('18.', 'Branches', o0.count);

        const invB = await tx.inventoryBalance.deleteMany({});
        const pm = await tx.partMaster.deleteMany({});
        log('19.', 'Inventory balances / Part masters', invB.count + pm.count);

        const ds = await tx.documentSequence.deleteMany({});
        log('20.', 'Document sequences', ds.count);

        const q0 = await tx.rolePermission.deleteMany({});
        log('21.', 'Role permissions', q0.count);

        const r0 = await tx.permission.deleteMany({});
        log('22.', 'Permissions', r0.count);

        const userCount = await tx.user.count({});
        console.log(`\n✅ Hoàn tất. Users còn lại: ${userCount} tài khoản.`);
      },
      { timeout: 180000 }
    );

    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { username: true, role: true, email: true },
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });
    console.log('\n📋 Tài khoản (mẫu):');
    users.slice(0, 15).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.username.padEnd(22)} [${u.role}]`);
    });
    if (users.length > 15) console.log(`   … và ${users.length - 15} tài khoản khác`);

    console.log('\n📌 Bước tiếp theo:');
    console.log('   npm run seed:permissions');
    console.log('   (tùy chọn) nạp lại dữ liệu tổ chức / Excel\n');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\n❌ Lỗi:', msg);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
