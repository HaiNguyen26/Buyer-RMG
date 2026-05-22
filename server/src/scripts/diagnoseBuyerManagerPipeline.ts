/**
 * Run: npx tsx src/scripts/diagnoseBuyerManagerPipeline.ts
 */
import { prisma } from '../config/database';
import { BUYER_MANAGER_PIPELINE_PR_STATUSES } from '../constants/buyerManagerPipelineStatuses';

async function main() {
  const all = await prisma.purchaseRequest.findMany({
    where: { deletedAt: null },
    select: { prNumber: true, status: true, totalAmount: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const pipeline = new Set<string>(BUYER_MANAGER_PIPELINE_PR_STATUSES);
  const inPipe = all.filter((p) => pipeline.has(p.status));
  const activeNotIn = all.filter(
    (p) =>
      !['DRAFT', 'CANCELLED', 'CLOSED', 'PAYMENT_DONE'].includes(p.status) &&
      !pipeline.has(p.status)
  );

  const sum = inPipe.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);

  console.log('Pipeline count:', inPipe.length, 'totalAmount sum:', sum);
  for (const p of inPipe) {
    console.log('  IN ', p.prNumber, p.status, Number(p.totalAmount ?? 0));
  }
  console.log('Active but NOT in pipeline:', activeNotIn.length);
  for (const p of activeNotIn) {
    console.log('  OUT', p.prNumber, p.status, Number(p.totalAmount ?? 0));
  }

  const byStatus = await prisma.purchaseRequest.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: true,
  });
  console.log('\nAll PR counts by status:');
  for (const g of byStatus) console.log(' ', g.status, g._count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
