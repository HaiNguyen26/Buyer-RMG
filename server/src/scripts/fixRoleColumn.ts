import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để sửa cột role trong bảng users từ Role_old sang Role mới
 */
async function fixRoleColumn() {
  try {
    console.log('\n🔧 Sửa cột role trong bảng users...\n');

    // Bước 1: Kiểm tra enum hiện tại
    const enumCheck = await prisma.$queryRawUnsafe<Array<{typname: string}>>(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('Role', 'Role_old', 'Role_new')
      ORDER BY typname
    `);

    console.log('📋 Các enum hiện có:');
    enumCheck.forEach((row) => {
      console.log(`   - ${row.typname}`);
    });

    // Bước 2: Kiểm tra kiểu dữ liệu của cột role
    const columnCheck = await prisma.$queryRawUnsafe<Array<{data_type: string; udt_name: string}>>(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (columnCheck.length > 0) {
      console.log(`\n📋 Kiểu dữ liệu hiện tại của cột role: ${columnCheck[0].udt_name}`);
    }

    // Bước 3: Cập nhật kiểu dữ liệu của cột role
    console.log('\n📝 Bước 3: Cập nhật kiểu dữ liệu của cột role...');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Kiểm tra xem có enum Role không
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
          -- Bước 1: Xóa default value
          ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
          RAISE NOTICE 'Dropped default value';
          
          -- Bước 2: Cập nhật kiểu dữ liệu của cột role
          ALTER TABLE users ALTER COLUMN role TYPE "Role" USING role::text::"Role";
          RAISE NOTICE 'Updated users.role column to use Role enum';
          
          -- Bước 3: Set lại default value
          ALTER TABLE users ALTER COLUMN role SET DEFAULT 'REQUESTOR'::"Role";
          RAISE NOTICE 'Set default value to REQUESTOR';
        ELSE
          RAISE EXCEPTION 'Role enum does not exist';
        END IF;

        -- Xóa enum Role_old nếu tồn tại và không còn được sử dụng
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_old') THEN
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

    console.log('✅ Đã cập nhật kiểu dữ liệu của cột role\n');

    // Bước 4: Kiểm tra lại
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

fixRoleColumn();

