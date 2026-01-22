import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkDepartmentHeadPRs() {
  try {
    console.log('\n🔍 Kiểm tra dữ liệu PR của department_head...\n');

    // Tìm department_head hiện tại
    const deptHead = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
    }>>(`
      SELECT id, username, email, role::text as role
      FROM users 
      WHERE username = 'department_head' 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (deptHead.length === 0) {
      console.log('❌ Không tìm thấy department_head!\n');
      return;
    }

    const deptHeadId = deptHead[0].id;
    console.log(`✅ Tìm thấy department_head: ${deptHead[0].username} (ID: ${deptHeadId})\n`);

    // Kiểm tra các PRs đang chờ quản lý trực tiếp duyệt
    const pendingPRs = await prisma.$queryRawUnsafe<Array<{
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
        pr.requestor_id::text as requestor_id,
        u.username as requestor_username,
        pr.created_at
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
        console.log(`   Status: ${pr.status}`);
        console.log(`   Requestor: ${pr.requestor_username || 'NULL'}`);
        console.log(`   Created: ${pr.created_at}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  Không có PR nào đang chờ DEPARTMENT_HEAD duyệt\n');
    }

    // Kiểm tra các PRs đã được DEPARTMENT_HEAD duyệt/từ chối/trả về
    const deptHeadPRs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      status: string;
      approved_by: string | null;
      rejected_by: string | null;
      returned_by: string | null;
    }>>(`
      SELECT 
        id,
        pr_number,
        status::text as status,
        approved_by::text as approved_by,
        rejected_by::text as rejected_by,
        returned_by::text as returned_by
      FROM purchase_requests
      WHERE status::text IN ('MANAGER_APPROVED', 'MANAGER_REJECTED', 'MANAGER_RETURNED')
      AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log(`📋 Tìm thấy ${deptHeadPRs.length} PRs đã được quản lý trực tiếp xử lý (10 mới nhất):\n`);

    if (deptHeadPRs.length > 0) {
      deptHeadPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.pr_number}`);
        console.log(`   Status: ${pr.status}`);
        if (pr.approved_by) console.log(`   Approved by: ${pr.approved_by}`);
        if (pr.rejected_by) console.log(`   Rejected by: ${pr.rejected_by}`);
        if (pr.returned_by) console.log(`   Returned by: ${pr.returned_by}`);
        console.log('');
      });
    }

    // Kiểm tra notifications cho department_head
    const notifications = await prisma.$queryRawUnsafe<Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      is_read: boolean;
      created_at: Date;
    }>>(`
      SELECT 
        id,
        type::text as type,
        title,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE user_id::text = $1
      AND resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `, deptHeadId);

    console.log(`📋 Tìm thấy ${notifications.length} notifications chưa resolved cho department_head:\n`);

    if (notifications.length > 0) {
      notifications.forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.title}`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Message: ${notif.message}`);
        console.log(`   Read: ${notif.is_read ? 'Yes' : 'No'}`);
        console.log(`   Created: ${notif.created_at}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  Không có notification nào\n');
    }

    // Kiểm tra PR Approvals của department_head
    const prApprovals = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_id: string;
      pr_number: string;
      approver_id: string;
      status: string;
      created_at: Date;
    }>>(`
      SELECT 
        pa.id,
        pa.pr_id::text as pr_id,
        pr.pr_number,
        pa.approver_id::text as approver_id,
        pa.status::text as status,
        pa.created_at
      FROM pr_approvals pa
      JOIN purchase_requests pr ON pa.pr_id = pr.id
      WHERE pa.approver_id::text = $1
      ORDER BY pa.created_at DESC
      LIMIT 10
    `, deptHeadId);

    console.log(`📋 Tìm thấy ${prApprovals.length} PR Approvals của department_head (10 mới nhất):\n`);

    if (prApprovals.length > 0) {
      prApprovals.forEach((approval, index) => {
        console.log(`${index + 1}. PR ${approval.pr_number}`);
        console.log(`   Status: ${approval.status}`);
        console.log(`   Created: ${approval.created_at}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  Không có PR Approval nào\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDepartmentHeadPRs();







