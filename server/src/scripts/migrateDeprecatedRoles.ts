import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để migrate các role không còn sử dụng:
 * - DEPT_MANAGER → DEPARTMENT_HEAD
 * - TEAM_LEAD → DEPARTMENT_HEAD (nếu có)
 * - BRANCH_DIRECTOR → BRANCH_MANAGER (nếu có)
 * - SALES → có thể xóa hoặc giữ lại tùy quyết định
 * - SYSTEM_ADMIN → có thể xóa hoặc giữ lại tùy quyết định
 */
async function migrateDeprecatedRoles() {
  try {
    console.log('\n🔄 Bắt đầu migrate các role không còn sử dụng...\n');

    // 1. Migrate DEPT_MANAGER → DEPARTMENT_HEAD
    const deptManagerUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string}>>(`
      SELECT id, username
      FROM users 
      WHERE role::text = 'DEPT_MANAGER' 
      AND deleted_at IS NULL
    `);

    if (deptManagerUsers.length > 0) {
      console.log(`📋 Tìm thấy ${deptManagerUsers.length} tài khoản có role DEPT_MANAGER:`);
      deptManagerUsers.forEach((user) => {
        console.log(`   - ${user.username}`);
      });

      await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = 'DEPARTMENT_HEAD'::"Role"
        WHERE role::text = 'DEPT_MANAGER' 
        AND deleted_at IS NULL
      `);

      console.log(`✅ Đã migrate ${deptManagerUsers.length} tài khoản từ DEPT_MANAGER → DEPARTMENT_HEAD\n`);
    } else {
      console.log('ℹ️  Không có tài khoản nào có role DEPT_MANAGER\n');
    }

    // 2. Migrate TEAM_LEAD → DEPARTMENT_HEAD (nếu có)
    const teamLeadUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string}>>(`
      SELECT id, username
      FROM users 
      WHERE role::text = 'TEAM_LEAD' 
      AND deleted_at IS NULL
    `);

    if (teamLeadUsers.length > 0) {
      console.log(`📋 Tìm thấy ${teamLeadUsers.length} tài khoản có role TEAM_LEAD:`);
      teamLeadUsers.forEach((user) => {
        console.log(`   - ${user.username}`);
      });

      await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = 'DEPARTMENT_HEAD'::"Role"
        WHERE role::text = 'TEAM_LEAD' 
        AND deleted_at IS NULL
      `);

      console.log(`✅ Đã migrate ${teamLeadUsers.length} tài khoản từ TEAM_LEAD → DEPARTMENT_HEAD\n`);
    } else {
      console.log('ℹ️  Không có tài khoản nào có role TEAM_LEAD\n');
    }

    // 3. Migrate BRANCH_DIRECTOR → BRANCH_MANAGER (nếu có)
    const branchDirectorUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string}>>(`
      SELECT id, username
      FROM users 
      WHERE role::text = 'BRANCH_DIRECTOR' 
      AND deleted_at IS NULL
    `);

    if (branchDirectorUsers.length > 0) {
      console.log(`📋 Tìm thấy ${branchDirectorUsers.length} tài khoản có role BRANCH_DIRECTOR:`);
      branchDirectorUsers.forEach((user) => {
        console.log(`   - ${user.username}`);
      });

      await prisma.$executeRawUnsafe(`
        UPDATE users 
        SET role = 'BRANCH_MANAGER'::"Role"
        WHERE role::text = 'BRANCH_DIRECTOR' 
        AND deleted_at IS NULL
      `);

      console.log(`✅ Đã migrate ${branchDirectorUsers.length} tài khoản từ BRANCH_DIRECTOR → BRANCH_MANAGER\n`);
    } else {
      console.log('ℹ️  Không có tài khoản nào có role BRANCH_DIRECTOR\n');
    }

    // 4. Kiểm tra SALES và SYSTEM_ADMIN
    const salesUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string}>>(`
      SELECT id, username
      FROM users 
      WHERE role::text = 'SALES' 
      AND deleted_at IS NULL
    `);

    if (salesUsers.length > 0) {
      console.log(`⚠️  Tìm thấy ${salesUsers.length} tài khoản có role SALES (không có trong danh sách role cần thiết):`);
      salesUsers.forEach((user) => {
        console.log(`   - ${user.username}`);
      });
      console.log('   ⚠️  Không migrate SALES - cần quyết định xóa hoặc giữ lại\n');
    }

    const systemAdminUsers = await prisma.$queryRawUnsafe<Array<{id: string; username: string}>>(`
      SELECT id, username
      FROM users 
      WHERE role::text = 'SYSTEM_ADMIN' 
      AND deleted_at IS NULL
    `);

    if (systemAdminUsers.length > 0) {
      console.log(`⚠️  Tìm thấy ${systemAdminUsers.length} tài khoản có role SYSTEM_ADMIN (không có trong danh sách role cần thiết):`);
      systemAdminUsers.forEach((user) => {
        console.log(`   - ${user.username}`);
      });
      console.log('   ⚠️  Không migrate SYSTEM_ADMIN - cần quyết định xóa hoặc giữ lại\n');
    }

    // Kiểm tra kết quả
    const finalRoles = await prisma.$queryRawUnsafe<Array<{role: string; count: number}>>(`
      SELECT role::text as role, COUNT(*) as count
      FROM users 
      WHERE deleted_at IS NULL
      GROUP BY role::text
      ORDER BY role::text
    `);

    console.log('📋 Các role còn lại sau khi migrate:');
    finalRoles.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} tài khoản`);
    });

    console.log('\n✅ Hoàn thành migrate!\n');

  } catch (error: any) {
    console.error('❌ Lỗi khi migrate:', error);
    if (error.message?.includes('does not exist')) {
      console.error('   ⚠️  Có thể enum Role trong PostgreSQL chưa được cập nhật. Hãy chạy migration trước.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateDeprecatedRoles();







