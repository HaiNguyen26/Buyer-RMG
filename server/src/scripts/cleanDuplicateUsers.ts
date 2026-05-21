import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicateUsers() {
  try {
    console.log('\n🔍 Checking all users in database...\n');

    const allUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    console.log(`📋 Total users: ${allUsers.length}\n`);

    // Group by username
    const usersByUsername = new Map<string, typeof allUsers>();
    allUsers.forEach((user) => {
      const existing = usersByUsername.get(user.username) || [];
      existing.push(user);
      usersByUsername.set(user.username, existing);
    });

    // Find duplicates
    const duplicates: string[] = [];
    usersByUsername.forEach((users, username) => {
      if (users.length > 1) {
        duplicates.push(username);
        console.log(`⚠️  Duplicate username: ${username} (${users.length} copies)`);
        users.forEach((u, i) => {
          console.log(`   ${i + 1}. ID: ${u.id}, Role: ${u.role}, Created: ${u.createdAt.toISOString()}`);
        });
        console.log('');
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!\n');
      return;
    }

    console.log(`\n🗑️  Cleaning duplicates (keeping oldest)...\n`);

    for (const username of duplicates) {
      const users = usersByUsername.get(username)!;
      // Keep oldest, delete rest
      const [keep, ...toDelete] = users;

      console.log(`📌 Keeping: ${keep.username} (${keep.role}, ${keep.id})`);

      for (const user of toDelete) {
        await prisma.user.delete({ where: { id: user.id } });
        console.log(`   ❌ Deleted: ${user.id} (${user.role})`);
      }
      console.log('');
    }

    console.log('✅ Cleanup complete!\n');

    // List final users
    const finalUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { username: 'asc' },
      select: { username: true, email: true, role: true },
    });

    console.log('📝 Final user list:');
    finalUsers.forEach((u) => {
      console.log(`   - ${u.username.padEnd(20)} | ${u.role.padEnd(20)} | ${u.email}`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateUsers();
