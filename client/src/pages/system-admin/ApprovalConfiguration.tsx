import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { systemAdminService } from '../../services/systemAdminService';
import type { BranchApprovalRule } from '../../services/systemAdminService';

const ApprovalConfiguration = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['system-admin-branch-approval-rules'],
    queryFn: () => systemAdminService.getBranchApprovalRules(),
  });

  const rules = data?.rules || [];

  const updateMutation = useMutation({
    mutationFn: (payload: { branchCode: string; needBranchManagerApproval: boolean }) =>
      systemAdminService.updateBranchApprovalRule(payload.branchCode, {
        needBranchManagerApproval: payload.needBranchManagerApproval,
        note: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-admin-branch-approval-rules'] });
    },
  });

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
      </div>
    );
  }

  const Row = ({ row }: { row: BranchApprovalRule }) => {
    const isOn = !!row.needBranchManagerApproval;
    return (
      <div className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
        <div className="col-span-2 flex items-center">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            {row.branchCode}
          </span>
        </div>
        <div className="col-span-4 flex items-center text-sm text-slate-700">
          {row.branchName}
        </div>
        <div className="col-span-4 flex items-center gap-2">
          <button
            onClick={() => updateMutation.mutate({ branchCode: row.branchCode, needBranchManagerApproval: !isOn })}
            disabled={updateMutation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isOn ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
            aria-label="Need Branch Manager Approval"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isOn ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${isOn ? 'text-indigo-700' : 'text-slate-600'}`}>
            {isOn ? 'YES (có duyệt cấp 2)' : 'NO (bỏ qua cấp 2)'}
          </span>
        </div>
        <div className="col-span-2 flex items-center text-sm text-slate-600">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('vi-VN') : '—'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Cấu hình duyệt cấp 2 theo Chi nhánh</h3>
              <p className="text-xs text-slate-600 mt-1">
                Mỗi chi nhánh chỉ cần tick YES/NO cho “Need Branch Manager Approval”.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-700">
              <div className="col-span-2">Branch Code</div>
              <div className="col-span-4">Tên chi nhánh</div>
              <div className="col-span-4">Need Branch Manager Approval</div>
              <div className="col-span-2">Cập nhật</div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {rules.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">Chưa có chi nhánh</p>
              </div>
            ) : (
              rules.map((row) => <Row key={row.branchId} row={row} />)
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Luồng duyệt (chuẩn)</p>
            <p className="text-xs text-blue-700 mt-1">
              - <strong>Cấp 1:</strong> luôn là quản lý trực tiếp (direct_manager_code).<br />
              - <strong>Cấp 2:</strong> hệ thống kiểm tra theo branch_code.<br />
              - Nếu <strong>YES</strong> → PR lên BRANCH_MANAGER. Nếu <strong>NO</strong> → PR đi thẳng Buyer Leader/Buyer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalConfiguration;

