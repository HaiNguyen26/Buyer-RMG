import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

// Load .env
dotenv.config();

async function updateUserPasswords() {
  try {
    const defaultPassword = 'RMG123@';
    const hashedPassword = await hashPassword(defaultPassword);

    // List of usernames to update
    const usernames = [
      'system_admin',
      'requestor',
      'buyer',
      'buyer_leader',
      'buyer_manage',
      'buyer_manager',
      'department_head',
      'branch_manager',
      'bgd',
      'sales',
      'warehouse',
      'duc',
      'nguyen',
      'accountant',
    ];

    console.log('🔄 Đang cập nhật password cho các tài khoản...\n');

    for (const username of usernames) {
      const user = await prisma.user.findFirst({
        where: {
          username,
          deletedAt: null,
        },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hashedPassword,
          },
        });
        console.log(`✅ Đã cập nhật password cho: ${username} (${user.email})`);
      } else {
        console.log(`⚠️  Không tìm thấy user: ${username}`);
      }
    }

    console.log(`\n✅ Hoàn thành! Tất cả tài khoản đã có password: ${defaultPassword}`);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateUserPasswords();


