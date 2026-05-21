import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertCircle, MapPin } from 'lucide-react';
import { requestorService } from '../../services/requestorService';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { RequestorPRProcurementModal } from '../../components/requestor/RequestorPRProcurementModal';
import {
  RequestorProcurementTrackingCard,
  type RequestorProcurementTrackingCardData,
} from '../../components/requestor/RequestorProcurementTrackingCard';

type FilterType = 'all' | 'on_time' | 'warning' | 'overdue' | 'completed';

/** Cuộn trong outlet (parent flush + overflow-hidden); không khóa chiều cao bằng min-h-full. */
const requestorPageShellClass =
  'flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#f1f5f9] touch-pan-y [scrollbar-width:thin]';
const requestorPageContentClass =
  'mx-auto w-full max-w-[1800px] shrink-0 flex flex-col gap-6 px-2 pt-2 pb-8 sm:px-3 sm:pt-3 sm:pb-10 md:px-6';
const requestorCardClass =
  'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-xl shadow-slate-300/65';

const PRTracking = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pr-tracking-list'],
    queryFn: () => requestorService.getPRTrackingList(),
    refetchInterval: 30000,
  });

  const filteredPRs =
    data?.prs.filter((pr) => {
      const matchesSearch =
        pr.prNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pr.itemName && pr.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter =
        filter === 'all' ||
        (filter === 'on_time' && pr.sla.status === 'on_time') ||
        (filter === 'warning' && pr.sla.status === 'warning') ||
        (filter === 'overdue' && pr.sla.status === 'overdue') ||
        (filter === 'completed' && pr.sla.status === 'completed');

      const matchesOverdueOnly = !showOverdueOnly || pr.sla.status === 'overdue';

      return matchesSearch && matchesFilter && matchesOverdueOnly;
    }) ?? [];

  if (isLoading) {
    return (
      <div className={requestorPageShellClass}>
        <div className={requestorPageContentClass}>
          <div className="animate-pulse space-y-4">
            <div className="h-28 rounded-2xl bg-slate-200/90" />
            <div className="h-20 rounded-2xl bg-slate-200/80" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 rounded-2xl bg-slate-200/80" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={requestorPageShellClass}>
        <div className={`${requestorPageContentClass} items-center justify-center`}>
          <div className="max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-lg">
            <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
            <p className="mt-2 text-sm text-rose-800/90">Vui lòng thử lại sau.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={requestorPageShellClass}>
      <div className={requestorPageContentClass}>
        <div className="flex-shrink-0">
          <RequestorPageHero
            kicker="Requestor · Theo dõi"
            title="Theo dõi PR"
            description="Theo dõi tiến độ mua hàng, SLA thời gian và chi phí — biết hàng của bạn đang ở đâu."
            Icon={MapPin}
            tint="cyan"
            regionLabel="Theo dõi PR"
          />
        </div>

        <article className={`flex-none p-4 sm:p-5 ${requestorCardClass}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-600/80"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo PR No hoặc tên hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'on_time', 'warning', 'overdue', 'completed'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    filter === f
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all'
                    ? 'Tất cả'
                    : f === 'on_time'
                      ? 'Đúng hạn'
                      : f === 'warning'
                        ? 'Sắp trễ'
                        : f === 'overdue'
                          ? 'Quá hạn'
                          : 'Hoàn thành'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                  showOverdueOnly
                    ? 'bg-rose-100 text-rose-800 ring-2 ring-rose-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <AlertCircle className="h-4 w-4" strokeWidth={2} />
                Chỉ PR trễ
              </button>
            </div>
          </div>
        </article>

        {filteredPRs.length === 0 ? (
          <div
            className={`${requestorCardClass} flex flex-col items-center justify-center px-6 py-16 text-center`}
          >
            <MapPin className="mb-3 h-10 w-10 text-slate-300" strokeWidth={1.5} />
            <p className="font-medium text-slate-600">Không tìm thấy PR nào phù hợp bộ lọc.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPRs.map((pr, index) => (
              <RequestorProcurementTrackingCard
                key={pr.id}
                pr={pr as RequestorProcurementTrackingCardData}
                animationDelayMs={Math.min(index * 40, 320)}
                onClick={() => setSelectedPRId(pr.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPRId ? (
        <RequestorPRProcurementModal prId={selectedPRId} onClose={() => setSelectedPRId(null)} />
      ) : null}

      <style>{`
        @keyframes liquid-flow {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow {
          animation: liquid-flow 2.3s linear infinite;
        }
        @keyframes liquid-flow-fast {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow-fast {
          animation: liquid-flow-fast 1.45s linear infinite;
        }
        @keyframes pickup-glow {
          0%, 100% {
            box-shadow: 0 14px 28px -18px rgba(15, 23, 42, 0.38), 0 0 0 0 rgba(52, 211, 153, 0.35);
          }
          50% {
            box-shadow: 0 18px 36px -14px rgba(16, 185, 129, 0.25), 0 0 0 4px rgba(52, 211, 153, 0.2);
          }
        }
        .animate-pickup-glow {
          animation: pickup-glow 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PRTracking;
