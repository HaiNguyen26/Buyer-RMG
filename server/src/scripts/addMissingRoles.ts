import 'dotenv/config';
import { prisma } from '../utils/prisma';

const rolesToAdd = [
  'DEPARTMENT_HEAD',
  'BRANCH_DIRECTOR',
  'WAREHOUSE',
  'SYSTEM_ADMIN',
] as const;

async function addMissingRoles() {
  try {
    console.log('\n🔄 Adding missing Role enum values...\n');

    for (const role of rolesToAdd) {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
            AND enumlabel = '${role}'
          ) THEN
            ALTER TYPE "Role" ADD VALUE '${role}';
            RAISE NOTICE 'Added ${role} to Role enum';
          ELSE
            RAISE NOTICE '${role} already exists in Role enum';
          END IF;
        END $$;
      `);
    }

    const roles = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
      ORDER BY enumsortorder
    `);

    console.log('📋 Current Role enum values:');
    roles.forEach((r) => console.log(`   - ${r.enumlabel}`));
    console.log('\n✅ Done.\n');
  } catch (error) {
    console.error('❌ Failed to add roles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addMissingRoles();
