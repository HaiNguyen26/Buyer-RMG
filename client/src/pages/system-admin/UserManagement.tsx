import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Settings, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { systemAdminService } from '../../services/systemAdminService';
import type { Employee } from '../../services/systemAdminService';

const SYSTEM_ROLES = [
  'REQUESTOR',
  'DEPARTMENT_HEAD',
  'BRANCH_MANAGER',
  'BUYER',
  'BUYER_LEADER',
  'BUYER_MANAGER',
  'ACCOUNTANT',
  'WAREHOUSE',
  'BGD',
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
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Branch Code</label>
            <input
              type="text"
              value={filters.branchCode}
              onChange={(e) => setFilters({ ...filters, branchCode: e.target.value })}
              placeholder="Filter by branch..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Department Code</label>
            <input
              type="text"
              value={filters.departmentCode}
              onChange={(e) => setFilters({ ...filters, departmentCode: e.target.value })}
              placeholder="Filter by dept..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ branchCode: '', departmentCode: '', status: '' })}
              className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-700">
            <div className="col-span-1"></div>
            <div className="col-span-1">Employee Code</div>
            <div className="col-span-2">Full Name</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-1">Branch</div>
            <div className="col-span-1">Department</div>
            <div className="col-span-1">Job Title</div>
            <div className="col-span-2">System Roles</div>
            <div className="col-span-1">Status</div>
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
                  <div className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="col-span-1 flex items-center">
                      <button
                        onClick={() => toggleRowExpansion(employee.id)}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                    </div>
                    <div className="col-span-1 flex items-center text-sm font-medium text-slate-900">
                      {employee.employeeCode}
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-slate-700">
                      {employee.fullName}
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-slate-600">
                      {employee.email}
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {employee.branchCode || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {employee.departmentCode || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center text-sm text-slate-600">
                      {employee.jobTitle || 'N/A'}
                    </div>
                    <div className="col-span-2 flex items-center gap-1 flex-wrap">
                      {employee.systemRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                    <div className="col-span-1 flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(employee)}
                        disabled={updateStatusMutation.isPending}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                        onClick={() => handleConfigClick(employee)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Cấu hình roles"
                      >
                        <Settings className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Row - Role Configuration */}
                  {isExpanded && (
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            System Roles Configuration
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Cấu hình System Roles</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedEmployee.fullName} ({selectedEmployee.employeeCode})</p>
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

