/**
 * Áp dụng hủy dòng cho mọi PO còn kẹt CANCEL_REQUESTED (trước khi bỏ bước duyệt).
 * Run: npx tsx src/scripts/migrateLegacyCancelRequestedPos.ts
 */
import { resolveAllLegacyCancelRequestedPos } from '../utils/executePoPartialLineCancel';

async function main() {
  const result = await resolveAllLegacyCancelRequestedPos();
  console.log('migrateLegacyCancelRequestedPos:', result);
  if (result.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
