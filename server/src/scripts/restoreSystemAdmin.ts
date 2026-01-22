import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

dotenv.config();

async function restoreSystemAdmin() {
  try {
    console.log('\n🔄 Khôi phục tài khoản system_admin...\n');

    const defaultPassword = 'RMG123@';
    const hashedPassword = await hashPassword(defaultPassword);

    // Tìm tài khoản system_admin (kể cả đã bị soft-delete)
    const existingAdmin = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
      deleted_at: Date | null;
    }>>(`
      SELECT id, username, email, role::text as role, deleted_at
      FROM users 
      WHERE username = 'system_admin' 
      LIMIT 1
    `);

    if (existingAdmin.length === 0) {
      // Tạo mới nếu không tồn tại
      console.log('📝 Tài khoản system_admin không tồn tại, đang tạo mới...\n');

      const newAdmin = await prisma.user.create({
        data: {
          username: 'system_admin',
          email: 'system_admin@rmg.vn',
          passwordHash: hashedPassword,
          role: 'DEPARTMENT_HEAD', // Sử dụng DEPARTMENT_HEAD vì SYSTEM_ADMIN không còn trong enum
          location: 'HCM',
          companyId: null,
        },
      });

      console.log('✅ Đã tạo tài khoản system_admin mới:');
      console.log(`   ID: ${newAdmin.id}`);
      console.log(`   Username: ${newAdmin.username}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
    } else {
      const admin = existingAdmin[0];
      console.log('📝 Tìm thấy tài khoản system_admin, đang khôi phục...\n');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Deleted: ${admin.deleted_at ? 'Yes' : 'No'}\n`);

      // Restore tài khoản (set deleted_at = null) và cập nhật password
      await prisma.$executeRawUnsafe(`
        UPDATE users
        SET 
          deleted_at = NULL,
          password_hash = $1,
          updated_at = NOW()
        WHERE id::text = $2
      `, hashedPassword, admin.id);

      console.log('✅ Đã khôi phục tài khoản system_admin:');
      console.log(`   - Đã set deleted_at = NULL`);
      console.log(`   - Đã cập nhật password`);
    }

    // Kiểm tra lại
    const restoredAdmin = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
      deleted_at: Date | null;
    }>>(`
      SELECT id, username, email, role::text as role, deleted_at
      FROM users 
      WHERE username = 'system_admin' 
      AND deleted_at IS NULL
      LIMIT 1
    `);

    if (restoredAdmin.length > 0) {
      console.log('\n✅ Tài khoản system_admin đã sẵn sàng:\n');
      console.log(`   Username: ${restoredAdmin[0].username}`);
      console.log(`   Email: ${restoredAdmin[0].email}`);
      console.log(`   Role: ${restoredAdmin[0].role}`);
      console.log(`   Deleted: ${restoredAdmin[0].deleted_at ? 'Yes' : 'No'}\n`);

      console.log('📝 THÔNG TIN ĐĂNG NHẬP:');
      console.log(`   Username: ${restoredAdmin[0].username}`);
      console.log(`   Password: ${defaultPassword}`);
      console.log(`   Giao diện: /dashboard/department-head (vì role là DEPARTMENT_HEAD)`);
      console.log(`   Mô tả: Tài khoản system admin với role DEPARTMENT_HEAD\n`);
    } else {
      console.log('❌ Không thể khôi phục tài khoản!\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreSystemAdmin();

