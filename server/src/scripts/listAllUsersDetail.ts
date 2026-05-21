import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllUsers() {
  try {
    console.log('\n📋 ========== ALL USERS IN DATABASE ==========\n');

    const allUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Total: ${allUsers.length} users\n`);

    allUsers.forEach((user, i) => {
      console.log(`${i + 1}. Username: ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Full Name: ${user.fullName || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Location: ${user.location || 'N/A'}`);
      console.log(`   Department: ${user.department || 'N/A'}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log('');
    });

    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

listAllUsers();
