/**
 * XÓA TOÀN BỘ DỮ LIỆU trong database (nghiệp vụ + người dùng + quyền + tổ chức).
 * Giữ nguyên schema / bảng (không drop migration).
 *
 * Dùng khi chuyển sang data thật, bỏ hết mock / dữ liệu cũ.
 *
 * Sau khi chạy (khuyến nghị):
 *   npx prisma migrate deploy
 *   npm run seed:permissions
 *   Import user / org từ Excel hoặc tạo user qua System Admin — KHÔNG bắt buộc seed:default-users.
 */
import 'dotenv/config';
import { prisma } from '../config/database';

async function resetAllData() {
  console.log('\n🗑️  ========== XÓA TOÀN BỘ DỮ LIỆU (FULL WIPE) ==========');
  console.log('⚠️  Xóa: PR, PO, RFQ, khách hàng, SO, user, phân quyền, chi nhánh, phòng ban, audit...');
  console.log('⚠️  KHÔNG xóa bảng _prisma_migrations (schema giữ nguyên).');
  console.log('⚠️  Không thể hoàn tác!\n');

  try {
    await prisma.$transaction(
      async (tx) => {
        const log = (step: string, label: string, count: number) =>
          console.log(`   ✅ ${step} ${label}: ${count}`);

        console.log('📊 Đang xóa theo thứ tự phụ thuộc...\n');

        const a0 = await tx.pOAttachment.deleteMany({});
        const a1 = await tx.pOItem.deleteMany({});
        const a2 = await tx.purchaseOrder.deleteMany({});
        log('0.', 'PO / PO items / attachments', a0.count + a1.count + a2.count);

        const b0 = await tx.quotationAttachment.deleteMany({});
        const b1 = await tx.quotationItem.deleteMany({});
        const b2 = await tx.supplierSelection.deleteMany({});
        const b3 = await tx.quotation.deleteMany({});
        const b4 = await tx.rFQ.deleteMany({});
        log('1.', 'Quotations / RFQ / selections / q-attachments', b0.count + b1.count + b2.count + b3.count + b4.count);

        const c0 = await tx.budgetException.deleteMany({});
        log('2.', 'Budget exceptions', c0.count);

        const d0 = await tx.pRAssignment.deleteMany({});
        const d1 = await tx.pRApproval.deleteMany({});
        log('3.', 'PR assignments / approvals', d0.count + d1.count);

        const e0 = await tx.payment.deleteMany({});
        log('4.', 'Payments', e0.count);

        const f0 = await tx.purchaseRequestItem.deleteMany({});
        const f1 = await tx.purchaseRequest.deleteMany({});
        log('5.', 'PR / PR items', f0.count + f1.count);

        const g0 = await tx.supplier.deleteMany({});
        log('6.', 'Suppliers', g0.count);

        const h0 = await tx.salesPO.deleteMany({});
        const h1 = await tx.customer.deleteMany({});
        log('7.', 'Sales PO / Customers', h0.count + h1.count);

        const i0 = await tx.notification.deleteMany({});
        log('8.', 'Notifications', i0.count);

        const j0 = await tx.importHistory.deleteMany({});
        log('9.', 'Import history', j0.count);

        const k0 = await tx.auditLog.deleteMany({});
        log('10.', 'Audit logs', k0.count);

        const l0 = await tx.approvalRule.deleteMany({});
        log('11.', 'Approval rules', l0.count);

        const m0 = await tx.department.deleteMany({});
        log('12.', 'Departments', m0.count);

        const n0 = await tx.branchApprovalRule.deleteMany({});
        log('13.', 'Branch approval rules', n0.count);

        const o0 = await tx.branch.deleteMany({});
        log('14.', 'Branches', o0.count);

        const invA = await tx.inventoryActivity.deleteMany({});
        const inv0 = await tx.inventoryBalance.deleteMany({});
        const inv1 = await tx.partMaster.deleteMany({});
        log('15.', 'Inventory activity / balances / Part masters', invA.count + inv0.count + inv1.count);

        const p0 = await tx.user.deleteMany({});
        log('16.', 'Users', p0.count);

        const q0 = await tx.rolePermission.deleteMany({});
        log('17.', 'Role permissions', q0.count);

        const r0 = await tx.permission.deleteMany({});
        log('18.', 'Permissions', r0.count);

        console.log('\n✅ Đã xóa hết dữ liệu trong các bảng nghiệp vụ + người dùng + RBAC + tổ chức.');
      },
      { timeout: 120000 }
    );

    console.log('\n📌 Bước tiếp theo:');
    console.log('   1) Đảm bảo schema mới nhất:  npx prisma migrate deploy');
    console.log('   2) Nạp lại ma trận quyền:      npm run seed:permissions');
    console.log('   3) Tạo user thật:             Import Excel / System Admin (KHÔNG cần seed:default-users)\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Lỗi:', msg);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetAllData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
