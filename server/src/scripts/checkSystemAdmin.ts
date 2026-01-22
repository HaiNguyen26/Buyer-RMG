import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkSystemAdmin() {
  try {
    console.log('\n🔍 Kiểm tra tài khoản system_admin...\n');

    // Kiểm tra tài khoản system_admin
    const systemAdmin = await prisma.$queryRawUnsafe<Array<{
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

    if (systemAdmin.length === 0) {
      console.log('❌ Tài khoản system_admin KHÔNG tồn tại!\n');
      console.log('💡 Cần tạo lại tài khoản system_admin\n');
      return;
    }

    const admin = systemAdmin[0];
    console.log('✅ Tìm thấy tài khoản system_admin:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Deleted: ${admin.deleted_at ? 'Yes' : 'No'}\n`);

    if (admin.deleted_at) {
      console.log('⚠️  Tài khoản đã bị soft-delete!\n');
    }

    // Kiểm tra các role hợp lệ trong enum
    const validRoles = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role') 
      ORDER BY enumsortorder
    `);

    console.log('📋 Các role hợp lệ trong hệ thống:');
    validRoles.forEach(r => console.log(`   - ${r.enumlabel}`));
    console.log('');

    // Kiểm tra xem role của system_admin có hợp lệ không
    const isValidRole = validRoles.some(r => r.enumlabel === admin.role);
    if (!isValidRole) {
      console.log(`❌ Role "${admin.role}" của system_admin KHÔNG hợp lệ!\n`);
      console.log('💡 Cần cập nhật role cho system_admin\n');
    } else {
      console.log(`✅ Role "${admin.role}" là hợp lệ\n`);
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSystemAdmin();






