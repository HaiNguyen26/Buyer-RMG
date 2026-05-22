import 'dotenv/config';
import { prisma } from '../config/database';

async function main() {
  const prs = await prisma.purchaseRequest.findMany({
    where: { deletedAt: null },
    select: {
      prNumber: true,
      status: true,
      assignments: {
        where: { deletedAt: null },
        select: { buyer: { select: { username: true } } },
      },
      supplierSelections: { select: { id: true } },
      purchaseOrders: { where: { deletedAt: null }, select: { poNumber: true } },
      items: { where: { deletedAt: null }, select: { status: true } },
    },
  });
  for (const p of prs) {
    console.log(
      `${p.prNumber}  status=${p.status}  buyers=${p.assignments.map((a) => a.buyer?.username).join(',')}  sel=${p.supplierSelections.length}  po=${p.purchaseOrders.length}  items=${p.items.map((i) => i.status).join('|')}`
    );
  }
}

main()
  .finally(() => prisma.$disconnect());
