import 'dotenv/config';
import { prisma } from '../config/database';

async function clearUsers() {
  console.log('\n🗑️  ========== CLEAR USERS ==========');
  console.log('⚠️  WARNING: This will delete ALL users except system_admin!');
  console.log('⚠️  This action cannot be undone!\n');

  try {
    // Check system_admin exists
    const systemAdmin = await prisma.user.findFirst({
      where: {
        username: 'system_admin',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (!systemAdmin) {
      console.log('⚠️  Warning: system_admin not found. Will delete ALL users.');
    } else {
      console.log(`✅ Found system_admin: ${systemAdmin.username} (ID: ${systemAdmin.id})`);
      console.log('   This user will be kept.\n');
    }

    // Count users before deletion
    const totalUsers = await prisma.user.count({
      where: { deletedAt: null },
    });

    const usersToDelete = systemAdmin
      ? await prisma.user.count({
          where: {
            NOT: {
              username: 'system_admin',
            },
            deletedAt: null,
          },
        })
      : totalUsers;

    console.log(`📊 Total users: ${totalUsers}`);
    console.log(`📊 Users to delete: ${usersToDelete}`);
    console.log(`📊 Users to keep: ${systemAdmin ? 1 : 0}\n`);

    if (usersToDelete === 0) {
      console.log('✅ No users to delete. Exiting.');
      await prisma.$disconnect();
      return;
    }

    // Delete users (hard delete)
    if (systemAdmin) {
      const result = await prisma.user.deleteMany({
        where: {
          NOT: {
            username: 'system_admin',
          },
        },
      });
      console.log(`✅ Deleted ${result.count} users (kept system_admin)`);
    } else {
      const result = await prisma.user.deleteMany({});
      console.log(`✅ Deleted ${result.count} users`);
    }

    // Verify deletion
    const remainingUsers = await prisma.user.count({
      where: { deletedAt: null },
    });

    console.log(`\n📊 Remaining users: ${remainingUsers}`);
    
    if (systemAdmin && remainingUsers === 1) {
      console.log('✅ Only system_admin remains. Ready for fresh import!');
    } else if (!systemAdmin && remainingUsers === 0) {
      console.log('✅ All users deleted. Ready for fresh import!');
    } else {
      console.log(`⚠️  Unexpected: ${remainingUsers} users remain`);
    }

    console.log('\n📊 ========== SUMMARY ==========');
    console.log('✅ Users cleared successfully!');
    console.log('✅ Ready for fresh data import from Excel');
    console.log('📊 =================================\n');

  } catch (error: any) {
    console.error('\n❌ Error clearing users:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearUsers()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });




