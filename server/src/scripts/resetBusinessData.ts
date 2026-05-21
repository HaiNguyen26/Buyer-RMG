import 'dotenv/config';
import { prisma } from '../config/database';

async function resetBusinessData() {
  console.log('\n🗑️  ========== XÓA THÔNG TIN PR CŨ ==========');
  console.log('⚠️  Xóa toàn bộ PR cũ, PO, RFQ, báo giá... Chỉ GIỮ LẠI User.');
  console.log('⚠️  Sau khi chạy xong, bạn có thể tạo PR mới từ đầu.');
  console.log('⚠️  Hành động này không thể hoàn tác!\n');

  try {
    await prisma.$transaction(async (tx) => {
      console.log('📊 Bắt đầu xóa dữ liệu...\n');

      // 0. PO (phải xóa trước vì tham chiếu PR)
      console.log('0️⃣  Xóa PO (đơn mua hàng)...');
      const poAttach = await tx.pOAttachment.deleteMany({});
      const poItems = await tx.pOItem.deleteMany({});
      const pos = await tx.purchaseOrder.deleteMany({});
      console.log(`   ✅ Đã xóa ${pos.count} PO, ${poItems.count} PO items, ${poAttach.count} PO attachments`);

      // 1. QuotationAttachment
      console.log('1️⃣  Xóa Quotation Attachments...');
      const qAttach = await tx.quotationAttachment.deleteMany({});
      console.log(`   ✅ Đã xóa ${qAttach.count} attachments`);

      // 2. QuotationItem
      console.log('2️⃣  Xóa Quotation Items...');
      const qItems = await tx.quotationItem.deleteMany({});
      console.log(`   ✅ Đã xóa ${qItems.count} quotation items`);

      // 3. SupplierSelection
      console.log('3️⃣  Xóa Supplier Selections...');
      const selects = await tx.supplierSelection.deleteMany({});
      console.log(`   ✅ Đã xóa ${selects.count} supplier selections`);

      // 4. Quotation
      console.log('4️⃣  Xóa Quotations...');
      const quotations = await tx.quotation.deleteMany({});
      console.log(`   ✅ Đã xóa ${quotations.count} quotations`);

      // 5. RFQ
      console.log('5️⃣  Xóa RFQs...');
      const rfqs = await tx.rFQ.deleteMany({});
      console.log(`   ✅ Đã xóa ${rfqs.count} RFQs`);

      // 6. BudgetException
      console.log('6️⃣  Xóa Budget Exceptions...');
      const budget = await tx.budgetException.deleteMany({});
      console.log(`   ✅ Đã xóa ${budget.count} budget exceptions`);

      // 7. PRAssignment
      console.log('7️⃣  Xóa PR Assignments...');
      const assign = await tx.pRAssignment.deleteMany({});
      console.log(`   ✅ Đã xóa ${assign.count} PR assignments`);

      // 8. PRApproval
      console.log('8️⃣  Xóa PR Approvals...');
      const approvals = await tx.pRApproval.deleteMany({});
      console.log(`   ✅ Đã xóa ${approvals.count} PR approvals`);

      // 9. Payment
      console.log('9️⃣  Xóa Payments...');
      const payments = await tx.payment.deleteMany({});
      console.log(`   ✅ Đã xóa ${payments.count} payments`);

      // 10. PurchaseRequestItem
      console.log('🔟 Xóa Purchase Request Items...');
      const prItems = await tx.purchaseRequestItem.deleteMany({});
      console.log(`   ✅ Đã xóa ${prItems.count} PR items`);

      // 11. PurchaseRequest
      console.log('1️⃣1️⃣  Xóa Purchase Requests...');
      const prs = await tx.purchaseRequest.deleteMany({});
      console.log(`   ✅ Đã xóa ${prs.count} purchase requests`);

      // 12. Supplier
      console.log('1️⃣2️⃣  Xóa Suppliers...');
      const suppliers = await tx.supplier.deleteMany({});
      console.log(`   ✅ Đã xóa ${suppliers.count} suppliers`);

      // 13. SalesPO
      console.log('1️⃣3️⃣  Xóa Sales POs...');
      const salesPos = await tx.salesPO.deleteMany({});
      console.log(`   ✅ Đã xóa ${salesPos.count} sales POs`);

      // 14. Customer
      console.log('1️⃣4️⃣  Xóa Customers...');
      const customers = await tx.customer.deleteMany({});
      console.log(`   ✅ Đã xóa ${customers.count} customers`);

      // 15. Notification
      console.log('1️⃣5️⃣  Xóa Notifications...');
      const notifs = await tx.notification.deleteMany({});
      console.log(`   ✅ Đã xóa ${notifs.count} notifications`);

      // 16. ImportHistory
      console.log('1️⃣6️⃣  Xóa Import History...');
      const imports = await tx.importHistory.deleteMany({});
      console.log(`   ✅ Đã xóa ${imports.count} import history records`);

      // 17. ApprovalRule
      console.log('1️⃣7️⃣  Xóa Approval Rules...');
      const rules = await tx.approvalRule.deleteMany({});
      console.log(`   ✅ Đã xóa ${rules.count} approval rules`);

      // 18. Department
      console.log('1️⃣8️⃣  Xóa Departments...');
      const depts = await tx.department.deleteMany({});
      console.log(`   ✅ Đã xóa ${depts.count} departments`);

      // 19. Branch
      console.log('1️⃣9️⃣  Xóa Branches...');
      const branches = await tx.branch.deleteMany({});
      console.log(`   ✅ Đã xóa ${branches.count} branches`);

      // 20. AuditLog
      console.log('2️⃣0️⃣  Xóa Audit Logs...');
      const audit = await tx.auditLog.deleteMany({});
      console.log(`   ✅ Đã xóa ${audit.count} audit logs`);

      console.log('\n✅ Xóa dữ liệu hoàn tất!');
    }, { timeout: 30000 });

    // Show remaining users
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { username: true, role: true, email: true },
      orderBy: { role: 'asc' },
    });

    console.log('\n📋 ========== TÀI KHOẢN GIỮ LẠI ==========');
    users.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.username.padEnd(20)} [${u.role}]  ${u.email}`);
    });
    console.log(`\n   Tổng: ${users.length} tài khoản`);
    console.log('===========================================\n');
    console.log('✅ Đã xóa xong thông tin PR cũ. Bạn có thể tạo PR mới!\n');

  } catch (error: any) {
    console.error('\n❌ Lỗi khi xóa dữ liệu:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetBusinessData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
