import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SystemAdminDashboardData {
  totalEmployees: number;
  totalDepartments: number;
  totalBranches: number;
  activePRs: number;
  activeApprovalRules: number;
  warnings: Array<{
    title: string;
    message: string;
    count?: number;
  }>;
}

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  branchCode: string;
  departmentCode: string;
  jobTitle: string;
  systemRoles: string[];
  status: 'ACTIVE' | 'INACTIVE';
};

export interface ApprovalRule {
  id: string;
  departmentCode: string;
  prType: 'MATERIAL' | 'SERVICE' | 'COMMERCIAL';
  needBranchManager: boolean; // YES/NO - Does this department need BRANCH_MANAGER approval?
  status: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface BranchApprovalRule {
  branchId: string;
  branchCode: string;
  branchName: string;
  ruleId: string | null;
  needBranchManagerApproval: boolean; // YES/NO - Need Branch Manager approval (level 2)
  note: string;
  updatedAt: string | null;
}

export interface Branch {
  id: string;
  branchCode: string;
  branchName: string;
  branchDirector: string | null;
  status: boolean;
}

export interface Department {
  id: string;
  departmentCode: string;
  departmentName: string;
  status: boolean;
  approvalRuleId?: string;
  note?: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  importType: 'EMPLOYEE' | 'DEPT' | 'RULE';
  importedBy: string;
  success: number;
  failed: number;
  importedAt: string;
}

export const systemAdminService = {
  // Dashboard
  getDashboard: async (): Promise<SystemAdminDashboardData> => {
    const response = await api.get('/system-admin/dashboard');
    return response.data;
  },

  // User Management
  getEmployees: async (params?: {
    branchCode?: string;
    departmentCode?: string;
    status?: string;
  }): Promise<{ employees: Employee[] }> => {
    const response = await api.get('/system-admin/employees', { params });
    return response.data;
  },

  updateEmployee: async (id: string, data: Partial<Employee>): Promise<Employee> => {
    const response = await api.put(`/system-admin/employees/${id}`, data);
    return response.data;
  },

  updateEmployeeRoles: async (id: string, roles: string[]): Promise<Employee> => {
    const response = await api.put(`/system-admin/employees/${id}/roles`, { roles });
    return response.data;
  },

  toggleEmployeeStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<Employee> => {
    const response = await api.put(`/system-admin/employees/${id}/status`, { status });
    return response.data;
  },

  // Approval Configuration
  getApprovalRules: async (params?: {
    departmentCode?: string;
    prType?: string;
    status?: boolean;
  }): Promise<{ rules: ApprovalRule[] }> => {
    const response = await api.get('/system-admin/approval-rules', { params });
    return response.data;
  },

  createApprovalRule: async (data: Omit<ApprovalRule, 'id' | 'updatedBy' | 'updatedAt'>): Promise<ApprovalRule> => {
    const response = await api.post('/system-admin/approval-rules', data);
    return response.data;
  },

  updateApprovalRule: async (id: string, data: Partial<ApprovalRule>): Promise<ApprovalRule> => {
    const response = await api.put(`/system-admin/approval-rules/${id}`, data);
    return response.data;
  },

  toggleApprovalRuleStatus: async (id: string, status: boolean): Promise<ApprovalRule> => {
    const response = await api.put(`/system-admin/approval-rules/${id}/status`, { status });
    return response.data;
  },

  // Approval Config (NEW) - Branch Approval Rule (YES/NO duyệt cấp 2 theo chi nhánh)
  getBranchApprovalRules: async (): Promise<{ rules: BranchApprovalRule[] }> => {
    const response = await api.get('/system-admin/branch-approval-rules');
    return response.data;
  },

  updateBranchApprovalRule: async (
    branchCode: string,
    data: { needBranchManagerApproval: boolean; note?: string | null }
  ): Promise<BranchApprovalRule> => {
    const response = await api.put(`/system-admin/branch-approval-rules/${branchCode}`, data);
    return response.data;
  },

  // Organization Management - Branches
  getBranches: async (): Promise<{ branches: Branch[] }> => {
    const response = await api.get('/system-admin/branches');
    return response.data;
  },

  createBranch: async (data: Omit<Branch, 'id'>): Promise<Branch> => {
    const response = await api.post('/system-admin/branches', data);
    return response.data;
  },

  updateBranch: async (id: string, data: Partial<Branch>): Promise<Branch> => {
    const response = await api.put(`/system-admin/branches/${id}`, data);
    return response.data;
  },

  // Organization Management - Departments
  getDepartments: async (): Promise<{ departments: Department[] }> => {
    const response = await api.get('/system-admin/departments');
    return response.data;
  },

  createDepartment: async (data: Omit<Department, 'id'>): Promise<Department> => {
    const response = await api.post('/system-admin/departments', data);
    return response.data;
  },

  updateDepartment: async (id: string, data: Partial<Department>): Promise<Department> => {
    const response = await api.put(`/system-admin/departments/${id}`, data);
    return response.data;
  },

  // Import Center
  getImportHistory: async (params?: {
    importType?: string;
    limit?: number;
  }): Promise<{ imports: ImportHistory[] }> => {
    const response = await api.get('/system-admin/import-history', { params });
    return response.data;
  },

  uploadExcel: async (file: File, importType: 'EMPLOYEE' | 'DEPT' | 'RULE'): Promise<{
    success: number;
    failed: number;
    errors?: Array<{ row: number; message: string }>;
    errorFileUrl?: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', importType);
    const response = await api.post('/system-admin/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  previewExcel: async (file: File, importType: 'EMPLOYEE' | 'DEPT' | 'RULE'): Promise<{
    totalRows: number;
    preview: any[];
    errors?: Array<{ row: number; message: string }>;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', importType);
    formData.append('preview', 'true');
    const response = await api.post('/system-admin/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Import Users from Excel (new)
  previewUsersExcel: async (file: File): Promise<{
    headers: string[];
    missingColumns: string[];
    totalRows: number;
    previewRows: Array<{
      rowNumber: number;
      employee_code: string;
      full_name: string;
      email: string;
      branch_code: string;
      department_code: string;
      job_title: string;
      level_code: string;
      system_roles: string;
      direct_manager_code: string;
      mapped_role: string;
    }>;
    isValid: boolean;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/system-admin/import/users/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importUsersExcel: async (file: File): Promise<{
    message: string;
    totalRows: number;
    results: {
      success: number;
      skipped: number;
      failed: number;
      errors: Array<{ employee_code: string; error: string }>;
    };
    defaultPassword: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/system-admin/import/users', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Import Master Data (Users + Branches + Departments)
  previewMasterDataExcel: async (file: File): Promise<{
    headers: string[];
    missingColumns: string[];
    totalRows: number;
    previewRows: Array<{
      rowNumber: number;
      employee_code: string;
      full_name: string;
      email: string;
      branch_code: string;
      department_code: string;
      job_title: string;
      level_code: string;
      system_roles: string;
      direct_manager_code: string;
      mapped_role: string;
    }>;
    isValid: boolean;
    summary: {
      branches: {
        total: number;
        existing: number;
        new: number;
        list: string[];
      };
      departments: {
        total: number;
        existing: number;
        new: number;
        list: string[];
      };
      users: {
        total: number;
        preview: number;
      };
    };
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/system-admin/import/master-data/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importMasterDataExcel: async (file: File): Promise<{
    message: string;
    totalRows: number;
    results: {
      branches: {
        total: number;
        created: number;
        skipped: number;
        errors: string[];
      };
      departments: {
        total: number;
        created: number;
        skipped: number;
        errors: string[];
      };
      users: {
        total: number;
        created: number;
        skipped: number;
        failed: number;
        errors: Array<{ employee_code: string; error: string }>;
      };
      roles: {
        validated: number;
        invalid: Array<{ employee_code: string; role: string }>;
      };
    };
    defaultPassword: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/system-admin/import/master-data', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Organization Management
  getOrganizationHierarchy: async (): Promise<{
    hierarchyByBranch: Array<{
      branchId: string;
      branchCode: string;
      branchName: string;
      branchManager: {
        id: string;
        employeeCode: string;
        fullName: string;
        email: string;
        role: string;
      } | null;
      hierarchy: any[];
      totalEmployees: number;
    }>;
    flatList: Array<{
      id: string;
      employeeCode: string;
      fullName: string;
      email: string;
      role: string;
      branchCode: string | null;
      departmentCode: string | null;
      jobTitle: string | null;
      directManagerCode: string | null;
      directManagerName: string | null;
      subordinateCount: number;
    }>;
    totalEmployees: number;
    totalBranches: number;
    totalManagers: number;
  }> => {
    const response = await api.get('/organization/hierarchy');
    return response.data;
  },

  getBranchDirectors: async (): Promise<{
    branchManagers: Array<{
      id: string;
      employeeCode: string;
      fullName: string;
      email: string;
      branchCode: string | null;
      departmentCode: string | null;
      jobTitle: string | null;
    }>;
    branchesWithManagers: Array<{
      branchId: string;
      branchCode: string;
      branchName: string;
      manager: {
        id: string;
        employeeCode: string;
        fullName: string;
        email: string;
        departmentCode: string | null;
        jobTitle: string | null;
      } | null;
    }>;
    totalBranches: number;
    branchesWithManager: number;
    branchesWithoutManager: number;
  }> => {
    const response = await api.get('/organization/branch-directors');
    return response.data;
  },

  getEmployeeManager: async (employeeCode: string): Promise<{
    employeeCode: string;
    employeeName: string;
    hasManager: boolean;
    manager: {
      id: string;
      employeeCode: string;
      fullName: string;
      email: string;
      role: string;
      branchCode: string | null;
      departmentCode: string | null;
      jobTitle: string | null;
    } | null;
  }> => {
    const response = await api.get(`/organization/employee/${employeeCode}/manager`);
    return response.data;
  },

  getEmployeeSubordinates: async (employeeCode: string): Promise<{
    managerCode: string;
    subordinates: Array<{
      id: string;
      employeeCode: string;
      fullName: string;
      email: string;
      role: string;
      branchCode: string | null;
      departmentCode: string | null;
      jobTitle: string | null;
    }>;
    count: number;
  }> => {
    const response = await api.get(`/organization/employee/${employeeCode}/subordinates`);
    return response.data;
  },
};

