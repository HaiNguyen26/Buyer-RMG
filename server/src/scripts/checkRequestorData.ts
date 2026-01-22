import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkRequestorData() {
  try {
    console.log('\n🔍 Kiểm tra dữ liệu PR của requestor...\n');

    // Tìm user requestor
    const requestor = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
    }>>(`
      SELECT id, username, email, role::text as role
      FROM users 
      WHERE username = 'requestor' 
      AND deleted_at IS NULL
      LIMIT 1
    `);

    if (requestor.length === 0) {
      console.log('❌ Không tìm thấy tài khoản requestor!\n');
      return;
    }

    const requestorId = requestor[0].id;
    console.log(`✅ Tìm thấy requestor: ${requestor[0].username} (ID: ${requestorId})\n`);

    // Kiểm tra PRs của requestor này
    const prs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      status: string;
      total_amount: number;
      created_at: Date;
      requestor_id: string;
    }>>(`
      SELECT id, pr_number, status::text as status, total_amount, created_at, requestor_id::text as requestor_id
      FROM purchase_requests
      WHERE requestor_id::text = $1
      AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, requestorId);

    console.log(`📋 Tìm thấy ${prs.length} PR của requestor này:\n`);

    if (prs.length === 0) {
      console.log('⚠️  Không có PR nào được liên kết với requestor hiện tại!\n');
    } else {
      prs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.pr_number}`);
        console.log(`   Status: ${pr.status}`);
        console.log(`   Total Amount: ${pr.total_amount}`);
        console.log(`   Created: ${pr.created_at}`);
        console.log('');
      });
    }

    // Kiểm tra tất cả PRs trong hệ thống (không filter theo requestor)
    const allPRs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      status: string;
      requestor_id: string;
      requestor_username: string | null;
      created_at: Date;
    }>>(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.status::text as status,
        pr.requestor_id,
        u.username as requestor_username,
        pr.created_at
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requestor_id = u.id
      WHERE pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
      LIMIT 20
    `);

    console.log(`\n📋 Tổng số PR trong hệ thống (20 mới nhất): ${allPRs.length}\n`);

    if (allPRs.length > 0) {
      console.log('Danh sách PRs:');
      allPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.pr_number}`);
        console.log(`   Status: ${pr.status}`);
        console.log(`   Requestor ID: ${pr.requestor_id}`);
        console.log(`   Requestor Username: ${pr.requestor_username || 'NULL (không tìm thấy user)'}`);
        console.log(`   Created: ${pr.created_at}`);
        console.log('');
      });

      // Kiểm tra PRs không có requestor hoặc requestor không tồn tại
      const orphanedPRs = allPRs.filter(pr => !pr.requestor_username);
      if (orphanedPRs.length > 0) {
        console.log(`\n⚠️  Tìm thấy ${orphanedPRs.length} PR không có requestor hợp lệ:\n`);
        orphanedPRs.forEach((pr) => {
          console.log(`   - PR ${pr.pr_number} (Requestor ID: ${pr.requestor_id})`);
        });
        console.log('\n💡 Cần migrate các PR này sang requestor mới!\n');
      }
    } else {
      console.log('ℹ️  Không có PR nào trong hệ thống\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRequestorData();

