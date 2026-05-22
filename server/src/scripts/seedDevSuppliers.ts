/**
 * Nạp NCC mẫu cho dev/test sau db:reset-except-users.
 * Chạy: npm run seed:suppliers-dev
 */
import 'dotenv/config';
import { prisma } from '../config/database';

const DEV_SUPPLIERS = [
  { code: 'NCC-DEV-001', name: 'Công ty TNHH Thiết bị ABC', email: 'sales@abc-dev.local', phone: '028 1234 0001' },
  { code: 'NCC-DEV-002', name: 'XYZ Technology Vietnam', email: 'quote@xyz-dev.local', phone: '028 1234 0002' },
  { code: 'NCC-DEV-003', name: 'Global Parts Supply Co.', email: 'rfq@globalparts-dev.local', phone: '028 1234 0003' },
  { code: 'NCC-DEV-004', name: 'Minh Phát Công nghiệp', email: 'minhphat@dev.local', phone: '0901 000 004' },
  { code: 'NCC-DEV-005', name: 'Đại lý Vật tư HCM', email: 'hcm-vattu@dev.local', phone: '0901 000 005' },
];

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('\n❌ Thiếu --confirm. Chạy: npm run seed:suppliers-dev\n');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const row of DEV_SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({
      where: { deletedAt: null, code: row.code },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.supplier.create({ data: row });
    created++;
  }

  const total = await prisma.supplier.count({ where: { deletedAt: null } });
  console.log(`\n✅ seed:suppliers-dev — tạo mới: ${created}, bỏ qua (đã có mã): ${skipped}, tổng NCC: ${total}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
