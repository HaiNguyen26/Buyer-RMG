import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để migrate dữ liệu và sửa cột role - phiên bản cuối cùng
 */
async function fixRoleColumnFinal() {
  try {
    console.log('\n🔧 Migrate dữ liệu và sửa cột role (Final)...\n');

    // Bước 1: Kiểm tra tất cả users và migrate role không hợp lệ
    console.log('📝 Bước 1: Kiểm tra và migrate dữ liệu...');
    
    const allUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string; role: string}>>(`
      SELECT id, username, role::text as role
      FROM users 
      WHERE deleted_at IS NULL
    `);

    console.log(`📋 Tìm thấy ${allUsers.length} tài khoản`);

    // Migrate các role không hợp lệ
    const invalidRoles = ['SYSTEM_ADMIN', 'SALES', 'TEAM_LEAD', 'DEPT_MANAGER', 'BRANCH_DIRECTOR'];
    
    for (const invalidRole of invalidRoles) {
      const count = await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = CASE 
          WHEN role::text = 'SYSTEM_ADMIN' OR role::text = 'SALES' OR role::text = 'TEAM_LEAD' OR role::text = 'DEPT_MANAGER' 
          THEN 'DEPARTMENT_HEAD'::"Role_old"
          WHEN role::text = 'BRANCH_DIRECTOR' 
          THEN 'BRANCH_MANAGER'::"Role_old"
          ELSE role
        END
        WHERE role::text = $1::text
        AND deleted_at IS NULL
      `, invalidRole);
      
      if (count > 0) {
        console.log(`   ✅ Đã migrate ${count} tài khoản từ ${invalidRole}`);
      }
    }

    // Bước 2: Xóa default value
    console.log('\n📝 Bước 2: Xóa default value...');
    await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT;`);
    console.log('✅ Đã xóa default value');

    // Bước 3: Cập nhật kiểu dữ liệu với CASE để handle các giá trị không hợp lệ
    console.log('\n📝 Bước 3: Cập nhật kiểu dữ liệu của cột role...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role TYPE "Role" USING (
        CASE role::text
          WHEN 'SYSTEM_ADMIN' THEN 'DEPARTMENT_HEAD'::"Role"
          WHEN 'SALES' THEN 'DEPARTMENT_HEAD'::"Role"
          WHEN 'TEAM_LEAD' THEN 'DEPARTMENT_HEAD'::"Role"
          WHEN 'DEPT_MANAGER' THEN 'DEPARTMENT_HEAD'::"Role"
          WHEN 'BRANCH_DIRECTOR' THEN 'BRANCH_MANAGER'::"Role"
          ELSE role::text::"Role"
        END
      );
    `);
    console.log('✅ Đã cập nhật kiểu dữ liệu');

    // Bước 4: Set lại default value
    console.log('\n📝 Bước 4: Set lại default value...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role SET DEFAULT 'REQUESTOR'::"Role";
    `);
    console.log('✅ Đã set lại default value');

    // Bước 5: Cập nhật bảng role_permissions (nếu có)
    console.log('\n📝 Bước 5: Cập nhật bảng role_permissions...');
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE role_permissions ALTER COLUMN role TYPE "Role" USING (
          CASE role::text
            WHEN 'SYSTEM_ADMIN' THEN 'DEPARTMENT_HEAD'::"Role"
            WHEN 'SALES' THEN 'DEPARTMENT_HEAD'::"Role"
            WHEN 'TEAM_LEAD' THEN 'DEPARTMENT_HEAD'::"Role"
            WHEN 'DEPT_MANAGER' THEN 'DEPARTMENT_HEAD'::"Role"
            WHEN 'BRANCH_DIRECTOR' THEN 'BRANCH_MANAGER'::"Role"
            ELSE role::text::"Role"
          END
        );
      `);
      console.log('✅ Đã cập nhật bảng role_permissions');
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('ℹ️  Bảng role_permissions không tồn tại, bỏ qua');
      } else {
        throw error;
      }
    }

    // Bước 6: Xóa enum Role_old
    console.log('\n📝 Bước 6: Xóa enum Role_old...');
    await prisma.$executeRawUnsafe(`
      DROP TYPE IF EXISTS "Role_old" CASCADE;
    `);
    console.log('✅ Đã xóa enum Role_old');

    // Kiểm tra kết quả
    const finalCheck = await prisma.$queryRawUnsafe<Array<{data_type: string; udt_name: string}>>(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (finalCheck.length > 0) {
      console.log(`\n📋 Kiểu dữ liệu sau khi cập nhật: ${finalCheck[0].udt_name}`);
    }

    const roleCounts = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      GROUP BY role::text
      ORDER BY role::text
    `);

    console.log('\n📋 Các role sau khi migrate:');
    roleCounts.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} tài khoản`);
    });

    console.log('\n✅ Hoàn thành!\n');

  } catch (error: any) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRoleColumnFinal();

