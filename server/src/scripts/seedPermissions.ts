import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { initializePermissions } from '../utils/permissions';

// Load .env
dotenv.config();

async function seedPermissions() {
  try {
    console.log('🌱 Starting permission seeding...');

    // Initialize default permissions
    await initializePermissions();

    console.log('✅ Permissions seeded successfully!');

    // Show summary
    const permissions = await prisma.permission.findMany();

    console.log(`\n📊 Summary:`);
    console.log(`   Total permissions: ${permissions.length}`);

    const roleCounts = await prisma.rolePermission.groupBy({
      by: ['role'],
      _count: true,
    });

    console.log(`\n📋 Permissions per role:`);
    roleCounts.forEach((rc) => {
      console.log(`   ${rc.role}: ${rc._count} permissions`);
    });
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedPermissions();

