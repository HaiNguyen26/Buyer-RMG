import 'dotenv/config';
import { prisma } from '../config/database';

async function clearAllData() {
  console.log('\n🗑️  ========== CLEAR ALL DATA ==========');
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('⚠️  This action cannot be undone!\n');

  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      console.log('📊 Starting data deletion...\n');

      // 1. Delete Purchase Request related data (in order to avoid FK constraints)
      console.log('1️⃣  Deleting Purchase Request Items...');
      const prItemsDeleted = await tx.purchaseRequestItem.deleteMany({});
      console.log(`   ✅ Deleted ${prItemsDeleted.count} PR items`);

      console.log('2️⃣  Deleting PR Approvals...');
      const prApprovalsDeleted = await tx.pRApproval.deleteMany({});
      console.log(`   ✅ Deleted ${prApprovalsDeleted.count} PR approvals`);

      console.log('3️⃣  Deleting PR Assignments...');
      const prAssignmentsDeleted = await tx.pRAssignment.deleteMany({});
      console.log(`   ✅ Deleted ${prAssignmentsDeleted.count} PR assignments`);

      console.log('4️⃣  Deleting RFQs...');
      const rfqsDeleted = await tx.rFQ.deleteMany({});
      console.log(`   ✅ Deleted ${rfqsDeleted.count} RFQs`);

      console.log('5️⃣  Deleting Quotations...');
      const quotationsDeleted = await tx.quotation.deleteMany({});
      console.log(`   ✅ Deleted ${quotationsDeleted.count} quotations`);

      console.log('6️⃣  Deleting Quotation Items...');
      const quotationItemsDeleted = await tx.quotationItem.deleteMany({});
      console.log(`   ✅ Deleted ${quotationItemsDeleted.count} quotation items`);

      console.log('7️⃣  Deleting Supplier Selections...');
      const supplierSelectionsDeleted = await tx.supplierSelection.deleteMany({});
      console.log(`   ✅ Deleted ${supplierSelectionsDeleted.count} supplier selections`);

      console.log('8️⃣  Deleting Budget Exceptions...');
      const budgetExceptionsDeleted = await tx.budgetException.deleteMany({});
      console.log(`   ✅ Deleted ${budgetExceptionsDeleted.count} budget exceptions`);

      console.log('9️⃣  Deleting Payments...');
      const paymentsDeleted = await tx.payment.deleteMany({});
      console.log(`   ✅ Deleted ${paymentsDeleted.count} payments`);

      console.log('🔟 Deleting Purchase Requests...');
      const prsDeleted = await tx.purchaseRequest.deleteMany({});
      console.log(`   ✅ Deleted ${prsDeleted.count} purchase requests\n`);

      // 2. Delete Supplier related data
      console.log('1️⃣1️⃣  Deleting Suppliers...');
      const suppliersDeleted = await tx.supplier.deleteMany({});
      console.log(`   ✅ Deleted ${suppliersDeleted.count} suppliers\n`);

      // 3. Delete Notifications
      console.log('1️⃣2️⃣  Deleting Notifications...');
      const notificationsDeleted = await tx.notification.deleteMany({});
      console.log(`   ✅ Deleted ${notificationsDeleted.count} notifications\n`);

      // 4. Delete Import History
      console.log('1️⃣3️⃣  Deleting Import History...');
      const importHistoryDeleted = await tx.importHistory.deleteMany({});
      console.log(`   ✅ Deleted ${importHistoryDeleted.count} import history records\n`);

      // 5. Delete Approval Rules
      console.log('1️⃣4️⃣  Deleting Approval Rules...');
      const approvalRulesDeleted = await tx.approvalRule.deleteMany({});
      console.log(`   ✅ Deleted ${approvalRulesDeleted.count} approval rules\n`);

      // 6. Delete Departments
      console.log('1️⃣5️⃣  Deleting Departments...');
      const departmentsDeleted = await tx.department.deleteMany({});
      console.log(`   ✅ Deleted ${departmentsDeleted.count} departments\n`);

      // 7. Delete Branches
      console.log('1️⃣6️⃣  Deleting Branches...');
      const branchesDeleted = await tx.branch.deleteMany({});
      console.log(`   ✅ Deleted ${branchesDeleted.count} branches\n`);

      // 8. Delete Users (except system_admin if exists)
      console.log('1️⃣7️⃣  Deleting Users...');
      const systemAdmin = await tx.user.findFirst({
        where: {
          username: 'system_admin',
          deletedAt: null,
        },
      });

      let usersDeleted;
      if (systemAdmin) {
        // Delete all users except system_admin
        usersDeleted = await tx.user.deleteMany({
          where: {
            NOT: {
              username: 'system_admin',
            },
          },
        });
        console.log(`   ✅ Deleted ${usersDeleted.count} users (kept system_admin)`);
      } else {
        // Delete all users
        usersDeleted = await tx.user.deleteMany({});
        console.log(`   ✅ Deleted ${usersDeleted.count} users`);
      }

      // 9. Delete Audit Logs (optional - comment out if you want to keep audit trail)
      console.log('1️⃣8️⃣  Deleting Audit Logs...');
      const auditLogsDeleted = await tx.auditLog.deleteMany({});
      console.log(`   ✅ Deleted ${auditLogsDeleted.count} audit logs\n`);

      console.log('✅ All data cleared successfully!');
    });

    console.log('\n📊 ========== SUMMARY ==========');
    console.log('✅ Database cleared successfully!');
    console.log('✅ Ready for fresh data import from Excel');
    console.log('📊 =================================\n');

  } catch (error: any) {
    console.error('\n❌ Error clearing data:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearAllData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });




