import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

dotenv.config();

async function createDepartmentHead() {
  try {
    const defaultPassword = 'RMG123@';
    const hashedPassword = await hashPassword(defaultPassword);

    console.log('\n🚀 Tạo tài khoản Department Head...\n');

    // Check if department_head already exists
    const existingDeptHead = await prisma.user.findFirst({
      where: { username: 'department_head', deletedAt: null },
    });

    let deptHead;
    if (existingDeptHead) {
      deptHead = existingDeptHead;
      console.log('ℹ️  Tài khoản department_head đã tồn tại');
      console.log(`   Username: ${deptHead.username}`);
      console.log(`   Email: ${deptHead.email}`);
      console.log(`   Role: ${deptHead.role}`);
      
      // Update role to DEPARTMENT_HEAD if it's different
      if (deptHead.role !== Role.DEPARTMENT_HEAD) {
        console.log(`\n⚠️  Role hiện tại: ${deptHead.role}, đang cập nhật thành DEPARTMENT_HEAD...`);
        deptHead = await prisma.user.update({
          where: { id: deptHead.id },
          data: { role: Role.DEPARTMENT_HEAD },
        });
        console.log('✅ Đã cập nhật role thành DEPARTMENT_HEAD');
      }
    } else {
      deptHead = await prisma.user.create({
        data: {
          username: 'department_head',
          email: 'department_head@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.DEPARTMENT_HEAD,
          location: 'HCM',
          department: 'IT',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: department_head (DEPARTMENT_HEAD)');
      console.log(`   Username: ${deptHead.username}`);
      console.log(`   Email: ${deptHead.email}`);
      console.log(`   Role: ${deptHead.role}`);
    }

    console.log('\n📝 THÔNG TIN ĐĂNG NHẬP:');
    console.log(`   Username: department_head`);
    console.log(`   Password: ${defaultPassword}`);
    console.log(`   Giao diện: /dashboard/department-head`);
    console.log(`   Component: DepartmentHeadDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho trưởng phòng và trưởng nhóm\n`);

    console.log('✅ Hoàn thành!\n');
  } catch (error: any) {
    console.error('❌ Lỗi khi tạo tài khoản Department Head:', error);
    if (error.message?.includes('does not exist')) {
      console.error('   ⚠️  Có thể enum Role trong PostgreSQL chưa được cập nhật. Hãy chạy updateRoleEnum.ts trước.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDepartmentHead();







