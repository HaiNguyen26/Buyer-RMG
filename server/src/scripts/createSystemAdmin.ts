import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

// Load .env
dotenv.config();

async function createSystemAdmin() {
  try {
    const defaultPassword = 'RMG123@';
    const hashedPassword = await hashPassword(defaultPassword);

    console.log('\n🚀 Tạo tài khoản System Admin...\n');

    // Check if system_admin already exists
    const existingSystemAdmin = await prisma.user.findFirst({
      where: { username: 'system_admin', deletedAt: null },
    });

    let systemAdmin;
    if (existingSystemAdmin) {
      systemAdmin = existingSystemAdmin;
      console.log('ℹ️  Tài khoản system_admin đã tồn tại');
      console.log(`   Username: ${systemAdmin.username}`);
      console.log(`   Email: ${systemAdmin.email}`);
      console.log(`   Role: ${systemAdmin.role}`);
    } else {
      systemAdmin = await prisma.user.create({
        data: {
          username: 'system_admin',
          email: 'system_admin@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.SYSTEM_ADMIN,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: system_admin (SYSTEM_ADMIN)');
      console.log(`   Username: ${systemAdmin.username}`);
      console.log(`   Email: ${systemAdmin.email}`);
      console.log(`   Role: ${systemAdmin.role}`);
    }

    console.log('\n📝 THÔNG TIN ĐĂNG NHẬP:');
    console.log(`   Username: system_admin`);
    console.log(`   Password: ${defaultPassword}`);
    console.log(`   Giao diện: /dashboard/system-admin`);
    console.log(`   Component: SystemAdminDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho quản trị viên hệ thống\n`);

    console.log('✅ Hoàn thành!\n');
  } catch (error) {
    console.error('❌ Lỗi khi tạo tài khoản System Admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSystemAdmin();







