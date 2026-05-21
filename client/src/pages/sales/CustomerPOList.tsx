import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { salesService } from '../../services/salesService';
import { Plus, FileText, Search, Eye } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { SalesPODetailModal } from '../../components/SalesPODetailModal';
import { dashboardPageContentBottomClass } from '../../constants/dashboardLayout';

/** UI filter → API SalesPOStatus */
function mapUiStatusToApi(ui: string): 'ACTIVE' | 'CLOSED' | 'DRAFT' | '' {
  if (ui === 'RUNNING') return 'ACTIVE';
  if (ui === 'DONE') return 'CLOSED';
  if (ui === 'DRAFT') return 'DRAFT';
  return '';
}

function statusBadge(status: string) {
  if (status === 'ACTIVE')
    return { label: 'In Progress', className: 'bg-emerald-100 text-emerald-800' };
  if (status === 'CLOSED')
    return { label: 'Completed', className: 'bg-slate-100 text-slate-700' };
  return { label: 'Draft', className: 'bg-amber-100 text-amber-800' };
}

const CustomerPOList = () => {
  const navigate = useNavigate();
  const [uiStatus, setUiStatus] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailSoId, setDetailSoId] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/customers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const j = await res.json();
      return j?.customers ?? [];
    },
  });
  const customers = (customersData ?? []) as { id: string; name: string }[];

  const apiStatus = useMemo(() => mapUiStatusToApi(uiStatus), [uiStatus]);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-sales-pos', apiStatus, customerId, search, dateFrom, dateTo],
    queryFn: () =>
      salesService.getSalesPOs({
        ...(apiStatus ? { status: apiStatus } : {}),
        ...(customerId ? { customerId } : {}),
        ...(search ? { search } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      }),
  });

  const salesPOs = data?.salesPOs ?? [];

  return (
    <div className={`w-full min-w-0 space-y-6 ${dashboardPageContentBottomClass}`}>
      <div className="page-banner page-banner-tint-warm animate-fade-in-right fade-in-right-delay-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="page-banner-icon-box bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-white/40">
              <FileText className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="page-banner-kicker text-amber-800/80">SO Management</p>
              <h1 className="page-banner-title">Sales Orders</h1>
              <p className="page-banner-desc">
                SO (dự án) — theo dõi PR, tiến độ mua và chi phí
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/sales/orders/create')}
            className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 shadow-sm transition-colors sm:self-center"
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
            Create SO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-right fade-in-right-stagger-1">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="SO code / khách hàng / dự án..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <CustomSelect
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="min-w-[160px] px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="">Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            value={uiStatus}
            onChange={(e) => setUiStatus(e.target.value)}
            className="min-w-[140px] px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="">Status</option>
            <option value="DRAFT">Draft</option>
            <option value="RUNNING">Running</option>
            <option value="DONE">Done</option>
          </CustomSelect>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">SO Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Project</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Customer</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Total PR</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Total cost</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Progress</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 w-32">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : salesPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Chưa có Sales Order nào. Tạo SO trước khi gắn PR cho dự án.
                  </td>
                </tr>
              ) : (
                salesPOs.map((po) => {
                  const badge = statusBadge(po.status);
                  const prCount = po.prCount ?? 0;
                  const pct = po.itemProgressPercent ?? 0;
                  const cost = po.actualCost ?? 0;
                  return (
                    <tr key={po.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{po.salesPONumber}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={po.projectName ?? ''}>
                        {po.projectName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{po.customer?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{prCount}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {cost.toLocaleString('vi-VN')} {po.currency}
                      </td>
                      <td className="px-4 py-3 w-44">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                            <div
                              className={`relative h-full rounded-full transition-all duration-700 ease-out ${
                                pct >= 70
                                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-600'
                                  : pct >= 30
                                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500'
                                    : 'bg-slate-300'
                              }`}
                              style={{ width: `${pct}%` }}
                            >
                              {/* Liquid Flow Animation */}
                              {pct >= 30 && (
                                <div
                                  className="absolute inset-0 animate-liquid-flow"
                                  style={{
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                    backgroundSize: '200% 100%',
                                  }}
                                />
                              )}
                              
                              {/* Micro Bubbles */}
                              {pct > 30 && (
                                <>
                                  <div 
                                    className="absolute left-[20%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/40" 
                                    style={{ animationDuration: '2.2s' }} 
                                  />
                                  <div 
                                    className="absolute left-[50%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/30" 
                                    style={{ animationDuration: '2.8s' }} 
                                  />
                                  <div 
                                    className="absolute left-[80%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/35" 
                                    style={{ animationDuration: '3.1s' }} 
                                  />
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-slate-600 w-9">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailSoId(po.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SalesPODetailModal
        open={!!detailSoId}
        salesPOId={detailSoId}
        onClose={() => setDetailSoId(null)}
        onOpenWorkspace={(id) => {
          setDetailSoId(null);
          navigate(`/dashboard/sales/orders/${id}`);
        }}
      />
      
      <style>{`
        @keyframes liquid-flow {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow {
          animation: liquid-flow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default CustomerPOList;
