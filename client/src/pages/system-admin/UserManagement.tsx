import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Settings, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { systemAdminService } from '../../services/systemAdminService';
import type { Employee } from '../../services/systemAdminService';
import CustomSelect from '../../components/CustomSelect';

const SYSTEM_ROLES = [
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
  'SALES',
];

const UserManagement = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    branchCode: '',
    departmentCode: '',
    status: '',
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: employeesData, isLoading, error } = useQuery({
    queryKey: ['system-admin-employees', filters],
    queryFn: () => systemAdminService.getEmployees(filters),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      systemAdminService.toggleEmployeeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-admin-employees'] });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      systemAdminService.updateEmployeeRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-admin-employees'] });
      setShowRolesModal(false);
      setSelectedEmployee(null);
    },
  });

  const employees = employeesData?.employees || [];

  const handleExportExcel = () => {
    if (!employees || employees.length === 0) return;

    // Define the columns for export
    const exportData = employees.map((emp) => ({
      'Mã NV': emp.employeeCode || '',
      'Họ tên': emp.fullName || '',
      Email: emp.email || '',
      'Chi nhánh': emp.branchName || '',
      'Phòng ban': emp.departmentName || '',
      'Chức danh': emp.jobTitle || '',
      'Quản lý trực tiếp': emp.directManagerName || '',
      'Vai trò': emp.systemRoles?.join(', ') || '',
      'GĐ chi nhánh': emp.isBranchDirector ? 'Có' : 'Không',
      'Trạng thái': emp.status || '',
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Auto-adjust column widths
    const maxWidths = exportData.reduce((acc: any, row) => {
      Object.keys(row).forEach(key => {
        const val = String((row as any)[key] || '');
        acc[key] = Math.max(acc[key] || key.length, val.length);
      });
      return acc;
    }, {});
    
    worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: maxWidths[key] + 2 }));

    // Generate Excel file
    XLSX.writeFile(workbook, 'User_List.xlsx');
  };

  const handleToggleStatus = (employee: Employee) => {
    const newStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateStatusMutation.mutate({ id: employee.id, status: newStatus });
  };

  const handleConfigClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowRolesModal(true);
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
        <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-gradient-to-b from-slate-50/50 to-white min-h-full">
      {/* Page header */}
      <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
            <p className="text-slate-600 text-sm mt-0.5">Phân quyền và quản lý tài khoản nhân viên</p>
          </div>
        </div>
        
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-sm hover:shadow-md"
        >
          <Download className="w-4 h-4" />
          Xuất Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mã chi nhánh</label>
            <input
              type="text"
              value={filters.branchCode}
              onChange={(e) => setFilters({ ...filters, branchCode: e.target.value })}
              placeholder="Lọc theo chi nhánh..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mã phòng ban</label>
            <input
              type="text"
              value={filters.departmentCode}
              onChange={(e) => setFilters({ ...filters, departmentCode: e.target.value })}
              placeholder="Lọc theo phòng ban..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
            <CustomSelect
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400"
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Không hoạt động</option>
            </CustomSelect>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ branchCode: '', departmentCode: '', status: '' })}
              className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
            <div className="col-span-1" aria-hidden />
            <div className="col-span-1">Mã NV</div>
            <div className="col-span-2">Họ tên</div>
            <div className="col-span-2">Chi nhánh</div>
            <div className="col-span-2">Phòng ban</div>
            <div className="col-span-1">Chức danh</div>
            <div className="col-span-1">Quản lý trực tiếp</div>
            <div className="col-span-1">Vai trò</div>
            <div className="col-span-1 text-center">GĐ chi nhánh</div>
            <div className="col-span-1 text-right">Thao tác</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {employees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-slate-500 text-lg font-medium">Không có nhân viên nào</p>
            </div>
          ) : (
            employees.map((employee) => {
              const isExpanded = expandedRows.has(employee.id);
              return (
                <div key={employee.id}>
                  <div className="grid grid-cols-12 gap-3 px-6 py-4 hover:bg-slate-50 transition-colors items-center">
                    <div className="col-span-1 flex items-center">
                      <button
                        type="button"
                        onClick={() => toggleRowExpansion(employee.id)}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                    </div>
                    <div className="col-span-1 text-sm font-medium text-slate-900 truncate" title={employee.employeeCode}>
                      {employee.employeeCode}
                    </div>
                    <div className="col-span-2 text-sm text-slate-700 truncate" title={employee.fullName}>
                      {employee.fullName}
                    </div>
                    <div className="col-span-2 text-sm text-slate-700 truncate" title={employee.branchName}>
                      {employee.branchName || '—'}
                    </div>
                    <div className="col-span-2 text-sm text-slate-700 truncate" title={employee.departmentName}>
                      {employee.departmentName || '—'}
                    </div>
                    <div className="col-span-1 text-sm text-slate-600 truncate" title={employee.jobTitle || ''}>
                      {employee.jobTitle || '—'}
                    </div>
                    <div
                      className="col-span-1 text-sm text-slate-700 truncate"
                      title={employee.directManagerName}
                    >
                      {employee.directManagerName || '—'}
                    </div>
                    <div className="col-span-1 flex flex-wrap gap-1">
                      {employee.systemRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex max-w-full truncate px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800"
                          title={role}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          employee.isBranchDirector
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {employee.isBranchDirector ? 'Có' : 'Không'}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(employee)}
                        disabled={updateStatusMutation.isPending}
                        title={employee.status === 'ACTIVE' ? 'Đang hoạt động' : 'Không hoạt động'}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          employee.status === 'ACTIVE' ? 'bg-green-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            employee.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfigClick(employee)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"
                        title="Cấu hình vai trò"
                      >
                        <Settings className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Row - Role Configuration */}
                  {isExpanded && (
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                          Email đăng nhập (hệ thống):{' '}
                          <span className="font-medium text-slate-700">{employee.email}</span>
                        </p>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Cấu hình quyền hệ thống (system_roles)
                        </label>
                          <div className="flex flex-wrap gap-2">
                            {SYSTEM_ROLES.map((role) => {
                              const isSelected = employee.systemRoles.includes(role);
                              return (
                                <button
                                  key={role}
                                  onClick={() => {
                                    const newRoles = isSelected
                                      ? employee.systemRoles.filter((r) => r !== role)
                                      : [...employee.systemRoles, role];
                                    updateRolesMutation.mutate({ id: employee.id, roles: newRoles });
                                  }}
                                  disabled={updateRolesMutation.isPending}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-indigo-50'
                                  }`}
                                >
                                  {role}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Roles Configuration Modal */}
      {showRolesModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-popup-overlay" onClick={() => { setShowRolesModal(false); setSelectedEmployee(null); }}>
          <div className="modal-popup-panel bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Cấu hình vai trò (system_roles)</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedEmployee.fullName} ({selectedEmployee.employeeCode}) · {selectedEmployee.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRolesModal(false);
                  setSelectedEmployee(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Chọn System Roles (có thể chọn nhiều)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SYSTEM_ROLES.map((role) => {
                    const isSelected = selectedEmployee.systemRoles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          const newRoles = isSelected
                            ? selectedEmployee.systemRoles.filter((r) => r !== role)
                            : [...selectedEmployee.systemRoles, role];
                          setSelectedEmployee({ ...selectedEmployee, systemRoles: newRoles });
                        }}
                        className={`p-3 rounded-lg text-sm font-medium transition-colors text-left ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{role}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowRolesModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (selectedEmployee) {
                      updateRolesMutation.mutate({
                        id: selectedEmployee.id,
                        roles: selectedEmployee.systemRoles,
                      });
                    }
                  }}
                  disabled={updateRolesMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {updateRolesMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

