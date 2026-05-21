/**
 * Khôi phục tài khoản system_admin khi đã bị tắt trạng thái (soft-delete)
 * hoặc đổi role — chạy từ thư mục server:
 *   npm run restore:system-admin
 *
 * Tuỳ chọn: RESTORE_ADMIN_PASSWORD=mật_mới (mặc định RMG123@)
 */
import 'dotenv/config';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/password';

async function restoreSystemAdmin() {
  const defaultPassword = process.env.RESTORE_ADMIN_PASSWORD?.trim() || 'RMG123@';
  const passwordHash = await hashPassword(defaultPassword);

  const existing = await prisma.user.findFirst({
    where: { username: 'system_admin' },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username: 'system_admin',
        email: 'system_admin@rmg.vn',
        passwordHash,
        role: Role.SYSTEM_ADMIN,
        location: 'HCM',
        companyId: null,
        deletedAt: null,
      },
    });
    console.log('✅ Đã tạo mới user system_admin (SYSTEM_ADMIN).');
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        role: Role.SYSTEM_ADMIN,
        passwordHash,
      },
    });
    console.log('✅ Đã khôi phục system_admin: deletedAt = null, role = SYSTEM_ADMIN, password đặt lại.');
  }

  const ok = await prisma.user.findFirst({
    where: { username: 'system_admin', deletedAt: null },
    select: { username: true, email: true, role: true },
  });

  if (!ok) {
    console.error('❌ Kiểm tra DB thất bại.');
    process.exit(1);
  }

  console.log('\n📝 Đăng nhập:');
  console.log(`   Username: ${ok.username}`);
  console.log(`   Email:    ${ok.email}`);
  console.log(`   Role:     ${ok.role}`);
  console.log(`   Password: ${defaultPassword}`);
  console.log('\n🔗 /dashboard/system-admin\n');
}

restoreSystemAdmin()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
