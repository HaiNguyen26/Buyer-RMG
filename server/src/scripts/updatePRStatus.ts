import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePRStatus() {
  try {
    // Update APPROVED_BY_BRANCH to BUYER_LEADER_PENDING
    const result = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'BUYER_LEADER_PENDING'::"PRStatus"
      WHERE status = 'APPROVED_BY_BRANCH'::"PRStatus"
    `;

    console.log(`Updated ${result} PRs from APPROVED_BY_BRANCH to BUYER_LEADER_PENDING`);

    // Update SUBMITTED to MANAGER_PENDING (if needed)
    const result2 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'MANAGER_PENDING'::"PRStatus"
      WHERE status = 'SUBMITTED'::"PRStatus"
    `;

    console.log(`Updated ${result2} PRs from SUBMITTED to MANAGER_PENDING`);

    // Migrate Department Head statuses to Manager statuses
    const result3 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'MANAGER_PENDING'::"PRStatus"
      WHERE status = 'DEPARTMENT_HEAD_PENDING'::"PRStatus"
    `;
    const result4 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'MANAGER_APPROVED'::"PRStatus"
      WHERE status = 'DEPARTMENT_HEAD_APPROVED'::"PRStatus"
    `;
    const result5 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'MANAGER_REJECTED'::"PRStatus"
      WHERE status = 'DEPARTMENT_HEAD_REJECTED'::"PRStatus"
    `;
    const result6 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'MANAGER_RETURNED'::"PRStatus"
      WHERE status = 'DEPARTMENT_HEAD_RETURNED'::"PRStatus"
    `;
    console.log(`Updated ${result3 + result4 + result5 + result6} PRs from DEPARTMENT_HEAD_* to MANAGER_*`);

    // Migrate BRANCH_MANAGER_APPROVED to BUYER_LEADER_PENDING
    const result7 = await prisma.$executeRaw`
      UPDATE purchase_requests 
      SET status = 'BUYER_LEADER_PENDING'::"PRStatus"
      WHERE status = 'BRANCH_MANAGER_APPROVED'::"PRStatus"
    `;
    console.log(`Updated ${result7} PRs from BRANCH_MANAGER_APPROVED to BUYER_LEADER_PENDING`);

  } catch (error) {
    console.error('Error updating PR status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePRStatus();

