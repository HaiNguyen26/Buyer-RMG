import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';

// Load .env
dotenv.config();

async function updateUserDepartments() {
  try {
    console.log('🔄 Đang cập nhật department cho các user...\n');

    // Cập nhật department cho requestor (phòng ban IT để test)
    const requestor = await prisma.user.updateMany({
      where: {
        username: 'requestor',
        deletedAt: null,
      },
      data: {
        department: 'IT',
      },
    });
    if (requestor.count > 0) {
      console.log('✅ Đã cập nhật department cho requestor: IT');
    } else {
      console.log('ℹ️  Không tìm thấy requestor để cập nhật');
    }

    // Đảm bảo department_head có department IT
    const departmentHead = await prisma.user.updateMany({
      where: {
        username: 'department_head',
        deletedAt: null,
      },
      data: {
        department: 'IT',
      },
    });
    if (departmentHead.count > 0) {
      console.log('✅ Đã cập nhật department cho department_head: IT');
    } else {
      console.log('ℹ️  Không tìm thấy department_head để cập nhật');
    }

    // Hiển thị danh sách tất cả users và department của họ
    const allUsers = await prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        location: true,
      },
      orderBy: {
        username: 'asc',
      },
    });

    console.log('\n📋 Danh sách tất cả users và department:');
    console.log('─'.repeat(80));
    allUsers.forEach((user) => {
      console.log(
        `  ${user.username.padEnd(20)} | ${user.role.padEnd(20)} | Department: ${user.department || 'N/A'.padEnd(10)} | Location: ${user.location || 'N/A'}`
      );
    });
    console.log('─'.repeat(80));

    console.log('\n✅ Hoàn thành cập nhật department!');
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật department:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateUserDepartments();









