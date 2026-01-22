import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPRStatus() {
  try {
    // Check BUYER_LEADER_PENDING count
    const approvedCount = await prisma.purchaseRequest.count({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
      },
    });
    console.log('Total PRs waiting for Buyer Leader assignment:', approvedCount);

    // Check all PRs with this status
    const approvedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        prNumber: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.log('\nPRs waiting for Buyer Leader assignment:');
    approvedPRs.forEach(pr => {
      console.log(`  - ${pr.prNumber} (created: ${pr.createdAt.toISOString()})`);
    });

    // Check PRs by status
    const allStatuses = await prisma.purchaseRequest.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });
    console.log('\nPRs by status:');
    allStatuses.forEach(s => {
      console.log(`  ${s.status}: ${s._count}`);
    });

    // Check PRs with assignments
    const prsWithAssignments = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
        assignments: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        prNumber: true,
        assignments: {
          where: { deletedAt: null },
          select: {
            id: true,
            buyerId: true,
          },
        },
      },
    });
    console.log('\nPRs with assignments:');
    prsWithAssignments.forEach(pr => {
      console.log(`  - ${pr.prNumber} (${pr.assignments.length} assignments)`);
    });

    // Check pending assignments (should be shown to buyer leader)
    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
        assignments: {
          none: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        prNumber: true,
      },
    });
    console.log('\nPRs pending assignment (should show in buyer leader):');
    pendingPRs.forEach(pr => {
      console.log(`  - ${pr.prNumber}`);
    });
    console.log(`\nTotal pending: ${pendingPRs.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPRStatus();








