import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  Package,
  AlertTriangle,
  Ban,
  ArrowRight,
  Table2,
  Upload,
  Activity,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { warehouseService } from '../../services/warehouseService';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import {
  requestorPageStackClass,
  requestorPanelCardClass,
  requestorDataTableCardClass,
  requestorDataTableCardHeaderClass,
} from '../../constants/requestorLayout';
import {
  dashboardPageContentInsetBottomOverviewClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import { saasTableCodeCellClass, saasTableHeadCellClass, saasTableRootClass } from '../../constants/saasDataTable';

function formatNum(n: number) {
  return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '0';
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function WarehouseDashboardHome() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['warehouse-dashboard'],
    queryFn: warehouseService.getDashboard,
    refetchOnWindowFocus: true,
  });

  const stats = data?.stats;
  const lowStock = data?.lowStock ?? [];
  const activity = data?.recentActivity ?? [];

  return (
    <div
      className={`mx-auto min-w-0 w-full max-w-none ${requestorPageStackClass} ${dashboardPageContentInsetXClass} ${dashboardPageContentInsetBottomOverviewClass} pt-2 sm:pt-2.5 animate-fade-in`}
    >
      <RequestorPageHero
        kicker="Warehouse · Tồn kho"
        title="Trang chủ kho"
        description="Tổng quan tồn kho: chỉ số, cảnh báo sắp hết, hoạt động gần đây và thao tác nhanh."
        Icon={Package}
        tint="ocean"
        regionLabel="Trang chủ kho"
        rightSlot={
          <div className="flex max-w-xl items-start gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-xs text-white/90 backdrop-blur-sm">
            <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2} />
            <span>
              Tồn thấp: số lượng &gt; 0 và ≤ ngưỡng Min (đã cấu hình trên từng dòng tồn).
            </span>
          </div>
        }
      />

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Chỉ số nhanh</h2>
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}
        {!isLoading && isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Không tải được dữ liệu. Kiểm tra kết nối máy chủ và đăng nhập.
          </div>
        )}
        {!isLoading && !isError && stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Tổng số dòng tồn</span>
                <Package className="h-5 w-5 text-teal-600" />
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{formatNum(stats.totalItems)}</p>
              <p className="mt-1 text-xs text-slate-500">Theo cặp mã vật tư + kho</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-teal-50/40 p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Tổng số lượng</span>
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{formatNum(stats.totalQuantity)}</p>
              <p className="mt-1 text-xs text-slate-500">Tổng SL khả dụng toàn kho</p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-amber-900/90">Dòng sắp hết</span>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-3xl font-bold tabular-nums text-amber-900">{formatNum(stats.lowStockItems)}</p>
              <p className="mt-1 text-xs text-amber-800/70">Cần nhập hoặc kiểm tra</p>
            </div>
            <div className="rounded-xl border border-red-200/80 bg-gradient-to-br from-red-50/70 to-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-red-900/90">Dòng hết hàng</span>
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-3xl font-bold tabular-nums text-red-900">{formatNum(stats.outOfStock)}</p>
              <p className="mt-1 text-xs text-red-800/70">Số lượng khả dụng ≤ 0</p>
            </div>
          </div>
        )}
      </section>

      <section className={requestorDataTableCardClass}>
        <div className={`${requestorDataTableCardHeaderClass} flex items-center justify-between`}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cảnh báo tồn thấp</h2>
            <p className="mt-0.5 text-sm text-slate-600">Các dòng tại hoặc dưới ngưỡng Min</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/warehouse/inventory')}
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Mở lưới tồn kho
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          {lowStock.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Chưa có cảnh báo. Hãy nhập cột <strong>Min</strong> trên lưới tồn kho để theo dõi ngưỡng.
            </div>
          ) : (
            <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-full text-sm`}>
              <thead className="bg-slate-50/95">
                <tr>
                  <th className={`${saasTableHeadCellClass} border-b border-slate-200 px-6 py-3`}>Mã vật tư</th>
                  <th className={`${saasTableHeadCellClass} border-b border-slate-200 px-6 py-3`}>Tên</th>
                  <th className={`${saasTableHeadCellClass} border-b border-slate-200 px-6 py-3`}>Mã kho</th>
                  <th className={`${saasTableHeadCellClass} border-b border-slate-200 px-6 py-3 text-right`}>Tồn</th>
                  <th className={`${saasTableHeadCellClass} border-b border-slate-200 px-6 py-3 text-right`}>Min</th>
                </tr>
              </thead>
              <tbody className={departmentHeadTableTbodyElevatedClass}>
                {lowStock.map((row, index) => (
                  <tr key={`${row.partCode}-${row.warehouse}`} className={departmentHeadTableDataRowClasses(index, { h72: true })}>
                    <td className={`relative px-6 py-3 ${saasTableCodeCellClass}`}>
                      <div aria-hidden className={departmentHeadTableAccentRailClass} />
                      <div className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}>
                        {row.partCode}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className={departmentHeadTableCellContentWrapClass}>{row.name}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className={departmentHeadTableCellContentWrapClass}>{row.warehouse}</div>
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums text-amber-800">
                      <div className={departmentHeadTableCellContentWrapClass}>{formatNum(row.qty)}</div>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-600">
                      <div className={departmentHeadTableCellContentWrapClass}>{formatNum(row.min)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <section className={`${requestorDataTableCardClass} lg:col-span-2`}>
          <div className={`${requestorDataTableCardHeaderClass} flex items-center gap-2`}>
            <Activity className="h-5 w-5 shrink-0 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Hoạt động gần đây</h2>
              <p className="text-sm text-slate-600">Thay đổi tồn — phục vụ theo dõi và đối soát</p>
            </div>
          </div>
          <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Chưa có lịch sử. Lưu trên lưới hoặc nhập từ Excel để ghi nhận.
              </div>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-3 hover:bg-slate-50/60"
                >
                  <span className="whitespace-nowrap text-xs text-slate-400">{formatTime(item.at)}</span>
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      item.delta > 0 ? 'text-emerald-800' : item.delta < 0 ? 'text-red-800' : 'text-slate-800'
                    }`}
                  >
                    {item.text}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{item.warehouse}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={requestorPanelCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Thao tác nhanh</h2>
          <p className="mb-5 text-sm text-slate-600">Đường tắt thường dùng</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/warehouse/incoming')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              <Truck className="h-5 w-5" />
              PO chờ nhận (GRN)
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/warehouse/inventory')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition-colors hover:bg-slate-50"
            >
              <Table2 className="h-5 w-5 text-slate-600" />
              Nhập tồn kho
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/warehouse/inventory')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition-colors hover:bg-slate-50"
            >
              <Upload className="h-5 w-5 text-slate-600" />
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/warehouse/inventory')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition-colors hover:bg-slate-50"
            >
              <Package className="h-5 w-5 text-slate-600" />
              Xem tồn kho
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
