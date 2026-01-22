import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function addSystemAdminToEnum() {
  try {
    console.log('\n🚀 Thêm SYSTEM_ADMIN vào enum Role...\n');

    // Add SYSTEM_ADMIN to enum Role using raw SQL
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'SYSTEM_ADMIN' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
        ) THEN
          ALTER TYPE "Role" ADD VALUE 'SYSTEM_ADMIN';
          RAISE NOTICE 'Added SYSTEM_ADMIN to Role enum';
        ELSE
          RAISE NOTICE 'SYSTEM_ADMIN already exists in Role enum';
        END IF;
      END $$;
    `);

    // Also add other missing enum values if needed
    const enumValues = [
      'TEAM_LEAD',
      'DEPT_MANAGER', 
      'BRANCH_DIRECTOR',
      'WAREHOUSE',
    ];

    for (const value of enumValues) {
      try {
        await prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = '${value}' 
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
            ) THEN
              ALTER TYPE "Role" ADD VALUE '${value}';
              RAISE NOTICE 'Added ${value} to Role enum';
            END IF;
          END $$;
        `);
      } catch (error: any) {
        // Ignore if already exists
        if (!error.message?.includes('already exists')) {
          console.log(`⚠️  Could not add ${value}:`, error.message);
        }
      }
    }

    console.log('✅ Đã thêm SYSTEM_ADMIN vào enum Role!\n');
    
    // Verify
    const result = await prisma.$queryRawUnsafe<Array<{enumlabel: string}>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
      ORDER BY enumsortorder;
    `);
    
    console.log('📋 Các giá trị trong enum Role:');
    result.forEach((row) => {
      console.log(`   - ${row.enumlabel}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Lỗi khi thêm SYSTEM_ADMIN vào enum:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSystemAdminToEnum();







