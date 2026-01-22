import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

/**
 * Script để migrate notifications và PR Approvals từ department_head cũ sang department_head mới
 */
async function migrateDepartmentHeadData() {
  try {
    console.log('\n🔄 Migrate dữ liệu cho department_head...\n');

    // Tìm department_head mới
    const newDeptHead = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      department: string | null;
    }>>(`
      SELECT id, username, email, department
      FROM users 
      WHERE username = 'department_head' 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (newDeptHead.length === 0) {
      console.log('❌ Không tìm thấy department_head mới!\n');
      return;
    }

    const newDeptHeadId = newDeptHead[0].id;
    console.log(`✅ Tìm thấy department_head mới: ${newDeptHead[0].username} (ID: ${newDeptHeadId})`);
    console.log(`   Department: ${newDeptHead[0].department || 'N/A'}\n`);

    // Tìm tất cả department_head cũ (có thể bị soft-deleted hoặc có ID khác)
    const oldDeptHeads = await prisma.$queryRawUnsafe<Array<{
      id: string;
      username: string;
      email: string;
      deleted_at: Date | null;
    }>>(`
      SELECT id, username, email, deleted_at
      FROM users 
      WHERE username = 'department_head'
      AND id::text != $1
      ORDER BY created_at ASC
    `, newDeptHeadId);

    console.log(`📋 Tìm thấy ${oldDeptHeads.length} department_head cũ:\n`);

    if (oldDeptHeads.length > 0) {
      oldDeptHeads.forEach((old, index) => {
        console.log(`${index + 1}. ID: ${old.id}`);
        console.log(`   Username: ${old.username}`);
        console.log(`   Email: ${old.email}`);
        console.log(`   Deleted: ${old.deleted_at ? 'Yes' : 'No'}`);
        console.log('');
      });

      // Migrate notifications từ các department_head cũ sang mới
      console.log('📝 Bước 1: Migrate notifications...\n');

      for (const oldDeptHead of oldDeptHeads) {
        const migratedNotifs = await prisma.$executeRawUnsafe(`
          UPDATE notifications
          SET user_id = $1::uuid
          WHERE user_id::text = $2
          AND resolved_at IS NULL
        `, newDeptHeadId, oldDeptHead.id);

        if (migratedNotifs > 0) {
          console.log(`   ✅ Đã migrate ${migratedNotifs} notifications từ ${oldDeptHead.id}`);
        }
      }

      // Migrate PR Approvals từ các department_head cũ sang mới
      console.log('\n📝 Bước 2: Migrate PR Approvals...\n');

      for (const oldDeptHead of oldDeptHeads) {
        const migratedApprovals = await prisma.$executeRawUnsafe(`
          UPDATE pr_approvals
          SET approver_id = $1::uuid
          WHERE approver_id::text = $2
        `, newDeptHeadId, oldDeptHead.id);

        if (migratedApprovals > 0) {
          console.log(`   ✅ Đã migrate ${migratedApprovals} PR Approvals từ ${oldDeptHead.id}`);
        }
      }

      console.log('\n');
    } else {
      console.log('ℹ️  Không có department_head cũ nào\n');
    }

    // Kiểm tra notifications hiện tại của department_head mới
    const notifications = await prisma.$queryRawUnsafe<Array<{
      id: string;
      type: string;
      title: string;
      status: string;
      created_at: Date;
    }>>(`
      SELECT 
        id,
        type::text as type,
        title,
        status::text as status,
        created_at
      FROM notifications
      WHERE user_id::text = $1
      AND resolved_at IS NULL
      ORDER BY created_at DESC
    `, newDeptHeadId);

    console.log(`📋 Tổng số notifications của department_head mới: ${notifications.length}\n`);

    if (notifications.length > 0) {
      console.log('Danh sách notifications (10 mới nhất):');
      notifications.slice(0, 10).forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.title}`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Status: ${notif.status}`);
        console.log(`   Created: ${notif.created_at}`);
        console.log('');
      });
    }

    // Kiểm tra PR Approvals hiện tại
    const prApprovals = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      action: string;
      created_at: Date;
    }>>(`
      SELECT 
        pa.id,
        pr.pr_number,
        pa.action::text as action,
        pa.created_at
      FROM pr_approvals pa
      JOIN purchase_requests pr ON pa.purchase_request_id = pr.id
      WHERE pa.approver_id::text = $1
      ORDER BY pa.created_at DESC
    `, newDeptHeadId);

    console.log(`📋 Tổng số PR Approvals của department_head mới: ${prApprovals.length}\n`);

    if (prApprovals.length > 0) {
      console.log('Danh sách PR Approvals (10 mới nhất):');
      prApprovals.slice(0, 10).forEach((approval, index) => {
        console.log(`${index + 1}. PR ${approval.pr_number}`);
        console.log(`   Action: ${approval.action}`);
        console.log(`   Created: ${approval.created_at}`);
        console.log('');
      });
    }

    // Kiểm tra các PRs đang chờ DEPARTMENT_HEAD duyệt
    const pendingPRs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      pr_number: string;
      status: string;
      requestor_username: string | null;
      created_at: Date;
    }>>(`
      SELECT 
        pr.id,
        pr.pr_number,
        pr.status::text as status,
        u.username as requestor_username,
        pr.created_at
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requestor_id = u.id AND u.deleted_at IS NULL
      WHERE pr.status::text = 'MANAGER_PENDING'
      AND pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
    `);

    console.log(`📋 Tổng số PRs đang chờ DEPARTMENT_HEAD duyệt: ${pendingPRs.length}\n`);

    if (pendingPRs.length > 0) {
      console.log('Danh sách PRs đang chờ duyệt:');
      pendingPRs.forEach((pr, index) => {
        console.log(`${index + 1}. PR ${pr.pr_number}`);
        console.log(`   Requestor: ${pr.requestor_username || 'NULL'}`);
        console.log(`   Created: ${pr.created_at}`);
        console.log('');
      });

      // Kiểm tra xem có notifications cho các PRs này không
      console.log('📝 Kiểm tra notifications cho các PRs đang chờ duyệt...\n');

      for (const pr of pendingPRs) {
        const prNotifications = await prisma.$queryRawUnsafe<Array<{
          id: string;
          type: string;
          title: string;
          user_id: string;
          status: string;
        }>>(`
          SELECT 
            id,
            type::text as type,
            title,
            user_id::text as user_id,
            status::text as status
          FROM notifications
          WHERE related_id::text = $1
          AND related_type = 'PR'
          AND resolved_at IS NULL
        `, pr.id);

        if (prNotifications.length > 0) {
          console.log(`PR ${pr.pr_number}:`);
          prNotifications.forEach((notif) => {
            const isForDeptHead = notif.user_id === newDeptHeadId;
            console.log(`   - ${notif.title} (Type: ${notif.type}, User: ${notif.user_id === newDeptHeadId ? 'department_head ✅' : 'Other'}, Status: ${notif.status})`);
          });
          console.log('');
        } else {
          console.log(`PR ${pr.pr_number}: ⚠️  Không có notification!\n`);
        }
      }
    }

    console.log('\n✅ Hoàn thành kiểm tra!\n');

  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateDepartmentHeadData();

