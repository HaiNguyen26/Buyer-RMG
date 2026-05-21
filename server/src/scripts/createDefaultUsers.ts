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
          /** Trùng username tài khoản DEPARTMENT_HEAD tạo bên dưới — cần để gửi duyệt PR */
          directManagerCode: 'department_head',
        },
      });
      console.log('✅ Đã tạo tài khoản: requestor (REQUESTOR, QLTT=department_head)');
    }

    if (!requestor.directManagerCode?.trim()) {
      requestor = await prisma.user.update({
        where: { id: requestor.id },
        data: { directManagerCode: 'department_head' },
      });
      console.log('✅ Đã cập nhật requestor: direct_manager_code → department_head (gửi duyệt PR)');
    }

    if ((requestor.location || '').trim().toUpperCase() !== 'HCM') {
      requestor = await prisma.user.update({
        where: { id: requestor.id },
        data: { location: 'HCM' },
      });
      console.log('✅ Đã cập nhật requestor: location → HCM');
    }

    // ============================================
    // 2. BUYER (Nhân viên mua hàng)
    //    Mặc định + thêm 2 buyer: duc, nguyen
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

    // Buyer 2: duc
    const existingBuyerDuc = await prisma.user.findFirst({
      where: { username: 'duc', deletedAt: null },
    });
    if (existingBuyerDuc) {
      console.log('ℹ️  Tài khoản duc (BUYER) đã tồn tại');
    } else {
      await prisma.user.create({
        data: {
          username: 'duc',
          email: 'duc@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BUYER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: duc (BUYER)');
    }

    // Buyer 3: nguyen
    const existingBuyerNguyen = await prisma.user.findFirst({
      where: { username: 'nguyen', deletedAt: null },
    });
    if (existingBuyerNguyen) {
      console.log('ℹ️  Tài khoản nguyen (BUYER) đã tồn tại');
    } else {
      await prisma.user.create({
        data: {
          username: 'nguyen',
          email: 'nguyen@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BUYER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: nguyen (BUYER)');
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
    // 3b. BUYER_MANAGER (Trưởng phòng Mua hàng)
    // ============================================
    const existingBuyerManager = await prisma.user.findFirst({
      where: { username: 'buyer_manager', deletedAt: null },
    });
    let buyerManagerUser;
    if (existingBuyerManager) {
      buyerManagerUser = existingBuyerManager;
      console.log('ℹ️  Tài khoản buyer_manager đã tồn tại');
    } else {
      buyerManagerUser = await prisma.user.create({
        data: {
          username: 'buyer_manager',
          email: 'buyer_manager@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.BUYER_MANAGER,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: buyer_manager (BUYER_MANAGER)');
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
    // 6. BGD (Tổng giám đốc)
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
      console.log('✅ Đã tạo tài khoản: bgd (BGD)');
    }

    // ============================================
    // 7. SALES (Quản lý Customer PO và dự án)
    // ============================================
    const existingSales = await prisma.user.findFirst({
      where: { username: 'sales', deletedAt: null },
    });
    let salesUser;
    if (existingSales) {
      salesUser = existingSales;
      console.log('ℹ️  Tài khoản sales đã tồn tại');
    } else {
      salesUser = await prisma.user.create({
        data: {
          username: 'sales',
          fullName: 'Duc',
          email: 'sales@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.SALES,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: sales (SALES)');
    }

    // ============================================
    // 8. WAREHOUSE (Quản lý tồn kho)
    // ============================================
    const existingWarehouse = await prisma.user.findFirst({
      where: { username: 'warehouse', deletedAt: null },
    });
    let warehouseUser;
    if (existingWarehouse) {
      warehouseUser = existingWarehouse;
      console.log('ℹ️  Tài khoản warehouse đã tồn tại');
    } else {
      warehouseUser = await prisma.user.create({
        data: {
          username: 'warehouse',
          email: 'warehouse@rmg.vn',
          passwordHash: hashedPassword,
          role: Role.WAREHOUSE,
          location: 'HCM',
          companyId: null,
        },
      });
      console.log('✅ Đã tạo tài khoản: warehouse (WAREHOUSE)');
    }

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

    console.log('🔵 3b. BUYER_MANAGER (Trưởng phòng Mua hàng)');
    console.log(`   Username: ${buyerManagerUser.username}`);
    console.log(`   Email: ${buyerManagerUser.email}`);
    console.log(`   Role: ${buyerManagerUser.role}`);
    console.log(`   Giao diện: /dashboard/buyer-manager`);
    console.log(`   Component: BuyerManagerDashboard.tsx`);
    console.log(`   Mô tả: Tổng quan phòng mua, đội Buyer, giám sát PR\n`);

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

    console.log('🔵 6. BGD (Tổng giám đốc)');
    console.log(`   Username: ${bgd.username}`);
    console.log(`   Email: ${bgd.email}`);
    console.log(`   Role: ${bgd.role}`);
    console.log(`   Giao diện: /dashboard/bgd`);
    console.log(`   Component: BGDDashboard.tsx`);
    console.log(`   Mô tả: Dashboard cho tổng giám đốc\n`);

    console.log('🔵 7. SALES (Quản lý Customer PO)');
    console.log(`   Username: ${salesUser.username}`);
    console.log(`   Email: ${salesUser.email}`);
    console.log(`   Role: ${salesUser.role}`);
    console.log(`   Giao diện: /dashboard/sales`);
    console.log(`   Mô tả: Dashboard cho Sales - quản lý PO khách hàng và dự án\n`);

    console.log('🔵 8. WAREHOUSE (Quản lý tồn kho)');
    console.log(`   Username: ${warehouseUser.username}`);
    console.log(`   Email: ${warehouseUser.email}`);
    console.log(`   Role: ${warehouseUser.role}`);
    console.log(`   Giao diện: /dashboard/warehouse`);
    console.log(`   Mô tả: Lưới tồn kho — Inventory Management\n`);

    console.log('='.repeat(70));
    console.log('\n📝 TỔNG HỢP:');
    console.log(`   - Tổng số tài khoản cốt lõi: 9 (+ buyer duc/nguyen nếu tạo)`);
    console.log(`   - REQUESTOR: 1 tài khoản (requestor)`);
    console.log(`   - BUYER: 1 tài khoản (buyer)`);
    console.log(`   - BUYER_LEADER: 1 tài khoản (buyer_leader)`);
    console.log(`   - BUYER_MANAGER: 1 tài khoản (buyer_manager)`);
    console.log(`   - DEPARTMENT_HEAD: 1 tài khoản (department_head)`);
    console.log(`   - BRANCH_MANAGER: 1 tài khoản (branch_manager)`);
    console.log(`   - BGD: 1 tài khoản (bgd)`);
    console.log(`   - SALES: 1 tài khoản (sales)`);
    console.log(`   - WAREHOUSE: 1 tài khoản (warehouse)`);
    console.log(`\n⚠️  Lưu ý: Thêm BUYER duc/nguyen, ACCOUNTANT nếu cần — xem script\n`);

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

