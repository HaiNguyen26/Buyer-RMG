/**
 * Tạo 1 khách hàng + 1 Sales PO (SO) giả định để Requestor thử tạo PR.
 * Mã dùng tiền tố MOCK- để script deleteMockData.ts có thể quét xóa sau này.
 *
 * Chạy sau khi đã reset DB nghiệp vụ / seed permissions:
 *   npm run seed:trial-so
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const MOCK_CUSTOMER_CODE = 'MOCK-CUST-PR-001';
const MOCK_SO_NUMBER = 'MOCK-SO-2026-001';

async function main() {
  console.log('\n📦 ========== SEED: MOCK CUSTOMER + SALES ORDER (thử PR) ==========\n');

  const existingSo = await prisma.salesPO.findFirst({
    where: { salesPONumber: MOCK_SO_NUMBER, deletedAt: null },
    select: { id: true },
  });
  if (existingSo) {
    console.log(`⏭️  Đã có SO ${MOCK_SO_NUMBER} — bỏ qua (idempotent).\n`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: 'MOCK — Công ty thử nghiệm PR',
        code: MOCK_CUSTOMER_CODE,
        email: 'mock-pr-demo@example.local',
        phone: '028-0000-0000',
        address: 'Địa chỉ giả định — chỉ dùng môi trường dev / UAT',
        taxCode: '0000000000',
        contactPerson: 'Người liên hệ (mock)',
        notes: 'Mock — khách hàng giả định cho luồng tạo PR thử nghiệm',
      },
    });

    await tx.salesPO.create({
      data: {
        salesPONumber: MOCK_SO_NUMBER,
        customerPONumber: 'MOCK-CPO-2026-001',
        customerId: customer.id,
        projectName: 'Dự án giả định — Triển khai thử nghiệm mua hàng theo dự án',
        projectCode: 'MOCK-PROJ-PR-2026-001',
        amount: new Prisma.Decimal('5000000000'),
        currency: 'VND',
        effectiveDate: new Date(),
        status: 'ACTIVE',
        projectManager: 'PM giả định (mock)',
        paymentTerms: 'Thanh toán theo tiến độ (mock)',
        advancePercent: new Prisma.Decimal('30'),
        projectDescription:
          'Hạng mục giả định: vật tư, thiết bị phục vụ test luồng PR → duyệt → RFQ/PO.',
        notes: 'Mock SO — chọn khi tạo PR thử nghiệm; xóa bằng npm run delete-mock (nếu có) hoặc deleteMockData.ts',
      },
    });
  });

  console.log(`✅ Đã tạo khách hàng (${MOCK_CUSTOMER_CODE}) + SO ${MOCK_SO_NUMBER}.`);
  console.log('   Trong màn tạo PR, chọn Customer PO / SO tương ứng để điền dự án từ DB.\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n❌', e);
    await prisma.$disconnect();
    process.exit(1);
  });
