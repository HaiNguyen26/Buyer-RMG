import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkCurrentRoles() {
  try {
    console.log('\n🔍 Kiểm tra các role hiện tại trong database...\n');

    // Get all unique roles from database
    const rolesResult = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      GROUP BY role::text
      ORDER BY role::text
    `);

    console.log('📋 Các role đang được sử dụng trong database:');
    rolesResult.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} tài khoản`);
    });

    // Get all enum values from PostgreSQL
    const enumValues = await prisma.$queryRawUnsafe<Array<{enumlabel: string}>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
      ORDER BY enumsortorder
    `);

    console.log(`\n📋 Các giá trị trong enum Role (PostgreSQL):`);
    enumValues.forEach((row) => {
      console.log(`   - ${row.enumlabel}`);
    });

    console.log('\n✅ Hoàn thành kiểm tra!\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentRoles();







