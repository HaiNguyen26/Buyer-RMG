import { prisma } from '../config/database';

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true, bankName: true, bankAccount: true },
  });
  console.log('Suppliers:', suppliers.length);
  for (const s of suppliers) {
    console.log(
      ` - ${s.code ?? 'no-code'} | ${s.name} | bank=${s.bankName ?? 'NULL'} | acc=${s.bankAccount ?? 'NULL'}`
    );
  }
  const po = await prisma.purchaseOrder.findFirst({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      poNumber: true,
      supplier: { select: { name: true, bankName: true, bankAccount: true } },
    },
  });
  console.log('\nLatest PO supplier:', po);
}

main()
  .finally(() => prisma.$disconnect());
