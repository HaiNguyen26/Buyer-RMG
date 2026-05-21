import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, Filter } from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { buyerOutletPageShellClass } from '../../constants/buyerLayout';

const formatCurrency = (amount: number, suffix: string = '') => {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + (suffix ? ' ' + suffix : '')
  );
};

type FilterType = 'all' | 'light' | 'serious';

const OverBudgetAlerts = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-over-budget-alerts'],
    queryFn: () => buyerService.getOverBudgetAlerts(),
  });

  const alerts = data?.alerts || [];
  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  const seriousAlerts = useMemo(
    () => alerts.filter((a) => a.severity === 'serious'),
    [alerts]
  );
  const maxOverPercent = useMemo(() => {
    if (seriousAlerts.length === 0) return 0;
    return Math.max(...seriousAlerts.map((a) => a.overPercent));
  }, [seriousAlerts]);

  return (
    <div className={`${buyerOutletPageShellClass} space-y-4 sm:space-y-5 md:space-y-6 bg-gradient-to-b from-rose-50/25 to-[#f1f5f9] py-3 sm:py-4 md:py-5 animate-fade-in-right fade-in-right-delay-0`}>
      {/* Header — module nhắc việc */}
      <div className="flex flex-col gap-3 rounded-2xl border border-rose-100/80 bg-gradient-to-r from-rose-50 to-amber-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="relative shrink-0">
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 shadow-inner">
            <AlertTriangle
              className="w-6 h-6 text-rose-600"
              strokeWidth={2}
              style={{
                animation: 'over-budget-pulse 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Cảnh báo vượt ngân sách</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Theo dõi item vượt baseline để thương lượng hoặc báo Buyer Leader</p>
        </div>
      </div>

      {/* Bộ lọc nhanh biến động giá */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Filter className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Bộ lọc nhanh biến động giá
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  value: 'all' as FilterType,
                  label: 'Tất cả',
                  activeClass: 'bg-blue-700 text-white',
                  bulletClass: 'bg-white',
                },
                {
                  value: 'light' as FilterType,
                  label: 'Vượt nhẹ',
                  activeClass: 'bg-amber-100 text-amber-800',
                  bulletClass: 'bg-amber-500',
                },
                {
                  value: 'serious' as FilterType,
                  label: 'Vượt nghiêm trọng',
                  activeClass: 'bg-rose-100 text-rose-700',
                  bulletClass: 'bg-rose-500',
                },
              ] as const
            ).map(({ value, label, activeClass, bulletClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === value ? activeClass : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${filter === value ? bulletClass : 'bg-slate-300'}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cảnh báo hệ thống — hiện khi có vượt nghiêm trọng */}
        {seriousAlerts.length > 0 && (
          <div className="relative w-full min-w-0 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 sm:min-w-[280px] sm:max-w-md sm:shrink-0">
            <AlertTriangle
              className="absolute right-4 top-1/2 -translate-y-1/2 w-24 h-24 text-rose-200/60 pointer-events-none"
              strokeWidth={1}
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-0.5">
                  Cảnh báo hệ thống
                </p>
                <p className="text-sm font-semibold text-red-700">
                  Phát hiện báo giá vượt ngưỡng nghiêm trọng (+{maxOverPercent >= 100 ? '100' : Math.round(maxOverPercent)}%)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-rose-800">
          Lỗi khi tải danh sách cảnh báo. Vui lòng thử lại.
        </div>
      )}

      {/* Danh sách cảnh báo — card đỏ nhạt */}
      {!isLoading && !error && (
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/30 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 bg-rose-100/50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    PR
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    RFQ
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    Item
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    NCC
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    Baseline
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    Giá RFQ
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    Mức vượt
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wide text-xs w-28">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="font-medium">
                        {alerts.length === 0
                          ? 'Chưa có cảnh báo vượt ngân sách'
                          : 'Không có bản ghi nào theo bộ lọc'}
                      </p>
                      <p className="text-sm mt-1 max-w-md mx-auto">
                        {alerts.length === 0
                          ? 'Tất cả item đều trong baseline hoặc chưa có báo giá. Cảnh báo sẽ hiện khi có đơn giá NCC cao hơn giá baseline (PR) tại từng dòng item.'
                          : 'Thử chọn "Tất cả" để xem toàn bộ.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-rose-100/80 last:border-b-0 bg-white/60 hover:bg-rose-50/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900">{alert.prNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">{alert.rfqNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">{alert.itemDesc}</td>
                      <td className="px-4 py-2.5 text-slate-700">{alert.supplierName}</td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {formatCurrency(alert.baselineUnitPrice)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {formatCurrency(alert.rfqUnitPrice)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-rose-600">
                        +{formatCurrency(alert.overAmount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            alert.severity === 'serious'
                              ? 'bg-rose-200/90 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {alert.severity === 'serious' ? 'Vượt nghiêm trọng' : 'Vượt nhẹ'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/buyer/rfq/${alert.rfqId}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem chi tiết RFQ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes over-budget-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default OverBudgetAlerts;
