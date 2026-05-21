import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';
import { hashPassword } from '../utils/password';
import { auditCreate } from '../utils/audit';

interface ExcelRow {
  employee_code: string;
  full_name: string;
  /** Luôn có giá trị: cột email (nếu hợp lệ) hoặc tự sinh `{employee_code}@import.rmg.local` */
  email: string;
  branch_code?: string;
  branch_name?: string;
  department_name?: string;
  department_code?: string;
  job_title?: string;
  work_location?: string;
  /** Cột Excel is_branch_director */
  is_branch_director?: boolean;
  level_code?: string;
  system_roles?: string;
  direct_manager_code?: string;
}

/** Mẫu Excel nhân sự: chỉ bắt buộc mã + họ tên (không còn bắt buộc email). */
const REQUIRED_EMPLOYEE_COLUMNS = ['employee_code', 'full_name'] as const;

function getExcelCell(
  row: ExcelJS.Row,
  headers: Record<string, number>,
  key: string
): string | undefined {
  const col = headers[key];
  if (!col) return undefined;
  const raw = row.getCell(col).value;
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'object' && raw !== null && 'text' in (raw as object)) {
    const t = (raw as { text?: string }).text;
    return t != null && String(t).trim() ? String(t).trim() : undefined;
  }
  const s = String(raw).trim();
  return s || undefined;
}

function parseExcelBooleanCell(row: ExcelJS.Row, headers: Record<string, number>, key: string): boolean {
  const col = headers[key];
  if (!col) return false;
  const raw = row.getCell(col).value;
  if (raw === true) return true;
  if (raw === false || raw === null || raw === undefined) return false;
  if (typeof raw === 'number') return raw === 1;
  const s = String(raw).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'x', 'có', 'co'].includes(s);
}

