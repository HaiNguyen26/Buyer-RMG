import 'dotenv/config';
import { prisma } from '../config/database';

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        username: true,
        email: true,
        role: true,
      },
      orderBy: { username: 'asc' },
    });

    console.log('\n📋 ========== DANH SÁCH USERS ==========');
    console.log(`Tổng số: ${users.length} users\n`);
    
    users.forEach((u, index) => {
      console.log(`${index + 1}. Username: ${u.username}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Role: ${u.role}`);
      console.log('');
    });

    console.log('📋 ======================================\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUsers();




