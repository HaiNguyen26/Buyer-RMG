import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkPRDepartments() {
  try {
    console.log('\n🔍 Kiểm tra department của các PRs đang chờ quản lý trực tiếp duyệt...\n');

    // Kiểm tra department_head
    const deptHead = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      department: string | null;
    }>>(`
      SELECT id, username, department
      FROM users 
      WHERE username = 'department_head' 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (deptHead.length > 0) {
      console.log(`📋 Department Head:`);
      console.log(`   Username: ${deptHead[0].username}`);
      console.log(`   Department: ${deptHead[0].department || 'NULL'}\n`);
    }

    // Kiểm tra các PRs đang chờ duyệt
    const pendingPRs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      department: string | null;
      requestor_username: string | null;
      requestor_department: string | null;
      status: string;
    }>>(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.department,
        pr.status::text as status,
        u.username as requestor_username,
        u.department as requestor_department
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requestor_id = u.id AND u.deleted_at IS NULL
      WHERE pr.status::text = 'MANAGER_PENDING'
      AND pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
    `);

    console.log(`📋 Tìm thấy ${pendingPRs.length} PRs đang chờ quản lý trực tiếp duyệt:\n`);

    if (pendingPRs.length > 0) {
      pendingPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.pr_number}`);
        console.log(`   PR Department: ${pr.department || 'NULL'}`);
        console.log(`   Requestor: ${pr.requestor_username || 'NULL'}`);
        console.log(`   Requestor Department: ${pr.requestor_department || 'NULL'}`);
        console.log(`   Status: ${pr.status}`);
        console.log('');
      });

      // Phân tích
      const deptHeadDept = deptHead[0]?.department || null;
      const matchingPRs = pendingPRs.filter(pr => 
        pr.department === deptHeadDept || 
        pr.requestor_department === deptHeadDept
      );

      console.log(`\n📊 Phân tích:\n`);
      console.log(`   Department Head Department: ${deptHeadDept || 'NULL'}`);
      console.log(`   PRs match với filter: ${matchingPRs.length}/${pendingPRs.length}`);
      console.log(`   PRs không match: ${pendingPRs.length - matchingPRs.length}\n`);

      if (pendingPRs.length - matchingPRs.length > 0) {
        console.log(`⚠️  Các PRs không match với filter:\n`);
        pendingPRs.forEach((pr) => {
          const matches = pr.department === deptHeadDept || pr.requestor_department === deptHeadDept;
          if (!matches) {
            console.log(`   - PR ${pr.pr_number}: PR dept=${pr.department}, Requestor dept=${pr.requestor_department}`);
          }
        });
        console.log('\n💡 Giải pháp: Cần cập nhật filter hoặc department của department_head\n');
      }
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPRDepartments();







