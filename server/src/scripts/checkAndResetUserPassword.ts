import 'dotenv/config';
import { prisma } from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';

async function checkAndResetUserPassword() {
  const username = process.argv[2] || 'requestor';
  const newPassword = process.argv[3] || 'RMG123@';

  try {
    console.log('\n🔍 ========== CHECK USER PASSWORD ==========');
    console.log('🔍 Username:', username);
    console.log('🔍 New password:', newPassword);

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    if (!user) {
      console.log('❌ User not found or deleted');
      process.exit(1);
    }

    console.log('\n✅ User found:');
    console.log('   ID:', user.id);
    console.log('   Username:', user.username);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Has password hash:', !!user.passwordHash);
    console.log('   Password hash length:', user.passwordHash?.length || 0);
    console.log('   Deleted at:', user.deletedAt);

    // Test current password
    if (user.passwordHash) {
      console.log('\n🔐 Testing password verification...');
      const isValid = await verifyPassword(user.passwordHash, newPassword);
      console.log('   Current password matches:', isValid ? '✅ YES' : '❌ NO');
    }

    // Reset password
    console.log('\n🔄 Resetting password...');
    const newPasswordHash = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    console.log('✅ Password reset successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Username:', username);
    console.log('   Password:', newPassword);
    console.log('\n🔍 =========================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAndResetUserPassword();




