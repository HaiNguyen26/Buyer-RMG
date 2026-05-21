import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateRequestorDepartment() {
  try {
    console.log('\n📝 Updating requestor user department...\n');

    // Find user first
    const user = await prisma.user.findFirst({
      where: { username: 'requestor' },
    });

    if (!user) {
      console.log('❌ User requestor not found\n');
      return;
    }

    // Find department_head to set as direct manager
    const departmentHead = await prisma.user.findFirst({
      where: { username: 'department_head', deletedAt: null },
    });

    const result = await prisma.user.update({
      where: { id: user.id },
      data: {
        department: 'IT',
        directManagerCode: departmentHead ? 'department_head' : null,
      },
    });

    console.log('✅ Updated:');
    console.log(`   Username: ${result.username}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Role: ${result.role}`);
    console.log(`   Department: ${result.department}`);
    console.log(`   Direct Manager Code: ${result.directManagerCode || 'null'}\n`);

    console.log('✅ Update complete!\n');
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateRequestorDepartment();
