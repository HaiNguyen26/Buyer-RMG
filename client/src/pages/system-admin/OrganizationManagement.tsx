import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, ChevronRight, ChevronDown, Crown, UserCheck, AlertCircle, Briefcase } from 'lucide-react';
import { systemAdminService } from '../../services/systemAdminService';

const OrganizationManagement = () => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'managers'>('hierarchy');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  const { data: hierarchyData, isLoading: hierarchyLoading, error: hierarchyError } = useQuery({
    queryKey: ['organization-hierarchy'],
    queryFn: () => systemAdminService.getOrganizationHierarchy(),
    retry: 2,
  });

  const { data: managersData, isLoading: managersLoading, error: managersError } = useQuery({
    queryKey: ['branch-directors'],
    queryFn: () => systemAdminService.getBranchDirectors(),
    retry: 2,
  });

  // Debug logging
  if (hierarchyData) {
    console.log('📊 Hierarchy Data:', hierarchyData);
  }
  if (hierarchyError) {
    console.error('❌ Hierarchy Error:', hierarchyError);
  }
  if (managersData) {
    console.log('📊 Managers Data:', managersData);
  }
  if (managersError) {
    console.error('❌ Managers Error:', managersError);
  }

  const toggleNode = (employeeCode: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(employeeCode)) {
      newExpanded.delete(employeeCode);
    } else {
      newExpanded.add(employeeCode);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleBranch = (branchCode: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchCode)) {
      newExpanded.delete(branchCode);
    } else {
      newExpanded.add(branchCode);
    }
    setExpandedBranches(newExpanded);
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'BRANCH_MANAGER') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (role === 'DEPARTMENT_HEAD') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'BRANCH_MANAGER') return 'Giám đốc chi nhánh';
    if (role === 'DEPARTMENT_HEAD') return 'Trưởng phòng/Nhóm';
    return role;
  };

  const renderHierarchyNode = (node: any, level: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.employeeCode);
    const hasSubordinates = node.subordinates && node.subordinates.length > 0;

    return (
      <div key={node.id} className="ml-4">
        <div
          className={`flex items-center gap-2 p-3 rounded-lg hover:bg-slate-50 transition-colors border ${
            level === 0 
              ? 'bg-purple-50 border-purple-200' 
              : level === 1 
              ? 'bg-blue-50 border-blue-200'
              : 'bg-white border-slate-200'
          }`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          {hasSubordinates ? (
            <button
              onClick={() => toggleNode(node.employeeCode)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-600" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
          <div className="flex-1 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              level === 0 ? 'bg-purple-200' : level === 1 ? 'bg-blue-200' : 'bg-slate-200'
            }`}>
              {level === 0 ? (
                <Crown className="w-5 h-5 text-purple-700" />
              ) : level === 1 ? (
                <Briefcase className="w-5 h-5 text-blue-700" />
              ) : (
                <Users className="w-5 h-5 text-slate-700" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900">{node.fullName}</span>
                <span className="text-xs text-slate-500">({node.employeeCode})</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(node.role)}`}>
                  {getRoleLabel(node.role)}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {node.email}
                {node.departmentCode && ` • ${node.departmentCode}`}
                {node.jobTitle && ` • ${node.jobTitle}`}
              </div>
            </div>
            {node.subordinateCount > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                {node.subordinateCount} nhân viên
              </span>
            )}
          </div>
        </div>
        {isExpanded && hasSubordinates && (
          <div className="mt-1">
            {node.subordinates.map((sub: any) => renderHierarchyNode(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Organization Management</h1>
        <p className="text-slate-600">Quản lý cấu trúc tổ chức và quan hệ quản lý</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'hierarchy'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Cấu trúc tổ chức</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('managers')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'managers'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-4 h-4" />
              <span>Giám đốc chi nhánh</span>
            </div>
          </button>
        </div>
      </div>

      {/* Hierarchy Tab */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {hierarchyLoading ? (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">Đang tải...</p>
                </div>
              </div>
            </div>
          ) : hierarchyData && hierarchyData.hierarchyByBranch && hierarchyData.hierarchyByBranch.length > 0 ? (
            hierarchyData.hierarchyByBranch.map((branch: any) => {
              const isBranchExpanded = expandedBranches.has(branch.branchCode);
              return (
                <div key={branch.branchId} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleBranch(branch.branchCode)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                        >
                          {isBranchExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <Building2 className="w-6 h-6 text-blue-600" />
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">{branch.branchName}</h2>
                          <p className="text-sm text-slate-500">Code: {branch.branchCode} • {branch.totalEmployees} nhân viên</p>
                        </div>
                      </div>
                      {branch.branchManager && (
                        <div className="flex items-center gap-2 text-sm">
                          <Crown className="w-4 h-4 text-purple-600" />
                          <span className="text-purple-700 font-medium">{branch.branchManager.fullName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isBranchExpanded && (
                    <div className="p-6">
                      {branch.hierarchy && branch.hierarchy.length > 0 ? (
                        <div className="space-y-2">
                          {branch.hierarchy.map((node: any) => renderHierarchyNode(node))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <p>Chưa có dữ liệu nhân viên trong chi nhánh này</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12">
              <div className="text-center">
                <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Chưa có dữ liệu cấu trúc tổ chức</p>
                <p className="text-sm text-slate-400 mt-2">
                  Import dữ liệu từ Excel với các cột: <code className="bg-slate-100 px-1 rounded">employee_code</code>, <code className="bg-slate-100 px-1 rounded">direct_manager_code</code>, <code className="bg-slate-100 px-1 rounded">branch_code</code>, <code className="bg-slate-100 px-1 rounded">system_roles</code>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Branch Managers Tab */}
      {activeTab === 'managers' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {managersData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-slate-600">Tổng số chi nhánh</p>
                    <p className="text-2xl font-bold text-slate-900">{managersData.totalBranches}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md border border-green-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <UserCheck className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-slate-600">Có Giám đốc</p>
                    <p className="text-2xl font-bold text-green-700">{managersData.branchesWithManager}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md border border-amber-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="text-sm text-slate-600">Thiếu Giám đốc</p>
                    <p className="text-2xl font-bold text-amber-700">{managersData.branchesWithoutManager}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branch Managers List */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Danh sách Giám đốc chi nhánh</h2>
              <p className="text-xs text-slate-500 mt-1">
                💡 Xác định dựa trên <code className="bg-slate-200 px-1 rounded">branch_code</code> + <code className="bg-slate-200 px-1 rounded">system_roles = BRANCH_MANAGER</code>
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {managersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải...</p>
                  </div>
                </div>
              ) : managersData && managersData.branchesWithManagers.length > 0 ? (
                managersData.branchesWithManagers.map((branch) => (
                  <div key={branch.branchId} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="font-semibold text-slate-900">{branch.branchName}</h3>
                            <p className="text-sm text-slate-500">Code: {branch.branchCode}</p>
                          </div>
                        </div>
                        {branch.manager ? (
                          <div className="ml-8 mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Crown className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-semibold text-purple-900">Giám đốc / Quản lý chi nhánh</span>
                            </div>
                            <div className="text-sm text-slate-700">
                              <p className="font-medium">{branch.manager.fullName}</p>
                              <p className="text-slate-500">
                                {branch.manager.employeeCode} • {branch.manager.email}
                              </p>
                              {branch.manager.jobTitle && (
                                <p className="text-slate-500 mt-1">{branch.manager.jobTitle}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="ml-8 mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-sm text-amber-900">Chưa có Giám đốc chi nhánh</span>
                            </div>
                            <p className="text-xs text-amber-700 mt-1">
                              Cần user có role BRANCH_MANAGER trong chi nhánh này
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Chưa có dữ liệu chi nhánh</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManagement;
