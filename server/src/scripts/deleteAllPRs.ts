/**
 * Xóa toàn bộ Purchase Request và dữ liệu phụ thuộc (PO, RFQ, báo giá, duyệt, thông báo liên quan…).
 * Giữ: User, Supplier, Customer, SalesPO, Part master, Inventory, Department, Branch, Approval rules.
 *
 * Chạy:  npm run delete-all-prs   (từ thư mục server, cần .env DATABASE_URL)
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const PR_RELATED_AUDIT_TABLES = [
  'purchase_requests',
  'pr_assignments',
  'pr_approvals',
  'rfqs',
  'quotations',
  'supplier_selections',
  'budget_exceptions',
  'payments',
  'purchase_orders',
] as const;

/** Giải phóng quantityReserved trên inventory_balance (best-effort, cùng thứ tự dòng như lúc allocate). */
async function releaseInventoryReservedForPRItems(tx: Prisma.TransactionClient) {
  const items = await tx.purchaseRequestItem.findMany({
    where: {
      fromStockQty: { gt: 0 },
    },
    select: { partNo: true, fromStockQty: true },
  });

  for (const item of items) {
    const partNo = item.partNo?.trim();
    if (!partNo) continue;
    let remaining = Number(item.fromStockQty || 0);
    if (remaining <= 0) continue;

    const balances = await tx.inventoryBalance.findMany({
      where: { partInternalCode: partNo, companyId: null },
      orderBy: [{ quantityAvailable: 'desc' }, { updatedAt: 'asc' }],
    });

    for (const b of balances) {
      if (remaining <= 0) break;
      const reserved = Number(b.quantityReserved || 0);
      if (reserved <= 0) continue;
      const release = Math.min(remaining, reserved);
      await tx.inventoryBalance.update({
        where: { id: b.id },
        data: { quantityReserved: reserved - release },
      });
      remaining -= release;
    }
  }
}

export async function runDeleteAllPRs(): Promise<void> {
  console.log('\n🗑️  ========== XÓA TOÀN BỘ PR ==========');
  console.log('⚠️  Xóa: PO, RFQ, báo giá, phân công, duyệt, payment, PR items, PR.');
  console.log('⚠️  Giữ: User, NCC, Khách hàng, Sales PO, tồn kho/danh mục vật tư, chi nhánh, phòng ban.');
  console.log('⚠️  Không thể hoàn tác!\n');

  await prisma.$transaction(
    async (tx) => {
        console.log('0️⃣  Giải phóng tồn đã reserve từ PR (fromStockQty)…');
        await releaseInventoryReservedForPRItems(tx);

        console.log('1️⃣  Xóa PO (attachments → items → orders)…');
        const poA = await tx.pOAttachment.deleteMany({});
        const poI = await tx.pOItem.deleteMany({});
        const po = await tx.purchaseOrder.deleteMany({});
        console.log(`   ✅ PO: ${po.count}, items: ${poI.count}, attachments: ${poA.count}`);

        console.log('2️⃣  Xóa báo giá & lựa chọn NCC…');
        const qAtt = await tx.quotationAttachment.deleteMany({});
        const qIt = await tx.quotationItem.deleteMany({});
        const sel = await tx.supplierSelection.deleteMany({});
        const quo = await tx.quotation.deleteMany({});
        console.log(`   ✅ Quotations: ${quo.count}, q-items: ${qIt.count}, selections: ${sel.count}, q-att: ${qAtt.count}`);

        console.log('3️⃣  Xóa RFQ…');
        const rfq = await tx.rFQ.deleteMany({});
        console.log(`   ✅ RFQs: ${rfq.count}`);

        console.log('4️⃣  Xóa budget exception / assignment / approval / payment…');
        const be = await tx.budgetException.deleteMany({});
        const asn = await tx.pRAssignment.deleteMany({});
        const appr = await tx.pRApproval.deleteMany({});
        const pay = await tx.payment.deleteMany({});
        console.log(`   ✅ Budget: ${be.count}, assign: ${asn.count}, appr: ${appr.count}, pay: ${pay.count}`);

        console.log('5️⃣  Xóa PR items & PR…');
        const prIt = await tx.purchaseRequestItem.deleteMany({});
        const pr = await tx.purchaseRequest.deleteMany({});
        console.log(`   ✅ PR: ${pr.count}, PR items: ${prIt.count}`);

        console.log('6️⃣  Xóa thông báo gắn PR / RFQ…');
        const notif = await tx.notification.deleteMany({
          where: {
            relatedType: { in: ['PR', 'RFQ', 'PURCHASE_REQUEST'] },
          },
        });
        console.log(`   ✅ Notifications (PR/RFQ): ${notif.count}`);

        console.log('7️⃣  Xóa audit log nghiệp vụ PR…');
        const audit = await tx.auditLog.deleteMany({
          where: { tableName: { in: [...PR_RELATED_AUDIT_TABLES] } },
        });
        console.log(`   ✅ Audit rows: ${audit.count}`);

      console.log('\n✅ Hoàn tất xóa toàn bộ PR.\n');
    },
    { timeout: 120000 }
  );
}

async function main() {
  try {
    await runDeleteAllPRs();
    process.exit(0);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\n❌ Lỗi:', msg);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Chỉ chạy CLI khi file là entry (không chạy khi import từ script khác)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require.main === module) {
  void main();
}
