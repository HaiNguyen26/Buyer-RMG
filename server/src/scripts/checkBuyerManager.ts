import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

async function checkBuyerManager() {
  try {
    console.log('🔍 Checking buyer_manager user...\n');

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        username: 'buyer_manager',
      },
    });

    if (!user) {
      console.log('❌ User "buyer_manager" NOT FOUND in database');
      console.log('\n📝 Creating buyer_manager user...');
      
      const passwordHash = await hashPassword('RMG123@');
      const newUser = await prisma.user.create({
        data: {
          username: 'buyer_manager',
          email: 'buyer_manager@rmg.vn',
          passwordHash,
          role: 'BUYER_MANAGER',
          location: 'HCM',
          companyId: null,
        },
      });

      console.log('✅ Created buyer_manager user:');
      console.log('   - ID:', newUser.id);
      console.log('   - Username:', newUser.username);
      console.log('   - Email:', newUser.email);
      console.log('   - Role:', newUser.role);
      console.log('   - Location:', newUser.location);
      console.log('   - Password: RMG123@');
    } else {
      console.log('✅ User "buyer_manager" FOUND:');
      console.log('   - ID:', user.id);
      console.log('   - Username:', user.username);
      console.log('   - Email:', user.email);
      console.log('   - Role:', user.role);
      console.log('   - Location:', user.location);
      console.log('   - Deleted At:', user.deletedAt || 'Not deleted');
      console.log('   - Has Password Hash:', !!user.passwordHash);
      console.log('   - Password Hash Length:', user.passwordHash?.length || 0);

      if (user.deletedAt) {
        console.log('\n⚠️ User is SOFT-DELETED. Restoring...');
        await prisma.user.update({
          where: { id: user.id },
          data: { deletedAt: null },
        });
        console.log('✅ User restored (deletedAt set to null)');
      }

      // Reset password
      console.log('\n🔄 Resetting password to RMG123@...');
      const passwordHash = await hashPassword('RMG123@');
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      console.log('✅ Password reset successfully');
      console.log('   - New password: RMG123@');
    }

    console.log('\n✅ Done!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBuyerManager();


