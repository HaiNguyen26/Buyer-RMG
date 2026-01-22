import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function addSystemAdminRole() {
  try {
    console.log('\n🔄 Thêm SYSTEM_ADMIN vào enum Role...\n');

    // Thêm SYSTEM_ADMIN vào enum Role trong PostgreSQL
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role') 
          AND enumlabel = 'SYSTEM_ADMIN'
        ) THEN
          ALTER TYPE "Role" ADD VALUE 'SYSTEM_ADMIN';
          RAISE NOTICE 'Added SYSTEM_ADMIN to Role enum';
        ELSE
          RAISE NOTICE 'SYSTEM_ADMIN already exists in Role enum';
        END IF;
      END $$;
    `);

    console.log('✅ Đã thêm SYSTEM_ADMIN vào enum Role!\n');

    // Kiểm tra lại
    const roles = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role') 
      ORDER BY enumsortorder
    `);

    console.log('📋 Các giá trị trong enum Role:');
    roles.forEach(r => console.log(`   - ${r.enumlabel}`));
    console.log('\n');

    // Cập nhật role của system_admin thành SYSTEM_ADMIN
    console.log('📝 Cập nhật role của system_admin thành SYSTEM_ADMIN...\n');

    await prisma.$executeRawUnsafe(`
      UPDATE users
      SET role = 'SYSTEM_ADMIN'::"Role"
      WHERE username = 'system_admin'
      AND deleted_at IS NULL
    `);

    console.log('✅ Đã cập nhật role của system_admin thành SYSTEM_ADMIN!\n');

    // Kiểm tra lại
    const systemAdmin = await prisma.$queryRawUnsafe<Array<{
      username: string;
      email: string;
      role: string;
    }>>(`
      SELECT username, email, role::text as role
      FROM users 
      WHERE username = 'system_admin' 
      AND deleted_at IS NULL
      LIMIT 1
    `);

    if (systemAdmin.length > 0) {
      console.log('✅ Tài khoản system_admin:');
      console.log(`   Username: ${systemAdmin[0].username}`);
      console.log(`   Email: ${systemAdmin[0].email}`);
      console.log(`   Role: ${systemAdmin[0].role}\n`);
    }

    console.log('⚠️  LƯU Ý: Cần regenerate Prisma Client sau khi cập nhật:\n   npx prisma generate\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSystemAdminRole();






