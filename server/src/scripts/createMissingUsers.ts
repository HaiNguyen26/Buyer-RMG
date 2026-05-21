import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

/**
 * Script tạo các user test để kiểm tra flow hệ thống
 * 
 * LƯU Ý: Đây chỉ là các tài khoản TEST với username đơn giản.
 * Khi import từ Excel sẽ có:
 * - employee_code thực tế (dùng làm username)
 * - direct_manager_code map với employee_code của quản lý
 * - department_code từ Excel
 * 
 * Các user test này được setup với directManagerCode để test flow:
 * requestor -> department_head -> branch_manager -> bgd
 */

const prisma = new PrismaClient();

interface UserToCreate {
  username: string;
  email: string;
  role: string;
  location: string;
  department?: string;
  directManagerCode?: string;
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
    department: 'IT',
    directManagerCode: 'department_head', // Trỏ đến quản lý trực tiếp
  },
  {
    username: 'department_head',
    email: 'department_head@rmg.vn',
    role: 'DEPARTMENT_HEAD',
    location: 'HCM',
    department: 'IT',
    directManagerCode: 'branch_manager', // Trỏ đến GĐ chi nhánh
  },
  {
    username: 'branch_manager',
    email: 'branch_manager@rmg.vn',
    role: 'BRANCH_MANAGER',
    location: 'HCM',
    directManagerCode: 'bgd', // Trỏ đến Tổng giám đốc
  },
  {
    username: 'buyer_manager',
    email: 'buyer_manager@rmg.vn',
    role: 'BUYER_MANAGER',
    location: 'HCM',
  },
  {
    username: 'accountant',
    email: 'accountant@rmg.vn',
    role: 'ACCOUNTANT',
    location: 'HCM',
  },
  {
    username: 'warehouse',
    email: 'warehouse@rmg.vn',
    role: 'WAREHOUSE',
    location: 'HCM',
  },
  {
    username: 'bgd',
    email: 'bgd@rmg.vn',
    role: 'BGD',
    location: 'HCM',
  },
  {
    username: 'system_admin',
    email: 'system_admin@rmg.vn',
    role: 'SYSTEM_ADMIN',
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

        // Reset password and update department/directManagerCode if provided
        console.log(`   🔄 Resetting password to ${defaultPassword}...`);
        const updateData: any = { passwordHash };
        if (userData.department !== undefined) {
          updateData.department = userData.department;
        }
        if (userData.directManagerCode !== undefined) {
          updateData.directManagerCode = userData.directManagerCode;
        }
        await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
        console.log(`   ✅ Password reset${userData.department ? `, department: ${userData.department}` : ''}${userData.directManagerCode ? `, directManagerCode: ${userData.directManagerCode}` : ''}`);
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
            department: userData.department || null,
            directManagerCode: userData.directManagerCode || null,
            companyId: null,
          },
        });

        console.log(`   ✅ Created user "${userData.username}":`);
        console.log(`      - ID: ${newUser.id}`);
        console.log(`      - Email: ${newUser.email}`);
        console.log(`      - Role: ${newUser.role}`);
        console.log(`      - Location: ${newUser.location}`);
        if (newUser.department) console.log(`      - Department: ${newUser.department}`);
        if (newUser.directManagerCode) console.log(`      - Direct Manager Code: ${newUser.directManagerCode}`);
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


