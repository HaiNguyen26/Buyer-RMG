/**
 * Chẩn đoán vì sao Buyer thấy 0 PR trên "PR được phân công".
 * npx tsx src/scripts/diagnoseBuyerAssignedPrList.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { BUYER_VISIBLE_PR_STATUSES } from '../constants/buyerAssignedPrStatuses';
import { computeBuyerPrDisplayStatus } from '../utils/buyerPrDisplayStatus';
import { prismaDepartmentOutcomeRowActive } from '../utils/departmentPrItemReview';

async function main() {
  const buyers = await prisma.user.findMany({
    where: { role: 'BUYER', deletedAt: null },
    select: { id: true, username: true, email: true },
    orderBy: { username: 'asc' },
  });

  console.log('\n=== BUYER users ===');
  for (const b of buyers) {
    console.log(`  ${b.username}  id=${b.id}`);
  }

  const allAssignments = await prisma.pRAssignment.findMany({
    where: { deletedAt: null },
    include: {
      buyer: { select: { username: true } },
      purchaseRequest: {
        select: {
          id: true,
          prNumber: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  console.log(`\n=== Mọi assignment (gần nhất, tối đa 30) === count=${allAssignments.length}`);
  for (const a of allAssignments) {
    const pr = a.purchaseRequest;
    const visible = pr && !pr.deletedAt && BUYER_VISIBLE_PR_STATUSES.includes(pr.status as any);
    console.log(
      `  buyer=${a.buyer?.username ?? a.buyerId}  PR=${pr?.prNumber ?? '?'}  prStatus=${pr?.status}  visibleInList=${visible}`
    );
  }

  for (const buyer of buyers) {
    const userId = buyer.id;
    const where = {
      deletedAt: null,
      status: { in: [...BUYER_VISIBLE_PR_STATUSES] },
      assignments: { some: { buyerId: userId, deletedAt: null } },
    };

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        rfqs: { where: { buyerId: userId, deletedAt: null }, select: { id: true, status: true } },
        items: {
          where: { deletedAt: null, ...prismaDepartmentOutcomeRowActive },
          select: { id: true, status: true, purchaseQty: true },
        },
        assignments: {
          where: { buyerId: userId, deletedAt: null },
          select: { scope: true, assignedItemIds: true },
        },
      },
      take: 20,
    });

    const mapped = prs
      .map((pr) => {
        const { status } = computeBuyerPrDisplayStatus({
          buyerRfqs: pr.rfqs,
          items: pr.items,
          assignments: pr.assignments,
          prStatus: pr.status,
        });
        return {
          prNumber: pr.prNumber,
          dbStatus: pr.status,
          displayStatus: status,
          rfqCount: pr.rfqs.length,
          itemCount: pr.items.length,
        };
      })
      .filter((p) => !String(p.prNumber).toUpperCase().startsWith('MOCK-'));

    console.log(`\n--- API list cho buyer "${buyer.username}" (${userId}) ---`);
    console.log(`  Raw PR từ DB (sau where): ${prs.length}`);
    console.log(`  Sau lọc MOCK-: ${mapped.length}`);
    for (const m of mapped) {
      console.log(
        `    ${m.prNumber}  DB=${m.dbStatus}  UI=${m.displayStatus}  rfqs=${m.rfqCount}  items=${m.itemCount}`
      );
    }

    if (mapped.length === 0) {
      const anyAssign = await prisma.pRAssignment.count({
        where: { buyerId: userId, deletedAt: null },
      });
      const hidden = await prisma.purchaseRequest.findMany({
        where: {
          deletedAt: null,
          assignments: { some: { buyerId: userId, deletedAt: null } },
          NOT: { status: { in: [...BUYER_VISIBLE_PR_STATUSES] } },
        },
        select: { prNumber: true, status: true },
        take: 10,
      });
      console.log(`  Assignments tồn tại: ${anyAssign}`);
      if (hidden.length) {
        console.log('  PR bị loại vì status NGOÀI danh sách Buyer:');
        hidden.forEach((h) => console.log(`    ${h.prNumber} → ${h.status}`));
      }
    }
  }

  console.log('\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
