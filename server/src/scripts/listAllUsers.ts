import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function listAllUsers() {
  try {
    console.log('\n📋 Danh sách tất cả tài khoản trong hệ thống...\n');

    const users = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
      location: string | null;
      department: string | null;
      created_at: Date;
    }>>(`
      SELECT id, username, email, role::text as role, location, department, created_at
      FROM users 
      WHERE deleted_at IS NULL
      ORDER BY username
    `);

    if (users.length === 0) {
      console.log('❌ Không có tài khoản nào trong hệ thống!\n');
      return;
    }

    console.log(`✅ Tìm thấy ${users.length} tài khoản:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Location: ${user.location || 'N/A'}`);
      console.log(`   Department: ${user.department || 'N/A'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });

    // Tổng hợp theo role
    const roleCounts = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      GROUP BY role::text
      ORDER BY role::text
    `);

    console.log('📊 Tổng hợp theo role:');
    roleCounts.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} tài khoản`);
    });

    console.log('\n✅ Hoàn thành!\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllUsers();







