import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.user.groupBy({
    by: ['role'],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  console.log('\n=== USERS BY ROLE (active) ===');
  for (const r of roles) {
    console.log(`${String(r.role).padEnd(20)} : ${r._count._all}`);
  }

  const branchManagers = await prisma.user.findMany({
    where: { deletedAt: null, role: 'BRANCH_MANAGER' },
    select: { username: true, fullName: true, location: true },
    orderBy: { username: 'asc' },
  });
  console.log('\n=== BRANCH_MANAGER USERS ===');
  console.log(branchManagers);

  const departmentHeads = await prisma.user.findMany({
    where: { deletedAt: null, role: 'DEPARTMENT_HEAD' },
    select: { username: true, fullName: true, department: true, location: true },
    orderBy: { username: 'asc' },
  });
  console.log('\n=== DEPARTMENT_HEAD USERS ===');
  console.log(departmentHeads);

  const departments = await prisma.department.findMany({
    where: { deletedAt: null, status: true },
    select: { departmentCode: true, departmentName: true },
    orderBy: { departmentCode: 'asc' },
  });
  console.log('\n=== ACTIVE DEPARTMENTS ===');
  console.log(departments);

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null, status: true },
    select: { branchCode: true, branchName: true },
    orderBy: { branchCode: 'asc' },
  });
  console.log('\n=== ACTIVE BRANCHES ===');
  console.log(branches);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


