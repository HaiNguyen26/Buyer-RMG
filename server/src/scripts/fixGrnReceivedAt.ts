/**
 * Sửa ngày nhận GRN đã lưu nhầm (thời điểm submit thay vì ngày chọn trên form).
 *
 * Usage:
 *   npx tsx src/scripts/fixGrnReceivedAt.ts GRN-2026-00042 2026-05-26
 */
import { prisma } from '../config/database';
import { parseReceiveDateInput } from '../utils/grnReceiveDate';

async function main() {
  const grnNumber = process.argv[2]?.trim();
  const isoDay = process.argv[3]?.trim();
  if (!grnNumber || !isoDay) {
    console.error('Usage: npx tsx src/scripts/fixGrnReceivedAt.ts <GRN-NUMBER> <YYYY-MM-DD>');
    process.exit(1);
  }
  const receivedAt = parseReceiveDateInput(isoDay);
  if (!receivedAt) {
    console.error('Invalid date:', isoDay);
    process.exit(1);
  }
  const grn = await prisma.goodsReceipt.findFirst({ where: { grnNumber } });
  if (!grn) {
    console.error('GRN not found:', grnNumber);
    process.exit(1);
  }
  await prisma.goodsReceipt.update({
    where: { id: grn.id },
    data: { receivedAt },
  });
  console.log(`Updated ${grnNumber} receivedAt → ${receivedAt.toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
