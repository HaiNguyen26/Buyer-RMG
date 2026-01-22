import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

interface UserToCreate {
  username: string;
  email: string;
  role: string;
  location: string;
}

const usersToCreate: UserToCreate[] = [
  {
    username: 'buyer',
    email: 'buyer@rmg.vn',
    role: 'BUYER',
    location: 'HCM',
  },
  {
    username: 'buyer_leader',
    email: 'buyer_leader@rmg.vn',
    role: 'BUYER_LEADER',
    location: 'HCM',
  },
  {
    username: 'requestor',
    email: 'requestor@rmg.vn',
    role: 'REQUESTOR',
    location: 'HCM',
  },
  {
    username: 'department_head',
    email: 'department_head@rmg.vn',
    role: 'DEPARTMENT_HEAD',
    location: 'HCM',
  },
];

async function createMissingUsers() {
  try {
    console.log('🔍 ========== CHECKING AND CREATING MISSING USERS ==========\n');
    const defaultPassword = 'RMG123@';
    const passwordHash = await hashPassword(defaultPassword);

    for (const userData of usersToCreate) {
      console.log(`\n📋 Checking user: ${userData.username}...`);

      // Check if user exists (including soft-deleted)
      const existingUser = await prisma.user.findFirst({
        where: {
          username: userData.username,
        },
      });

      if (existingUser) {
        console.log(`   ✅ User "${userData.username}" EXISTS`);
        console.log(`      - ID: ${existingUser.id}`);
        console.log(`      - Email: ${existingUser.email}`);
        console.log(`      - Role: ${existingUser.role}`);
        console.log(`      - Location: ${existingUser.location}`);
        console.log(`      - Deleted At: ${existingUser.deletedAt || 'Not deleted'}`);

        // If soft-deleted, restore it
        if (existingUser.deletedAt) {
          console.log(`   🔄 Restoring soft-deleted user...`);
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { deletedAt: null },
          });
          console.log(`   ✅ User restored`);
        }

        // Reset password
        console.log(`   🔄 Resetting password to ${defaultPassword}...`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { passwordHash },
        });
        console.log(`   ✅ Password reset`);
      } else {
        console.log(`   ❌ User "${userData.username}" NOT FOUND`);
        console.log(`   📝 Creating new user...`);

        const newUser = await prisma.user.create({
          data: {
            username: userData.username,
            email: userData.email,
            passwordHash,
            role: userData.role as any,
            location: userData.location,
            companyId: null,
          },
        });

        console.log(`   ✅ Created user "${userData.username}":`);
        console.log(`      - ID: ${newUser.id}`);
        console.log(`      - Email: ${newUser.email}`);
        console.log(`      - Role: ${newUser.role}`);
        console.log(`      - Location: ${newUser.location}`);
        console.log(`      - Password: ${defaultPassword}`);
      }
    }

    console.log('\n\n📝 ========== LOGIN CREDENTIALS ==========');
    console.log('All users have password: RMG123@\n');
    usersToCreate.forEach((user) => {
      console.log(`   Username: ${user.username.padEnd(20)} | Role: ${user.role}`);
    });
    console.log('\n✅ =========================================\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingUsers();


