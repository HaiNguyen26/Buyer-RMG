import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { dashboardPageContentBottomClass } from '../../constants/dashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SalesPRView = () => {
  const [searchParams] = useSearchParams();
  const focus = (searchParams.get('focus') || '').trim();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-pr-view'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/requestor/prs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return { prs: [] };
      const j = await res.json();
      return { prs: j.prs ?? j.data ?? [] };
    },
  });

  const prs = (data?.prs ?? []) as any[];

  const prsFiltered = useMemo(() => {
    if (!focus) return prs;
    return prs.filter((pr) => pr.prNumber === focus || pr.id === focus);
  }, [prs, focus]);

  return (
    <div className={`w-full min-w-0 space-y-6 ${dashboardPageContentBottomClass}`}>
      <div className="page-banner page-banner-tint-warm animate-fade-in-right fade-in-right-delay-0">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="page-banner-icon-box bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-white/40">
            <ShoppingCart className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="page-banner-kicker text-amber-800/80">Procurement</p>
            <h1 className="page-banner-title">PR (chỉ xem)</h1>
            <p className="page-banner-desc">
              Xem tiến độ mua hàng — không chỉnh sửa; từ chi tiết SO có thể mở lọc theo mã PR.
            </p>
            {focus ? (
              <p className="mt-3 text-sm text-amber-900 bg-white/70 border border-amber-200/80 rounded-lg px-3 py-2">
                Đang lọc theo PR: <span className="font-mono font-semibold">{focus}</span>
                {prsFiltered.length === 0 && prs.length > 0 && (
                  <span className="block text-rose-700 mt-1 text-xs">
                    Không thấy PR này trong danh sách hiện tại (có thể do quyền hoặc API).
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-fade-in-right fade-in-right-stagger-1 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">PR Number</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : prsFiltered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Chưa có PR nào</td></tr>
              ) : (
                prsFiltered.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{pr.prNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{pr.department ?? '-'}</td>
                    <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{pr.status}</span></td>
                    <td className="px-4 py-3 text-slate-500">{pr.createdAt ? new Date(pr.createdAt).toLocaleDateString('vi-VN') : '-'}</td>
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

export default SalesPRView;
