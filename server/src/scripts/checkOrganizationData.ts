import 'dotenv/config';
import { prisma } from '../config/database';

async function checkOrganizationData() {
  console.log('\n📊 ========== CHECK ORGANIZATION DATA ==========\n');

  try {
    // Check users
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        directManagerCode: true,
      },
      orderBy: { location: 'asc' },
    });

    console.log(`📊 Total Users: ${users.length}\n`);

    // Group by branch
    const usersByBranch: { [branch: string]: any[] } = {};
    users.forEach(user => {
      const branch = user.location || 'NO_BRANCH';
      if (!usersByBranch[branch]) {
        usersByBranch[branch] = [];
      }
      usersByBranch[branch].push(user);
    });

    console.log('📊 Users by Branch:');
    Object.keys(usersByBranch).forEach(branch => {
      console.log(`\n  ${branch}: ${usersByBranch[branch].length} users`);
      const branchManagers = usersByBranch[branch].filter(u => u.role === 'BRANCH_MANAGER');
      const deptHeads = usersByBranch[branch].filter(u => u.role === 'DEPARTMENT_HEAD');
      const withManager = usersByBranch[branch].filter(u => u.directManagerCode);
      const withoutManager = usersByBranch[branch].filter(u => !u.directManagerCode);
      
      if (branchManagers.length > 0) {
        console.log(`    ✅ BRANCH_MANAGER: ${branchManagers.length}`);
        branchManagers.forEach(m => {
          console.log(`       - ${m.fullName || m.username} (${m.username})`);
        });
      } else {
        console.log(`    ❌ No BRANCH_MANAGER`);
      }
      
      if (deptHeads.length > 0) {
        console.log(`    📋 DEPARTMENT_HEAD: ${deptHeads.length}`);
      }
      
      console.log(`    👥 With direct_manager_code: ${withManager.length}`);
      console.log(`    👤 Without direct_manager_code: ${withoutManager.length}`);
    });

    // Check branches
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        branchCode: true,
        branchName: true,
      },
    });

    console.log(`\n📊 Total Branches: ${branches.length}`);
    branches.forEach(branch => {
      const branchUsers = users.filter(u => u.location === branch.branchCode);
      const branchManager = branchUsers.find(u => u.role === 'BRANCH_MANAGER');
      console.log(`\n  ${branch.branchName} (${branch.branchCode}):`);
      console.log(`    Users: ${branchUsers.length}`);
      if (branchManager) {
        console.log(`    ✅ Manager: ${branchManager.fullName || branchManager.username} (${branchManager.username})`);
      } else {
        console.log(`    ❌ No Manager`);
      }
    });

    // Check hierarchy
    console.log('\n📊 Hierarchy Check:');
    const usersWithManager = users.filter(u => u.directManagerCode);
    const usersWithoutManager = users.filter(u => !u.directManagerCode);
    
    console.log(`  Users with direct_manager_code: ${usersWithManager.length}`);
    console.log(`  Users without direct_manager_code: ${usersWithoutManager.length}`);

    // Check for orphaned manager codes
    const managerCodes = new Set(usersWithManager.map(u => u.directManagerCode));
    const existingCodes = new Set(users.map(u => u.username));
    const orphanedCodes = Array.from(managerCodes).filter(code => !existingCodes.has(code));
    
    if (orphanedCodes.length > 0) {
      console.log(`\n  ⚠️  Orphaned manager codes (not found in users): ${orphanedCodes.length}`);
      orphanedCodes.slice(0, 10).forEach(code => {
        console.log(`     - ${code}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrganizationData();




