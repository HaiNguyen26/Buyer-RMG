/**
 * Ghi ETA từ báo giá NCC vào POItem.expectedDeliveryDate (PO tạo trước khi có logic copy ETA).
 *
 * Usage:
 *   npx tsx src/scripts/backfillPoLineEta.ts           # dry-run
 *   npx tsx src/scripts/backfillPoLineEta.ts --apply   # ghi DB
 */
import { backfillPoLineEtaFromQuotations } from '../utils/poLineEta';

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;

  console.log(dryRun ? 'DRY RUN (thêm --apply để ghi DB)' : 'APPLY — cập nhật DB...');

  const result = await backfillPoLineEtaFromQuotations({ dryRun });
  console.log(
    `Đã quét ${result.scanned} dòng PO thiếu ETA → cập nhật ${result.updated}, bỏ qua ${result.skipped} (không tìm được ngày giao).`
  );

  if (dryRun && result.updated > 0) {
    console.log('Chạy lại với --apply để lưu ETA vào database.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
