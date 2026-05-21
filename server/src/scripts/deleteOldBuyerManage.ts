import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteOldUser() {
  try {
    console.log('\n🗑️  Deleting old buyer_manage user...\n');

    // Find the user first
    const user = await prisma.user.findFirst({
      where: { username: 'buyer_manage' },
    });

    if (!user) {
      console.log('ℹ️  User buyer_manage not found (already deleted)\n');
      return;
    }

    const result = await prisma.user.delete({
      where: { id: user.id },
    });

    console.log('✅ Deleted:');
    console.log(`   Username: ${result.username}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Role: ${result.role}\n`);

    console.log('✅ Cleanup complete!\n');
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.log('ℹ️  User buyer_manage not found (already deleted)\n');
    } else {
      console.error('❌ Error:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

deleteOldUser();
