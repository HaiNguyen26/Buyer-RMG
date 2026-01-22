import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

// Load .env
dotenv.config();

async function createDefaultUsers() {
  try {
    const defaultPassword = 'RMG123@';
    const hashedPassword = await hashPassword(defaultPassword);

    console.log('\n🚀 Bắt đầu tạo tài khoản theo role trong hệ thống...\n');

    // ============================================
    // 1. REQUESTOR (Người yêu cầu mua hàng)
    // ============================================
    const existingRequestor = await prisma.user.findFirst({
      where: { username: 'requestor', deletedAt: null },
    });
    let requestor;
    if (existingRequestor) {
      requestor = existingRequestor;
      console.log('ℹ️  Tài khoản requestor đã tồn tại');
    } else {
      requestor = await prisma.user.create({
        data: {
          username: 'requestor',
          email: 'requestor@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.REQUESTOR,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: requestor (REQUESTOR)');
    }

    // ============================================
    // 2. BUYER (Nhân viên mua hàng)
    // ============================================
    const existingBuyer = await prisma.user.findFirst({
      where: { username: 'buyer', deletedAt: null },
    });
    let buyer;
    if (existingBuyer) {
      buyer = existingBuyer;
      console.log('ℹ️  Tài khoản buyer đã tồn tại');
    } else {
      buyer = await prisma.user.create({
        data: {
          username: 'buyer',
          email: 'buyer@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BUYER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: buyer (BUYER)');
    }

    // ============================================
    // 3. BUYER_LEADER (Trưởng nhóm mua hàng)
    // ============================================
    const existingBuyerLeader = await prisma.user.findFirst({
      where: { username: 'buyer_leader', deletedAt: null },
    });
    let buyerLeader;
    if (existingBuyerLeader) {
      buyerLeader = existingBuyerLeader;
      console.log('ℹ️  Tài khoản buyer_leader đã tồn tại');
    } else {
      buyerLeader = await prisma.user.create({
        data: {
          username: 'buyer_leader',
          email: 'buyer_leader@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BUYER_LEADER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: buyer_leader (BUYER_LEADER)');
    }

    // ============================================
    // 4. DEPT_MANAGER (Trưởng phòng và Trưởng nhóm)
    // ============================================
    const existingDepartmentHead = await prisma.user.findFirst({
      where: { 
        username: 'department_head', 
        deletedAt: null 
      },
    });
    let departmentHead;
    if (existingDepartmentHead) {
      departmentHead = existingDepartmentHead;
      console.log('ℹ️  Tài khoản department_head đã tồn tại');
    } else {
      departmentHead = await prisma.user.create({
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
    }

    // ============================================
    // 5. BRANCH_MANAGER (Giám đốc chi nhánh)
    // ============================================
    const existingBranchManager = await prisma.user.findFirst({
      where: { username: 'branch_manager', deletedAt: null },
    });
    let branchManager;
    if (existingBranchManager) {
      branchManager = existingBranchManager;
      console.log('ℹ️  Tài khoản branch_manager đã tồn tại');
    } else {
      branchManager = await prisma.user.create({
        data: {
          username: 'branch_manager',
          email: 'branch_manager@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BRANCH_MANAGER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: branch_manager (BRANCH_MANAGER)');
    }

    // ============================================
    // 6. BOD (Tổng giám đốc / Ban giám đốc)
    // ============================================
    const existingBGD = await prisma.user.findFirst({
      where: { username: 'bgd', deletedAt: null },
    });
    let bgd;
    if (existingBGD) {
      bgd = existingBGD;
      console.log('ℹ️  Tài khoản bgd đã tồn tại');
    } else {
      bgd = await prisma.user.create({
        data: {
          username: 'bgd',
          email: 'bgd@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BGD,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: bgd (BGD / BOD)');
    }

    // SYSTEM_ADMIN role đã được xóa khỏi enum - không còn tạo user với role này

    // ============================================
    // TỔNG HỢP VÀ MAPPING VỚI GIAO DIỆN
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📋 DANH SÁCH TÀI KHOẢN VÀ GIAO DIỆN TƯƠNG ỨNG');
    console.log('='.repeat(70) + '\n');

    console.log('🔵 1. REQUESTOR (Người yêu cầu mua hàng)');
    console.log(`   Username: ${requestor.username}`);
    console.log(`   Email: ${requestor.email}`);
    console.log(`   Role: ${requestor.role}`);
    console.log(`   Giao diện: /dashboard/requestor`);
    console.log(`   Component: RequestorDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho người yêu cầu mua hàng\n`);

    console.log('🔵 2. BUYER (Nhân viên mua hàng)');
    console.log(`   Username: ${buyer.username}`);
    console.log(`   Email: ${buyer.email}`);
    console.log(`   Role: ${buyer.role}`);
    console.log(`   Giao diện: /dashboard/buyer`);
    console.log(`   Component: BuyerDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho nhân viên mua hàng\n`);

    console.log('🔵 3. BUYER_LEADER (Trưởng nhóm mua hàng)');
    console.log(`   Username: ${buyerLeader.username}`);
    console.log(`   Email: ${buyerLeader.email}`);
    console.log(`   Role: ${buyerLeader.role}`);
    console.log(`   Giao diện: /dashboard/buyer-leader`);
    console.log(`   Component: BuyerLeaderDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho trưởng nhóm mua hàng\n`);

    console.log('🔵 4. DEPARTMENT_HEAD (Trưởng phòng và Trưởng nhóm)');
    console.log(`   Username: ${departmentHead.username}`);
    console.log(`   Email: ${departmentHead.email}`);
    console.log(`   Role: ${departmentHead.role}`);
    console.log(`   Department: ${departmentHead.department || 'N/A'}`);
    console.log(`   Giao diện: /dashboard/department-head`);
    console.log(`   Component: DepartmentHeadDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho trưởng phòng và trưởng nhóm\n`);

    console.log('🔵 5. BRANCH_MANAGER (Giám đốc chi nhánh)');
    console.log(`   Username: ${branchManager.username}`);
    console.log(`   Email: ${branchManager.email}`);
    console.log(`   Role: ${branchManager.role}`);
    console.log(`   Giao diện: /dashboard/branch-manager`);
    console.log(`   Component: BranchManagerDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho giám đốc chi nhánh\n`);

    console.log('🔵 6. BOD (Tổng giám đốc / Ban giám đốc)');
    console.log(`   Username: ${bgd.username}`);
    console.log(`   Email: ${bgd.email}`);
    console.log(`   Role: ${bgd.role}`);
    console.log(`   Giao diện: /dashboard/bgd`);
    console.log(`   Component: BGDDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho tổng giám đốc / ban giám đốc\n`);

    // SYSTEM_ADMIN role đã được xóa khỏi enum - không còn tạo user với role này

    console.log('='.repeat(70));
    console.log('\n📝 TỔNG HỢP:');
    console.log(`   - Tổng số tài khoản đã tạo: 6`);
    console.log(`   - REQUESTOR: 1 tài khoản (requestor)`);
    console.log(`   - BUYER: 1 tài khoản (buyer)`);
    console.log(`   - BUYER_LEADER: 1 tài khoản (buyer_leader)`);
    console.log(`   - DEPARTMENT_HEAD: 1 tài khoản (department_head)`);
    console.log(`   - BRANCH_MANAGER: 1 tài khoản (branch_manager)`);
    console.log(`   - BGD (BOD): 1 tài khoản (bgd)`);
    console.log(`\n⚠️  Lưu ý: ACCOUNTANT và WAREHOUSE sẽ được tạo sau\n`);

    console.log('🔐 Password mặc định cho TẤT CẢ tài khoản: ' + defaultPassword);
    console.log('\n✅ Hoàn thành tạo tài khoản!\n');
  } catch (error) {
    console.error('❌ Lỗi khi tạo tài khoản:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultUsers();

