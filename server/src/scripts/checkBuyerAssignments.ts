import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBuyerAssignments() {
  try {
    console.log('\n🔍 ========== CHECKING BUYER ASSIGNMENTS ==========\n');

    // Get buyer user
    const buyer = await prisma.user.findFirst({
      where: { username: 'buyer', deletedAt: null },
    });

    if (!buyer) {
      console.log('❌ Buyer user not found\n');
      return;
    }

    console.log(`📋 Buyer: ${buyer.username} (${buyer.id})\n`);

    // Get all assignments for this buyer
    const assignments = await prisma.pRAssignment.findMany({
      where: {
        buyerId: buyer.id,
        deletedAt: null,
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            status: true,
            department: true,
            itemName: true,
            createdAt: true,
          },
        },
        buyerLeader: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Total assignments: ${assignments.length}\n`);

    if (assignments.length === 0) {
      console.log('⚠️  No assignments found for buyer\n');
      console.log('💡 To test:');
      console.log('   1. Login as buyer_leader');
      console.log('   2. Go to Pending Assignments');
      console.log('   3. Assign a PR to buyer\n');
    } else {
      assignments.forEach((assignment, i) => {
        console.log(`${i + 1}. Assignment ID: ${assignment.id}`);
        console.log(`   PR Number: ${assignment.purchaseRequest.prNumber}`);
        console.log(`   PR Status: ${assignment.purchaseRequest.status}`);
        console.log(`   Scope: ${assignment.scope}`);
        console.log(`   Assigned by: ${assignment.buyerLeader.username}`);
        console.log(`   Assigned at: ${assignment.createdAt.toISOString()}`);
        if (assignment.note) {
          console.log(`   Note: ${assignment.note}`);
        }
        console.log('');
      });
    }

    // Check PRs with ASSIGNED_TO_BUYER status
    const assignedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'ASSIGNED_TO_BUYER',
        deletedAt: null,
        assignments: {
          some: {
            buyerId: buyer.id,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        prNumber: true,
        status: true,
        department: true,
      },
    });

    console.log(`\n📊 PRs with ASSIGNED_TO_BUYER status: ${assignedPRs.length}`);
    assignedPRs.forEach((pr, i) => {
      console.log(`   ${i + 1}. ${pr.prNumber} (${pr.department || 'N/A'})`);
    });

    console.log('\n✅ Check complete!\n');
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkBuyerAssignments();
