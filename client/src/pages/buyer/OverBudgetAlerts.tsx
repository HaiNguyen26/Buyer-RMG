import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react';
import { buyerService } from '../../services/buyerService';

const OverBudgetAlerts = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-over-budget-alerts'],
    queryFn: () => buyerService.getOverBudgetAlerts(),
    enabled: false, // Disable until API is ready
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Lỗi khi tải dữ liệu
        </div>
      </div>
    );
  }

  // Mock data structure
  const alerts = data?.alerts || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-100 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-red-600" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Over Budget Alerts</h1>
          <p className="text-sm text-slate-600">Danh sách PR: Giá mua &gt; Giá PR</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-amber-900 mb-1">Lưu ý quan trọng</p>
            <p className="text-sm text-amber-700">
              Buyer cần biết PR nào chưa được phép mua. Tránh mua khi chưa có xác nhận từ Giám đốc Chi nhánh.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">PR No</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Giá PR</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Giá mua dự kiến</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">% Vượt</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái GĐ CN</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium">Chưa có PR vượt ngân sách</p>
                    <p className="text-sm mt-1">Tất cả PR đều trong ngân sách cho phép</p>
                  </td>
                </tr>
              ) : (
                alerts.map((alert: any) => (
                  <tr key={alert.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{alert.prNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">
                        {alert.prAmount?.toLocaleString('vi-VN') || '0'} {alert.currency || 'VND'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-red-600">
                        {alert.purchasePrice?.toLocaleString('vi-VN') || '0'} {alert.currency || 'VND'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                        <TrendingUp className="w-4 h-4" />
                        +{alert.overPercent || 0}%
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {alert.branchManagerStatus === 'APPROVED' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Đã chấp nhận
                        </div>
                      ) : alert.branchManagerStatus === 'REJECTED' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          <XCircle className="w-4 h-4" />
                          Từ chối
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          Chờ xác nhận
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {alert.branchManagerStatus !== 'APPROVED' && (
                        <div className="text-xs text-slate-500">
                          ⚠️ Không được mua
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverBudgetAlerts;

