import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function testDepartmentHeadAPI() {
  try {
    console.log('\n🧪 Test Department Head API queries...\n');

    // Simulate department_head user
    const deptHead = await prisma.user.findFirst({
      where: { username: 'department_head', deletedAt: null },
    });

    if (!deptHead) {
      console.log('❌ Không tìm thấy department_head!\n');
      return;
    }

    console.log(`✅ Department Head: ${deptHead.username} (ID: ${deptHead.id})`);
    console.log(`   Department: ${deptHead.department || 'NULL'}\n`);

    // Test query như trong controller (KHÔNG filter theo department)
    const whereClause: any = {
      status: 'MANAGER_PENDING',
      deletedAt: null,
      requestorId: { not: deptHead.id },
    };

    console.log('📝 Query 1: Pending PRs (NO department filter):');
    console.log('   Where clause:', JSON.stringify(whereClause, null, 2));

    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: whereClause,
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`   ✅ Tìm thấy ${pendingPRs.length} PRs đang chờ duyệt:\n`);

    if (pendingPRs.length > 0) {
      pendingPRs.forEach((pr, index) => {
        console.log(`   ${index + 1}. PR ${pr.prNumber}`);
        console.log(`      Department: ${pr.department || 'NULL'}`);
        console.log(`      Requestor: ${pr.requestor?.username || 'NULL'}`);
        console.log(`      Requestor Department: ${pr.requestor?.department || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  Không có PR nào đang chờ duyệt\n');
    }

    // Test query với filter department (OLD WAY - để so sánh)
    const whereClauseWithDept: any = {
      status: 'MANAGER_PENDING',
      deletedAt: null,
      requestorId: { not: deptHead.id },
    };

    if (deptHead.department) {
      whereClauseWithDept.OR = [
        { department: deptHead.department },
        {
          requestor: {
            department: deptHead.department,
          },
        },
      ];
    }

    console.log('📝 Query 2: Pending PRs (WITH department filter - OLD WAY):');
    console.log('   Where clause:', JSON.stringify(whereClauseWithDept, null, 2));

    const pendingPRsWithFilter = await prisma.purchaseRequest.findMany({
      where: whereClauseWithDept,
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`   ✅ Tìm thấy ${pendingPRsWithFilter.length} PRs với filter department:\n`);

    if (pendingPRsWithFilter.length > 0) {
      pendingPRsWithFilter.forEach((pr, index) => {
        console.log(`   ${index + 1}. PR ${pr.prNumber}`);
        console.log(`      Department: ${pr.department || 'NULL'}`);
        console.log(`      Requestor: ${pr.requestor?.username || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  Không có PR nào match với filter department\n');
    }

    // Test approved PRs
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    const approvedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'MANAGER_APPROVED',
        deletedAt: null,
        updatedAt: {
          gte: periodStart,
        },
      },
      select: {
        prNumber: true,
        department: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    console.log(`📝 Query 3: Approved PRs (last 30 days, NO department filter):`);
    console.log(`   ✅ Tìm thấy ${approvedPRs.length} PRs đã được duyệt:\n`);

    if (approvedPRs.length > 0) {
      approvedPRs.forEach((pr, index) => {
        console.log(`   ${index + 1}. PR ${pr.prNumber}`);
        console.log(`      Department: ${pr.department || 'NULL'}`);
        console.log(`      Updated: ${pr.updatedAt}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  Không có PR nào đã được duyệt trong 30 ngày qua\n');
    }

    console.log('\n✅ Hoàn thành test!\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDepartmentHeadAPI();






