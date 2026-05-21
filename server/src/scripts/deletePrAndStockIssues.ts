/**
 * Xóa toàn bộ phiếu xuất kho (nhả reserve) rồi xóa toàn bộ PR và phụ thuộc.
 * Reset document_sequences cho PR / PX / RFQ / PO-DRAFT; xóa audit log bảng stock.
 *
 * Chạy từ thư mục server: npm run delete-pr-and-stock
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { runDeleteAllPRs } from './deleteAllPRs';
import { runDeleteAllStockIssues } from './deleteAllStockIssues';

async function resetDocumentSequencesForPrFlow(): Promise<number> {
  const rows = await prisma.documentSequence.findMany({
    where: {
      OR: [
        { sequenceKey: { startsWith: 'PR:' } },
        { sequenceKey: { startsWith: 'PX:' } },
        { sequenceKey: { startsWith: 'RFQ:' } },
        { sequenceKey: { startsWith: 'PO-DRAFT:' } },
      ],
    },
    select: { sequenceKey: true },
  });
  if (rows.length === 0) return 0;
  const r = await prisma.documentSequence.deleteMany({
    where: { sequenceKey: { in: rows.map((x) => x.sequenceKey) } },
  });
  return r.count;
}

async function main() {
  console.log('========== XÓA PHIẾU XUẤT KHO + TOÀN BỘ PR ==========');
  console.log('⚠️  Sao lưu DB trước khi chạy. Thao tác không hoàn tác.\n');

  try {
    await runDeleteAllStockIssues();
    const auditStock = await prisma.auditLog.deleteMany({
      where: { tableName: { in: ['stock_issues', 'stock_issue_items'] } },
    });
    console.log(`[Audit] Đã xóa ${auditStock.count} dòng audit (stock_issues / stock_issue_items).\n`);

    await runDeleteAllPRs();

    const seqN = await resetDocumentSequencesForPrFlow();
    console.log(`\n[Sequence] Đã xóa ${seqN} khóa document_sequences (PR / PX / RFQ / PO-DRAFT).`);
    console.log('\n✅ Hoàn tất.\n');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
