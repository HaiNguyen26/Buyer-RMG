import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để cập nhật enum Role trong PostgreSQL:
 * - Xóa các role không cần: TEAM_LEAD, DEPT_MANAGER, BRANCH_DIRECTOR, SALES, SYSTEM_ADMIN
 * - Giữ lại: REQUESTOR, DEPARTMENT_HEAD, BRANCH_MANAGER, BUYER, BUYER_LEADER, BUYER_MANAGER, ACCOUNTANT, WAREHOUSE, BGD
 * 
 * Lưu ý: PostgreSQL không hỗ trợ DROP VALUE trong enum, nên cần tạo enum mới và migrate dữ liệu
 */
async function updateRoleEnum() {
  try {
    console.log('\n🔄 Bắt đầu cập nhật enum Role trong PostgreSQL...\n');

    // Bước 1: Tạo enum mới với các role cần thiết
    console.log('📝 Bước 1: Tạo enum Role_new với các role cần thiết...');
    
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Kiểm tra xem enum Role_new đã tồn tại chưa
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_new') THEN
          CREATE TYPE "Role_new" AS ENUM (
            'REQUESTOR',
            'DEPARTMENT_HEAD',
            'BRANCH_MANAGER',
            'BUYER',
            'BUYER_LEADER',
            'BUYER_MANAGER',
            'ACCOUNTANT',
            'WAREHOUSE',
            'BGD'
          );
          RAISE NOTICE 'Created Role_new enum';
        ELSE
          RAISE NOTICE 'Role_new enum already exists';
        END IF;
      END $$;
    `);

    console.log('✅ Đã tạo enum Role_new\n');

    // Bước 2: Migrate dữ liệu
    console.log('📝 Bước 2: Migrate dữ liệu từ Role → Role_new...');

    // DEPT_MANAGER → DEPARTMENT_HEAD
    await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET role = 'DEPARTMENT_HEAD'::"Role_new"::text::"Role"
      WHERE role::text = 'DEPT_MANAGER' 
      AND deleted_at IS NULL;
    `);

    // TEAM_LEAD → DEPARTMENT_HEAD
    await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET role = 'DEPARTMENT_HEAD'::"Role_new"::text::"Role"
      WHERE role::text = 'TEAM_LEAD' 
      AND deleted_at IS NULL;
    `);

    // BRANCH_DIRECTOR → BRANCH_MANAGER
    await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET role = 'BRANCH_MANAGER'::"Role_new"::text::"Role"
      WHERE role::text = 'BRANCH_DIRECTOR' 
      AND deleted_at IS NULL;
    `);

    // SALES → Cần quyết định (tạm thời giữ nguyên hoặc xóa)
    // SYSTEM_ADMIN → Cần quyết định (tạm thời giữ nguyên hoặc xóa)

    console.log('✅ Đã migrate dữ liệu\n');

    // Bước 3: Thay thế enum cũ bằng enum mới
    console.log('📝 Bước 3: Thay thế enum Role cũ bằng Role_new...');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Đổi tên enum cũ
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
          ALTER TYPE "Role" RENAME TO "Role_old";
          RAISE NOTICE 'Renamed Role to Role_old';
        END IF;

        -- Đổi tên enum mới thành Role
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_new') THEN
          ALTER TYPE "Role_new" RENAME TO "Role";
          RAISE NOTICE 'Renamed Role_new to Role';
        END IF;

        -- Xóa enum cũ (sau khi đảm bảo không còn sử dụng)
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_old') THEN
          -- Kiểm tra xem có bảng nào còn dùng Role_old không
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE udt_name = 'Role_old'
          ) THEN
            DROP TYPE "Role_old";
            RAISE NOTICE 'Dropped Role_old enum';
          ELSE
            RAISE NOTICE 'Role_old enum still in use, cannot drop';
          END IF;
        END IF;
      END $$;
    `);

    console.log('✅ Đã thay thế enum\n');

    // Bước 4: Kiểm tra kết quả
    console.log('📝 Bước 4: Kiểm tra kết quả...');

    const enumValues = await prisma.$queryRawUnsafe<Array<{enumlabel: string}>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
      ORDER BY enumsortorder
    `);

    console.log('\n📋 Các giá trị trong enum Role (PostgreSQL) sau khi cập nhật:');
    enumValues.forEach((row) => {
      console.log(`   - ${row.enumlabel}`);
    });

    const roleCounts = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      GROUP BY role::text
      ORDER BY role::text
    `);

    console.log('\n📋 Các role đang được sử dụng trong database:');
    roleCounts.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} tài khoản`);
    });

    console.log('\n✅ Hoàn thành cập nhật enum Role!\n');
    console.log('⚠️  LƯU Ý: Cần regenerate Prisma Client sau khi cập nhật:');
    console.log('   npx prisma generate\n');

  } catch (error: any) {
    console.error('❌ Lỗi khi cập nhật enum:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateRoleEnum();







