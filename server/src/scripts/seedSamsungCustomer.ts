/**
 * Đã tắt: không còn seed khách hàng / dữ liệu demo.
 * Tạo khách hàng thật qua giao diện Sales / System Admin hoặc import.
 */
import 'dotenv/config';

async function main() {
  console.log('⏭️  seed:samsung đã vô hiệu — không chèn dữ liệu mẫu. Bỏ qua.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
