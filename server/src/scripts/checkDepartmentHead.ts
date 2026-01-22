import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

dotenv.config();

async function checkDepartmentHead() {
    try {
        console.log('\n🔍 Kiểm tra tài khoản department_head...\n');

        // Check by username using raw SQL to avoid Prisma enum validation
        const departmentHeadResult = await prisma.$queryRawUnsafe<Array<{
            id: string;
            username: string;
            email: string;
            role: string;
            department: string | null;
            location: string | null;
            created_at: Date;
        }>>(`
      SELECT id, username, email, role::text as role, department, location, created_at
      FROM users 
      WHERE username = 'department_head' 
      AND deleted_at IS NULL
      LIMIT 1
    `);

        const departmentHead = departmentHeadResult[0] || null;

        if (departmentHead) {
            console.log('✅ Tài khoản department_head tồn tại:');
            console.log(`   Username: ${departmentHead.username}`);
            console.log(`   Email: ${departmentHead.email}`);
            console.log(`   Role: ${departmentHead.role}`);
            console.log(`   Department: ${departmentHead.department || 'N/A'}`);
            console.log(`   Location: ${departmentHead.location || 'N/A'}`);
            console.log(`   Created: ${departmentHead.createdAt}`);
        } else {
            console.log('❌ Tài khoản department_head KHÔNG tồn tại!');
            console.log('   Cần tạo lại tài khoản này.');
        }

        // Check all users with DEPT_MANAGER role using raw SQL
        const allDeptManagers = await prisma.$queryRawUnsafe<Array<{ username: string; role: string; email: string }>>(`
      SELECT username, role::text as role, email 
      FROM users 
      WHERE (role::text = 'DEPT_MANAGER' OR role::text = 'DEPARTMENT_HEAD') 
      AND deleted_at IS NULL
    `);

        console.log(`\n📋 Tổng số tài khoản có role DEPT_MANAGER/DEPARTMENT_HEAD: ${allDeptManagers.length}`);
        allDeptManagers.forEach((user) => {
            console.log(`   - ${user.username}: ${user.role}`);
        });

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDepartmentHead();

