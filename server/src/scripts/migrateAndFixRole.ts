import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để migrate dữ liệu và sửa cột role
 */
async function migrateAndFixRole() {
  try {
    console.log('\n🔧 Migrate dữ liệu và sửa cột role...\n');

    // Bước 1: Kiểm tra các giá trị role không hợp lệ
    const invalidRoles = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      AND role::text NOT IN ('REQUESTOR', 'DEPARTMENT_HEAD', 'BRANCH_MANAGER', 'BUYER', 'BUYER_LEADER', 'BUYER_MANAGER', 'ACCOUNTANT', 'WAREHOUSE', 'BGD')
      GROUP BY role::text
    `);

    if (invalidRoles.length > 0) {
      console.log('⚠️  Tìm thấy các role không hợp lệ:');
      invalidRoles.forEach((row) => {
        console.log(`   - ${row.role}: ${row.count} tài khoản`);
      });

      // Migrate các role không hợp lệ
      console.log('\n📝 Migrate các role không hợp lệ...');

      // SYSTEM_ADMIN, SALES, TEAM_LEAD, DEPT_MANAGER → DEPARTMENT_HEAD (hoặc xóa)
      // BRANCH_DIRECTOR → BRANCH_MANAGER
      
      await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = 'DEPARTMENT_HEAD'::"Role_old"
        WHERE role::text IN ('SYSTEM_ADMIN', 'SALES', 'TEAM_LEAD', 'DEPT_MANAGER')
        AND deleted_at IS NULL;
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = 'BRANCH_MANAGER'::"Role_old"
        WHERE role::text = 'BRANCH_DIRECTOR'
        AND deleted_at IS NULL;
      `);

      console.log('✅ Đã migrate các role không hợp lệ\n');
    } else {
      console.log('✅ Không có role không hợp lệ\n');
    }

    // Bước 2: Xóa default value
    console.log('📝 Bước 2: Xóa default value...');
    await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT;`);
    console.log('✅ Đã xóa default value\n');

    // Bước 3: Cập nhật kiểu dữ liệu
    console.log('📝 Bước 3: Cập nhật kiểu dữ liệu của cột role...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role TYPE "Role" USING role::text::"Role";
    `);
    console.log('✅ Đã cập nhật kiểu dữ liệu\n');

    // Bước 4: Set lại default value
    console.log('📝 Bước 4: Set lại default value...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role SET DEFAULT 'REQUESTOR'::"Role";
    `);
    console.log('✅ Đã set lại default value\n');

    // Bước 5: Xóa enum Role_old
    console.log('📝 Bước 5: Xóa enum Role_old...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_old') THEN
          DROP TYPE "Role_old";
          RAISE NOTICE 'Dropped Role_old enum';
        END IF;
      END $$;
    `);
    console.log('✅ Đã xóa enum Role_old\n');

    // Kiểm tra kết quả
    const finalCheck = await prisma.$queryRawUnsafe<Array<{data_type: string; udt_name: string}>>(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (finalCheck.length > 0) {
      console.log(`📋 Kiểu dữ liệu sau khi cập nhật: ${finalCheck[0].udt_name}`);
    }

    console.log('\n✅ Hoàn thành!\n');

  } catch (error: any) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAndFixRole();







