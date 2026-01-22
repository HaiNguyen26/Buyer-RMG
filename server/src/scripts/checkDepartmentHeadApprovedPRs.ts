import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkDepartmentHeadApprovedPRs() {
  try {
    console.log('\n🔍 Kiểm tra PRs đã được department_head duyệt...\n');

    // Tìm department_head
    const deptHead = await prisma.user.findFirst({
      where: { username: 'department_head', deletedAt: null },
    });

    if (!deptHead) {
      console.log('❌ Không tìm thấy department_head!\n');
      return;
    }

    console.log(`✅ Department Head: ${deptHead.username} (ID: ${deptHead.id})\n`);

    // Kiểm tra PR Approvals của department_head
    const approvals = await prisma.pRApproval.findMany({
      where: {
        approverId: deptHead.id,
        action: 'APPROVE',
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            status: true,
            department: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`📋 Tìm thấy ${approvals.length} PR Approvals của department_head:\n`);

    if (approvals.length > 0) {
      approvals.forEach((approval, index) => {
        console.log(`${index + 1}. PR ${approval.purchaseRequest.prNumber}`);
        console.log(`   Status: ${approval.purchaseRequest.status}`);
        console.log(`   Department: ${approval.purchaseRequest.department || 'NULL'}`);
        console.log(`   Approved at: ${approval.createdAt}`);
        console.log(`   PR Updated at: ${approval.purchaseRequest.updatedAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Không có PR Approval nào\n');
    }

    // Kiểm tra tất cả PRs đã được quản lý trực tiếp duyệt (không filter theo thời gian)
    const allApprovedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'MANAGER_APPROVED',
        deletedAt: null,
      },
      select: {
        id: true,
        prNumber: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    console.log(`📋 Tổng số PRs có status MANAGER_APPROVED: ${allApprovedPRs.length}\n`);

    if (allApprovedPRs.length > 0) {
      console.log('Danh sách PRs đã được quản lý trực tiếp duyệt (20 mới nhất):');
      allApprovedPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.prNumber}`);
        console.log(`   Department: ${pr.department || 'NULL'}`);
        console.log(`   Updated: ${pr.updatedAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Không có PR nào có status MANAGER_APPROVED\n');
    }

    // Kiểm tra PRs đã được duyệt trong 30 ngày qua
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    const approvedPRsLast30Days = await prisma.purchaseRequest.findMany({
      where: {
        status: 'MANAGER_APPROVED',
        deletedAt: null,
        updatedAt: {
          gte: periodStart,
        },
      },
      select: {
        id: true,
        prNumber: true,
        department: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(`📋 PRs đã được duyệt trong 30 ngày qua: ${approvedPRsLast30Days.length}\n`);

    if (approvedPRsLast30Days.length > 0) {
      approvedPRsLast30Days.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.prNumber}`);
        console.log(`   Department: ${pr.department || 'NULL'}`);
        console.log(`   Updated: ${pr.updatedAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Không có PR nào được duyệt trong 30 ngày qua\n');
      console.log('💡 Có thể các PRs đã được duyệt trước đó (> 30 ngày)\n');
    }

    // Kiểm tra PRs đang chờ duyệt
    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'MANAGER_PENDING',
        deletedAt: null,
        requestorId: { not: deptHead.id },
      },
      select: {
        id: true,
        prNumber: true,
        department: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📋 PRs đang chờ quản lý trực tiếp duyệt: ${pendingPRs.length}\n`);

    if (pendingPRs.length > 0) {
      pendingPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.prNumber}`);
        console.log(`   Department: ${pr.department || 'NULL'}`);
        console.log(`   Created: ${pr.createdAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Không có PR nào đang chờ duyệt\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDepartmentHeadApprovedPRs();






