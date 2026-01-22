import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { bgdService } from '../../services/bgdService';

const ExceptionApproval = () => {
  const queryClient = useQueryClient();
  const [selectedException, setSelectedException] = useState<any>(null);

  const { data: exceptionsData, isLoading } = useQuery({
    queryKey: ['bgd-exception-approval'],
    queryFn: bgdService.getExceptionApprovals,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => bgdService.approveException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bgd-exception-approval'] });
      setSelectedException(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bgdService.rejectException(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bgd-exception-approval'] });
      setSelectedException(null);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded-soft"></div>
        </div>
      </div>
    );
  }

  const pendingExceptions = exceptionsData?.pending || [];
  const approvedExceptions = exceptionsData?.approved || [];
  const rejectedExceptions = exceptionsData?.rejected || [];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Exception Approval</h1>
        <p className="text-slate-600">Xử lý trường hợp đặc biệt</p>
      </div>

      {/* Note */}
      <div className="glass rounded-soft p-6 border-l-4 border-purple-500">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-800 mb-1">Lưu ý quan trọng</div>
            <div className="text-sm text-slate-600">
              BGĐ chỉ duyệt NGOẠI LỆ, không duyệt thường xuyên. Các trường hợp:
              giá trị mua vượt ngưỡng cho phép, NCC chiến lược mới, điều kiện mua rủi ro cao.
            </div>
          </div>
        </div>
      </div>

      {/* Pending Exceptions */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Chờ duyệt</h3>
              <p className="text-sm text-slate-600">{pendingExceptions.length} trường hợp</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {pendingExceptions.length > 0 ? (
            pendingExceptions.map((exception: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        {exception.type}
                      </span>
                      <span className="text-sm text-slate-600">#{exception.code}</span>
                    </div>
                    <div className="font-semibold text-slate-800 mb-1">{exception.title}</div>
                    <div className="text-sm text-slate-600 mb-2">{exception.description}</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Giá trị: {exception.value.toLocaleString()} VNĐ</span>
                      <span>Dự án: {exception.projectName}</span>
                      <span>Ngày tạo: {exception.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setSelectedException(exception)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(exception.id)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Lý do từ chối:');
                        if (reason) {
                          rejectMutation.mutate({ id: exception.id, reason });
                        }
                      }}
                      disabled={rejectMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">Không có trường hợp chờ duyệt</div>
          )}
        </div>
      </div>

      {/* Approved & Rejected History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approved */}
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-slate-800">Đã duyệt</h3>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              {approvedExceptions.length}
            </span>
          </div>
          <div className="space-y-3">
            {approvedExceptions.length > 0 ? (
              approvedExceptions.map((exception: any, idx: number) => (
                <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium text-slate-800 mb-1">{exception.title}</div>
                  <div className="text-sm text-slate-600 mb-1">{exception.description}</div>
                  <div className="text-xs text-slate-500">
                    Duyệt bởi: {exception.approvedBy} - {exception.approvedAt}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-8">Chưa có trường hợp đã duyệt</div>
            )}
          </div>
        </div>

        {/* Rejected */}
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-slate-800">Đã từ chối</h3>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              {rejectedExceptions.length}
            </span>
          </div>
          <div className="space-y-3">
            {rejectedExceptions.length > 0 ? (
              rejectedExceptions.map((exception: any, idx: number) => (
                <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-medium text-slate-800 mb-1">{exception.title}</div>
                  <div className="text-sm text-slate-600 mb-1">{exception.description}</div>
                  <div className="text-xs text-red-600 mb-1">
                    Lý do: {exception.rejectionReason}
                  </div>
                  <div className="text-xs text-slate-500">
                    Từ chối bởi: {exception.rejectedBy} - {exception.rejectedAt}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-8">Chưa có trường hợp bị từ chối</div>
            )}
          </div>
        </div>
      </div>

      {/* Exception Detail Modal */}
      {selectedException && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-dark rounded-soft-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Chi tiết ngoại lệ</h3>
              <button
                onClick={() => setSelectedException(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-white">
              <div>
                <div className="text-sm text-slate-400 mb-1">Loại ngoại lệ</div>
                <div className="font-medium">{selectedException.type}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">Tiêu đề</div>
                <div className="font-medium">{selectedException.title}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">Mô tả</div>
                <div>{selectedException.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Giá trị</div>
                  <div className="font-medium">{selectedException.value.toLocaleString()} VNĐ</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Dự án</div>
                  <div className="font-medium">{selectedException.projectName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <button
                  onClick={() => {
                    approveMutation.mutate(selectedException.id);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Duyệt
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Lý do từ chối:');
                    if (reason) {
                      rejectMutation.mutate({ id: selectedException.id, reason });
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExceptionApproval;