function syntheticImportEmail(employeeCode: string): string {
  const safe = employeeCode.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safe}@import.rmg.local`;
}

function resolveImportEmail(
  row: ExcelJS.Row,
  headers: Record<string, number>,
  employeeCode: string
): string {
  const explicit = getExcelCell(row, headers, 'email');
  if (explicit && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(explicit)) return explicit;
  return syntheticImportEmail(employeeCode);
}

// Map system_roles từ Excel sang Role enum
const mapRoleFromExcel = (systemRoles: string | undefined): string => {
  if (!systemRoles) return 'REQUESTOR';
  
  const roleMap: { [key: string]: string } = {
    'REQUESTOR': 'REQUESTOR',
    'DEPARTMENT_HEAD': 'DEPARTMENT_HEAD',
    'DEPT_MANAGER': 'DEPARTMENT_HEAD', // Map DEPT_MANAGER to DEPARTMENT_HEAD (Trưởng phòng)
    'TEAM_LEAD': 'DEPARTMENT_HEAD', // Map TEAM_LEAD to DEPARTMENT_HEAD (Trưởng nhóm)
    'BRANCH_MANAGER': 'BRANCH_MANAGER', // Giám đốc / Quản lý chi nhánh
    'BRANCH_DIRECTOR': 'BRANCH_DIRECTOR', // Giám đốc chi nhánh (enum riêng)
    'BUYER': 'BUYER',
    'BUYER_LEADER': 'BUYER_LEADER',
    'BUYER_MANAGER': 'BUYER_MANAGER',
    'ACCOUNTANT': 'ACCOUNTANT',
    'WAREHOUSE': 'WAREHOUSE',
    'BGD': 'BGD',
    'SYSTEM_ADMIN': 'SYSTEM_ADMIN',
  };

  // Try exact match first
  const upperRole = systemRoles.toUpperCase().trim();
  if (roleMap[upperRole]) {
    return roleMap[upperRole];
  }

  // Try partial match
  for (const [key, value] of Object.entries(roleMap)) {
    if (upperRole.includes(key) || key.includes(upperRole)) {
      return value;
    }
  }

  // Default to REQUESTOR
  return 'REQUESTOR';
};

function mapRoleFromExcelRow(row: Pick<ExcelRow, 'system_roles' | 'is_branch_director'>): string {
  if (row.is_branch_director) return 'BRANCH_DIRECTOR';
  return mapRoleFromExcel(row.system_roles);
}

// Import Users from Excel
export const importUsersFromExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if user has permission (only SYSTEM_ADMIN)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (currentUser?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden: Only system admin can import users' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    const buffer = await data.toBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return reply.code(400).send({ error: 'Excel file is empty' });
    }

    // Parse headers (first row)
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const headerValue = cell.value?.toString()?.toLowerCase().trim();
      if (headerValue) {
        headers[headerValue] = colNumber;
      }
    });

    console.log('📊 Excel Headers:', headers);

    // Validate required columns (mẫu mới: không bắt buộc email)
    const missingColumns = REQUIRED_EMPLOYEE_COLUMNS.filter((col) => !headers[col]);

    if (missingColumns.length > 0) {
      return reply.code(400).send({
        error: 'Missing required columns',
        missingColumns,
        expected: [...REQUIRED_EMPLOYEE_COLUMNS],
      });
    }

    // Parse data rows
    const rows: ExcelRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    const defaultPassword = 'RMG123@'; // Default password for imported users
    const passwordHash = await hashPassword(defaultPassword);

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      const employeeCode = getExcelCell(row, headers, 'employee_code');
      if (!employeeCode) {
        continue;
      }

      const fullName = getExcelCell(row, headers, 'full_name') || '';
      const email = resolveImportEmail(row, headers, employeeCode);

      const excelRow: ExcelRow = {
        employee_code: employeeCode,
        full_name: fullName,
        email,
        branch_code: getExcelCell(row, headers, 'branch_code'),
        branch_name: getExcelCell(row, headers, 'branch_name'),
        department_name: getExcelCell(row, headers, 'department_name'),
        department_code: getExcelCell(row, headers, 'department_code'),
        job_title: getExcelCell(row, headers, 'job_title'),
        work_location: getExcelCell(row, headers, 'work_location'),
        is_branch_director: parseExcelBooleanCell(row, headers, 'is_branch_director'),
        level_code: getExcelCell(row, headers, 'level_code'),
        system_roles: getExcelCell(row, headers, 'system_roles'),
        direct_manager_code: getExcelCell(row, headers, 'direct_manager_code'),
      };

      if (!fullName.trim()) {
        errors.push({ row: rowNumber, error: 'full_name is required' });
        continue;
      }

      rows.push(excelRow);
    }

    console.log(`📊 Parsed ${rows.length} rows from Excel`);

    // Import users
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ employee_code: string; error: string }>,
    };

    for (const row of rows) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: row.employee_code },
              { email: row.email },
            ],
            deletedAt: null,
          },
        });

        if (existingUser) {
          results.skipped++;
          results.errors.push({
            employee_code: row.employee_code,
            error: `User already exists: ${existingUser.username === row.employee_code ? 'username' : 'email'}`,
          });
          continue;
        }

        const role = mapRoleFromExcelRow(row) as any;

        // Create user
        const newUser = await prisma.user.create({
          data: {
            username: row.employee_code,
            fullName: row.full_name || null,
            email: row.email,
            passwordHash: passwordHash, // Default password
            role: role,
            location: row.work_location || row.branch_code || null,
            department: row.department_code || null,
            jobTitle: row.job_title || null,
            directManagerCode: row.direct_manager_code || null,
            companyId: null, // TODO: Get from context
          },
        });

        // Create audit log
        await auditCreate(
          'users',
          newUser.id,
          userId,
          {
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            location: newUser.location,
            department: newUser.department,
            imported: true,
            source: 'excel_import',
          }
        );

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          employee_code: row.employee_code,
          error: error.message || 'Unknown error',
        });
        console.error(`❌ Error importing user ${row.employee_code}:`, error);
      }
    }

    console.log('📊 Import Results:', results);

    reply.send({
      message: 'Import completed',
      totalRows: rows.length,
      results: {
        success: results.success,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors,
      },
      defaultPassword: defaultPassword,
      emailNote:
        'Nếu không có cột email hợp lệ: hệ thống dùng {employee_code}@import.rmg.local (trùng employee_code thì trùng email).',
    });
  } catch (error: any) {
    console.error('Import error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Import Master Data from Excel (Users + Branches + Departments)
export const importMasterDataFromExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if user has permission (only SYSTEM_ADMIN)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (currentUser?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden: Only system admin can import data' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    const buffer = await data.toBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return reply.code(400).send({ error: 'Excel file is empty' });
    }

    // Parse headers
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const headerValue = cell.value?.toString()?.toLowerCase().trim();
      if (headerValue) {
        headers[headerValue] = colNumber;
      }
    });

    console.log('📊 Headers found:', Object.keys(headers));
    console.log('📊 Headers mapping:', headers);
    
    // Log actual header values from Excel
    const actualHeaders: string[] = [];
    headerRow.eachCell((cell) => {
      const value = cell.value?.toString()?.trim();
      if (value) actualHeaders.push(value);
    });
    console.log('📊 Actual Excel headers:', actualHeaders);

    const missingColumns = REQUIRED_EMPLOYEE_COLUMNS.filter((col) => !headers[col]);

    if (missingColumns.length > 0) {
      console.error('❌ Missing required columns:', missingColumns);
      return reply.code(400).send({
        error: 'Missing required columns',
        missingColumns,
        expected: [...REQUIRED_EMPLOYEE_COLUMNS],
      });
    }

    // Parse data rows
    const rows: ExcelRow[] = [];
    const defaultPassword = 'RMG123@';
    let passwordHash: string;
    
    try {
      passwordHash = await hashPassword(defaultPassword);
      console.log('📊 Password hash created');
    } catch (hashError: any) {
      console.error('❌ Error hashing password:', hashError);
      return reply.code(500).send({
        error: 'Error preparing import',
        message: hashError.message,
      });
    }

    console.log('📊 Parsing data rows...');
    console.log('📊 Worksheet row count:', worksheet.rowCount);
    
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      try {
        const row = worksheet.getRow(rowNumber);
        
        // Check if row is empty (all cells are empty)
        let hasData = false;
        row.eachCell(() => {
          hasData = true;
        });
        if (!hasData) {
          console.log(`📊 Row ${rowNumber} is empty, skipping`);
          continue;
        }

        const employeeCode = getExcelCell(row, headers, 'employee_code');
        if (!employeeCode) {
          console.log(`📊 Row ${rowNumber}: No employee_code, skipping`);
          continue;
        }

        const fullName = getExcelCell(row, headers, 'full_name') || '';
        const email = resolveImportEmail(row, headers, employeeCode);
        const branchCode = getExcelCell(row, headers, 'branch_code');
        const branchName = getExcelCell(row, headers, 'branch_name');
        const departmentCode = getExcelCell(row, headers, 'department_code');
        const departmentName = getExcelCell(row, headers, 'department_name');
        const systemRoles = getExcelCell(row, headers, 'system_roles');
        const directManagerCode = getExcelCell(row, headers, 'direct_manager_code');
        const isBranchDirector = parseExcelBooleanCell(row, headers, 'is_branch_director');

        console.log(`📊 Row ${rowNumber}:`, {
          employee_code: employeeCode,
          full_name: fullName,
          email,
          branch_code: branchCode,
          branch_name: branchName,
          department_code: departmentCode,
          department_name: departmentName,
          system_roles: systemRoles,
          direct_manager_code: directManagerCode || '(empty)',
          is_branch_director: isBranchDirector,
        });

        if (!fullName.trim()) {
          console.log(`📊 Row ${rowNumber}: No full_name, skipping`);
          continue;
        }

        const excelRow: ExcelRow = {
          employee_code: employeeCode,
          full_name: fullName,
          email,
          branch_code: branchCode,
          branch_name: branchName,
          department_name: departmentName,
          department_code: departmentCode,
          job_title: getExcelCell(row, headers, 'job_title'),
          work_location: getExcelCell(row, headers, 'work_location'),
          is_branch_director: isBranchDirector,
          level_code: getExcelCell(row, headers, 'level_code'),
          system_roles: systemRoles,
          direct_manager_code: directManagerCode,
        };

        rows.push(excelRow);
      } catch (rowError: any) {
        console.error(`❌ Error parsing row ${rowNumber}:`, rowError);
        // Continue with next row
      }
    }

    console.log('📊 Parsed rows:', rows.length);
    if (rows.length === 0) {
      console.warn('⚠️ No valid rows found in Excel file!');
      console.warn('⚠️ This could be because:');
      console.warn('   1. Excel file has no data rows (only headers)');
      console.warn('   2. All rows are missing employee_code');
      console.warn('   3. All rows are missing full_name');
      console.warn('   5. Headers are not matching (case-sensitive)');
      
      // Get actual headers from Excel for better error message
      const actualHeaders: string[] = [];
      headerRow.eachCell((cell) => {
        const value = cell.value?.toString()?.trim();
        if (value) actualHeaders.push(value);
      });
      
      return reply.code(400).send({
        error: 'No valid data rows found in Excel file',
        message:
          'Please check data rows: employee_code, full_name (required). Email optional — auto-generated if omitted.',
        headersFound: Object.keys(headers),
        actualHeaders: actualHeaders,
        totalRowsInFile: worksheet.rowCount - 1,
        requiredColumns: [...REQUIRED_EMPLOYEE_COLUMNS],
      });
    }
    if (rows.length === 0) {
      console.warn('⚠️ No valid rows found in Excel file!');
    }

    // Results summary
    const results = {
      branches: { created: 0, skipped: 0, errors: [] as string[] },
      departments: { created: 0, skipped: 0, errors: [] as string[] },
      users: { created: 0, skipped: 0, failed: 0, errors: [] as Array<{ employee_code: string; error: string }> },
      roles: { validated: 0, invalid: [] as Array<{ employee_code: string; role: string }> },
    };

    console.log('📊 Starting import process...');

    // 1. Extract and create Branches
    console.log('📊 Step 1: Processing Branches...');
    const uniqueBranches = new Set<string>();
    rows.forEach(row => {
      if (row.branch_code) {
        uniqueBranches.add(row.branch_code);
      }
    });

    console.log('📊 Unique branches found:', Array.from(uniqueBranches));

    for (const branchCode of uniqueBranches) {
      try {
        const existingBranch = await prisma.branch.findFirst({
          where: {
            branchCode: branchCode,
            deletedAt: null,
          },
        });

        if (existingBranch) {
          results.branches.skipped++;
          console.log(`📊 Branch ${branchCode} already exists, skipped`);
        } else {
          const rowWithBranch = rows.find((r) => r.branch_code === branchCode && r.branch_name?.trim());
          const displayBranchName = rowWithBranch?.branch_name?.trim() || branchCode;

          await prisma.branch.create({
            data: {
              branchCode: branchCode,
              branchName: displayBranchName,
              status: true,
            },
          });
          results.branches.created++;
          console.log(`✅ Created branch: ${branchCode}`);
        }
      } catch (error: any) {
        console.error(`❌ Error creating branch ${branchCode}:`, error);
        results.branches.errors.push(`${branchCode}: ${error.message}`);
      }
    }

    console.log('📊 Branches summary:', results.branches);

    // 2. Extract and create Departments
    console.log('📊 Step 2: Processing Departments...');
    const uniqueDepartments = new Set<string>();
    rows.forEach(row => {
      if (row.department_code) {
        uniqueDepartments.add(row.department_code);
      }
    });

    console.log('📊 Unique departments found:', Array.from(uniqueDepartments));

    for (const departmentCode of uniqueDepartments) {
      try {
        const existingDepartment = await prisma.department.findFirst({
          where: {
            departmentCode: departmentCode,
            deletedAt: null,
          },
        });

        if (existingDepartment) {
          results.departments.skipped++;
          console.log(`📊 Department ${departmentCode} already exists, skipped`);
        } else {
          const rowWithDept = rows.find(
            (r) => r.department_code === departmentCode && r.department_name?.trim()
          );
          const displayDeptName = rowWithDept?.department_name?.trim() || departmentCode;

          await prisma.department.create({
            data: {
              departmentCode: departmentCode,
              departmentName: displayDeptName,
              status: true,
            },
          });
          results.departments.created++;
          console.log(`✅ Created department: ${departmentCode}`);
        }
      } catch (error: any) {
        console.error(`❌ Error creating department ${departmentCode}:`, error);
        results.departments.errors.push(`${departmentCode}: ${error.message}`);
      }
    }

    console.log('📊 Departments summary:', results.departments);

    // 3. Validate and import Users
    console.log('📊 Step 3: Processing Users...');
    for (const row of rows) {
      try {
        const mappedRole = mapRoleFromExcelRow(row);
        if (
          mappedRole === 'REQUESTOR' &&
          row.system_roles?.trim() &&
          !row.is_branch_director
        ) {
          const upperRole = row.system_roles.toUpperCase().trim();
          const validRoles = [
            'REQUESTOR',
            'DEPARTMENT_HEAD',
            'BRANCH_MANAGER',
            'BRANCH_DIRECTOR',
            'BUYER',
            'BUYER_LEADER',
            'BUYER_MANAGER',
            'ACCOUNTANT',
            'WAREHOUSE',
            'BGD',
            'SYSTEM_ADMIN',
          ];
          if (!validRoles.some((r) => upperRole.includes(r))) {
            results.roles.invalid.push({
              employee_code: row.employee_code,
              role: row.system_roles,
            });
          }
        }
        results.roles.validated++;

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: row.employee_code },
              { email: row.email },
            ],
            deletedAt: null,
          },
        });

        if (existingUser) {
          results.users.skipped++;
          results.users.errors.push({
            employee_code: row.employee_code,
            error: `User already exists: ${existingUser.username === row.employee_code ? 'username' : 'email'}`,
          });
          continue;
        }

        // Get branch ID if branch_code exists
        let branchId: string | null = null;
        if (row.branch_code) {
          const branch = await prisma.branch.findFirst({
            where: {
              branchCode: row.branch_code,
              deletedAt: null,
            },
            select: { id: true },
          });
          branchId = branch?.id || null;
        }

        // Create user
        const newUser = await prisma.user.create({
          data: {
            username: row.employee_code,
            fullName: row.full_name || null,
            email: row.email,
            passwordHash: passwordHash,
            role: mappedRole as any,
            location: row.work_location || row.branch_code || null,
            department: row.department_code || null,
            jobTitle: row.job_title || null,
            directManagerCode: row.direct_manager_code || null,
            companyId: null,
          },
        });

        // Create audit log
        await auditCreate(
          'users',
          newUser.id,
          userId,
          {
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            location: newUser.location,
            department: newUser.department,
            imported: true,
            source: 'excel_import_master_data',
          }
        );

        results.users.created++;
        console.log(`✅ Created user: ${row.employee_code}`);
      } catch (error: any) {
        results.users.failed++;
        console.error(`❌ Error creating user ${row.employee_code}:`, error);
        results.users.errors.push({
          employee_code: row.employee_code,
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log('📊 Users summary:', results.users);
    console.log('📊 Roles summary:', results.roles);

    // Ensure all results are properly initialized
    const response = {
      message: 'Master data import completed',
      totalRows: rows.length,
      results: {
        branches: {
          total: uniqueBranches.size,
          created: results.branches?.created || 0,
          skipped: results.branches?.skipped || 0,
          errors: results.branches?.errors || [],
        },
        departments: {
          total: uniqueDepartments.size,
          created: results.departments?.created || 0,
          skipped: results.departments?.skipped || 0,
          errors: results.departments?.errors || [],
        },
        users: {
          total: rows.length,
          created: results.users?.created || 0,
          skipped: results.users?.skipped || 0,
          failed: results.users?.failed || 0,
          errors: results.users?.errors || [],
        },
        roles: {
          validated: results.roles?.validated || 0,
          invalid: results.roles?.invalid || [],
        },
      },
      defaultPassword: defaultPassword,
      emailNote:
        'Nếu không có cột email hợp lệ: dùng {employee_code}@import.rmg.local.',
    };

    console.log('✅ Import master data completed');
    console.log('📊 Final response:', JSON.stringify(response, null, 2));
    
    // Create import history record (use EMPLOYEE type for master data)
    try {
      await prisma.importHistory.create({
        data: {
          fileName: data.filename || 'master_data.xlsx',
          importType: 'EMPLOYEE', // Use EMPLOYEE as it's the closest match
          importedBy: userId,
          success: response.results.users.created + response.results.branches.created + response.results.departments.created,
          failed: response.results.users.failed,
          errors: response.results.users.errors.length > 0 
            ? response.results.users.errors.map(e => `${e.employee_code}: ${e.error}`)
            : null,
        },
      });
      console.log('✅ Import history record created');
    } catch (historyError: any) {
      console.error('⚠️ Error creating import history:', historyError);
      // Don't fail the import if history creation fails
    }
    
    try {
      reply.send(response);
    } catch (replyError: any) {
      console.error('❌ Error sending response:', replyError);
      // Response might already be sent, ignore
    }
  } catch (error: any) {
    console.error('❌ Import master data error:', error);
    console.error('Error stack:', error.stack);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
      details: error.stack,
    });
  }
};

// Preview Master Data Excel (validate without importing)
export const previewMasterDataExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    const buffer = await data.toBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return reply.code(400).send({ error: 'Excel file is empty' });
    }

    // Parse headers
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const headerValue = cell.value?.toString()?.toLowerCase().trim();
      if (headerValue) {
        headers[headerValue] = colNumber;
      }
    });

    const missingColumns = REQUIRED_EMPLOYEE_COLUMNS.filter((col) => !headers[col]);

    // Extract unique branches and departments
    const uniqueBranches = new Set<string>();
    const uniqueDepartments = new Set<string>();

    // Parse preview data (first 10 rows)
    const previewRows: any[] = [];
    const maxPreviewRows = 10;

    for (let rowNumber = 2; rowNumber <= Math.min(worksheet.rowCount, maxPreviewRows + 1); rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const employeeCode = getExcelCell(row, headers, 'employee_code');

      if (!employeeCode) continue;

      const branchCode = getExcelCell(row, headers, 'branch_code');
      const departmentCode = getExcelCell(row, headers, 'department_code');

      if (branchCode) uniqueBranches.add(branchCode);
      if (departmentCode) uniqueDepartments.add(departmentCode);

      const fullName = getExcelCell(row, headers, 'full_name') || '';
      const email = resolveImportEmail(row, headers, employeeCode);
      const systemRoles = getExcelCell(row, headers, 'system_roles');
      const isBranchDirector = parseExcelBooleanCell(row, headers, 'is_branch_director');

      const previewRow: any = {
        rowNumber: rowNumber,
        employee_code: employeeCode,
        full_name: fullName,
        email,
        email_source: getExcelCell(row, headers, 'email') ? 'column' : 'synthetic',
        branch_code: branchCode || '',
        branch_name: getExcelCell(row, headers, 'branch_name') || '',
        department_code: departmentCode || '',
        department_name: getExcelCell(row, headers, 'department_name') || '',
        job_title: getExcelCell(row, headers, 'job_title') || '',
        work_location: getExcelCell(row, headers, 'work_location') || '',
        is_branch_director: isBranchDirector,
        level_code: getExcelCell(row, headers, 'level_code') || '',
        system_roles: systemRoles || '',
        direct_manager_code: getExcelCell(row, headers, 'direct_manager_code') || '',
      };

      previewRow.mapped_role = mapRoleFromExcelRow({
        system_roles: previewRow.system_roles,
        is_branch_director: previewRow.is_branch_director,
      });
      previewRows.push(previewRow);
    }

    // Check existing branches and departments
    const existingBranches = await prisma.branch.findMany({
      where: {
        branchCode: { in: Array.from(uniqueBranches) },
        deletedAt: null,
      },
      select: { branchCode: true },
    });

    const existingDepartments = await prisma.department.findMany({
      where: {
        departmentCode: { in: Array.from(uniqueDepartments) },
        deletedAt: null,
      },
      select: { departmentCode: true },
    });

    const existingBranchCodes = new Set(existingBranches.map(b => b.branchCode));
    const existingDepartmentCodes = new Set(existingDepartments.map(d => d.departmentCode));

    const newBranches = Array.from(uniqueBranches).filter(b => !existingBranchCodes.has(b));
    const newDepartments = Array.from(uniqueDepartments).filter(d => !existingDepartmentCodes.has(d));

    reply.send({
      headers: Object.keys(headers),
      missingColumns,
      totalRows: worksheet.rowCount - 1,
      previewRows,
      isValid: missingColumns.length === 0,
      summary: {
        branches: {
          total: uniqueBranches.size,
          existing: existingBranches.length,
          new: newBranches.length,
          list: Array.from(uniqueBranches),
        },
        departments: {
          total: uniqueDepartments.size,
          existing: existingDepartments.length,
          new: newDepartments.length,
          list: Array.from(uniqueDepartments),
        },
        users: {
          total: worksheet.rowCount - 1,
          preview: previewRows.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Preview master data error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Preview Excel file (validate without importing)
export const previewExcelImport = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    const buffer = await data.toBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return reply.code(400).send({ error: 'Excel file is empty' });
    }

    // Parse headers
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const headerValue = cell.value?.toString()?.toLowerCase().trim();
      if (headerValue) {
        headers[headerValue] = colNumber;
      }
    });

    const missingColumns = REQUIRED_EMPLOYEE_COLUMNS.filter((col) => !headers[col]);

    // Parse preview data (first 10 rows)
    const previewRows: any[] = [];
    const maxPreviewRows = 10;

    for (let rowNumber = 2; rowNumber <= Math.min(worksheet.rowCount, maxPreviewRows + 1); rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const employeeCode = getExcelCell(row, headers, 'employee_code');

      if (!employeeCode) continue;

      const fullName = getExcelCell(row, headers, 'full_name') || '';
      const email = resolveImportEmail(row, headers, employeeCode);
      const isBranchDirector = parseExcelBooleanCell(row, headers, 'is_branch_director');
      const systemRoles = getExcelCell(row, headers, 'system_roles') || '';

      const previewRow: any = {
        rowNumber: rowNumber,
        employee_code: employeeCode,
        full_name: fullName,
        email,
        email_source: getExcelCell(row, headers, 'email') ? 'column' : 'synthetic',
        branch_code: getExcelCell(row, headers, 'branch_code') || '',
        branch_name: getExcelCell(row, headers, 'branch_name') || '',
        department_code: getExcelCell(row, headers, 'department_code') || '',
        department_name: getExcelCell(row, headers, 'department_name') || '',
        job_title: getExcelCell(row, headers, 'job_title') || '',
        work_location: getExcelCell(row, headers, 'work_location') || '',
        is_branch_director: isBranchDirector,
        level_code: getExcelCell(row, headers, 'level_code') || '',
        system_roles: systemRoles,
        direct_manager_code: getExcelCell(row, headers, 'direct_manager_code') || '',
      };

      previewRow.mapped_role = mapRoleFromExcelRow({
        system_roles: previewRow.system_roles,
        is_branch_director: previewRow.is_branch_director,
      });

      previewRows.push(previewRow);
    }

    reply.send({
      headers: Object.keys(headers),
      missingColumns,
      totalRows: worksheet.rowCount - 1, // Exclude header row
      previewRows,
      isValid: missingColumns.length === 0,
    });
  } catch (error: any) {
    console.error('Preview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

