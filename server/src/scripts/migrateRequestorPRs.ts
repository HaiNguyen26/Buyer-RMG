import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để migrate PRs từ requestor cũ sang requestor mới
 */
async function migrateRequestorPRs() {
  try {
    console.log('\n🔄 Migrate PRs từ requestor cũ sang requestor mới...\n');

    // Tìm requestor mới
    const newRequestor = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
    }>>(`
      SELECT id, username, email
      FROM users 
      WHERE username = 'requestor' 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (newRequestor.length === 0) {
      console.log('❌ Không tìm thấy requestor mới!\n');
      return;
    }

    const newRequestorId = newRequestor[0].id;
    console.log(`✅ Tìm thấy requestor mới: ${newRequestor[0].username} (ID: ${newRequestorId})\n`);

    // Tìm tất cả PRs có requestor_id khác với requestor mới
    const orphanedPRs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      status: string;
      requestor_id: string;
      requestor_username: string | null;
    }>>(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.status::text as status,
        pr.requestor_id::text as requestor_id,
        u.username as requestor_username
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requestor_id = u.id AND u.deleted_at IS NULL
      WHERE pr.requestor_id::text != $1
      AND pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
    `, newRequestorId);

    console.log(`📋 Tìm thấy ${orphanedPRs.length} PRs cần migrate:\n`);

    if (orphanedPRs.length === 0) {
      console.log('✅ Không có PR nào cần migrate!\n');
      return;
    }

    // Hiển thị danh sách PRs cần migrate
    orphanedPRs.forEach((pr, index) => {
      console.log(`${index + 1}. PR ${pr.pr_number}`);
      console.log(`   Status: ${pr.status}`);
      console.log(`   Requestor ID cũ: ${pr.requestor_id}`);
      console.log(`   Requestor Username: ${pr.requestor_username || 'NULL (user không tồn tại)'}`);
      console.log('');
    });

    // Migrate tất cả PRs sang requestor mới
    console.log(`\n📝 Đang migrate ${orphanedPRs.length} PRs sang requestor mới...\n`);

    const migratedCount = await prisma.$executeRawUnsafe(`
      UPDATE purchase_requests
      SET requestor_id = $1::uuid
      WHERE requestor_id::text != $1
      AND deleted_at IS NULL
    `, newRequestorId);

    console.log(`✅ Đã migrate ${migratedCount} PRs sang requestor mới (${newRequestor[0].username})\n`);

    // Kiểm tra lại
    const finalPRs = await prisma.$queryRawUnsafe<Array<{
      count: number;
    }>>(`
      SELECT COUNT(*) as count
      FROM purchase_requests
      WHERE requestor_id::text = $1
      AND deleted_at IS NULL
    `, newRequestorId);

    console.log(`📊 Tổng số PR của requestor mới sau khi migrate: ${finalPRs[0]?.count || 0}\n`);

    // Kiểm tra các PRs theo status
    const prsByStatus = await prisma.$queryRawUnsafe<Array<{
      status: string;
      count: number;
    }>>(`
      SELECT status::text as status, COUNT(*) as count
      FROM purchase_requests
      WHERE requestor_id::text = $1
      AND deleted_at IS NULL
      GROUP BY status::text
      ORDER BY status::text
    `, newRequestorId);

    console.log('📊 PRs theo status:');
    prsByStatus.forEach((row) => {
      console.log(`   - ${row.status}: ${row.count} PR`);
    });

    console.log('\n✅ Hoàn thành migrate!\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateRequestorPRs();







