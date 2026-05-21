/**
 * Một lần: nhả quantityReserved gắn legacy PR (fromStockQty) và set PR item chỉ còn mua hàng.
 * Chạy: npx tsx src/scripts/zeroPrFromStockAndRelease.ts (từ thư mục server)
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

async function releaseForItems(
  tx: Prisma.TransactionClient,
  items: { partNo: string | null; fromStockQty: Prisma.Decimal }[]
) {
  for (const item of items) {
    const partNo = item.partNo?.trim();
    if (!partNo) continue;
    let remaining = Number(item.fromStockQty || 0);
    if (remaining <= 0) continue;
    const balances = await tx.inventoryBalance.findMany({
      where: { partInternalCode: partNo, companyId: null },
      orderBy: [{ quantityAvailable: 'desc' }, { updatedAt: 'asc' }],
    });
    for (const b of balances) {
      if (remaining <= 0) break;
      const reserved = Number(b.quantityReserved || 0);
      if (reserved <= 0) continue;
      const release = Math.min(remaining, reserved);
      await tx.inventoryBalance.update({
        where: { id: b.id },
        data: { quantityReserved: reserved - release },
      });
      remaining -= release;
    }
  }
}

async function main() {
  const items = await prisma.purchaseRequestItem.findMany({
    where: { deletedAt: null, fromStockQty: { gt: 0 } },
    select: { id: true, partNo: true, fromStockQty: true, qty: true },
  });
  console.log(`Found ${items.length} PR items with fromStockQty > 0`);
  if (!items.length) {
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await releaseForItems(tx, items);
    for (const it of items) {
      const qty = Number(it.qty);
      await tx.purchaseRequestItem.update({
        where: { id: it.id },
        data: {
          fromStockQty: 0,
          purchaseQty: qty,
          status: 'NEED_PURCHASE',
        },
      });
    }
  });

  console.log('Done: released inventory + zeroed from_stock on items.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
