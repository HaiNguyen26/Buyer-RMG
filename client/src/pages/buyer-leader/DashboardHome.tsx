import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { buyerLeaderDashboardOverviewPageShellClass } from '../../constants/buyerLeaderLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import { BuyerLeaderCommandCenter } from '../../components/buyer-leader/command-center/BuyerLeaderCommandCenter';

const DashboardHome = () => {
  const { data: pendingAssignments, isLoading: loadingPending, error: errPending } = useQuery({
    queryKey: ['buyer-leader-pending-assignments'],
    queryFn: () => buyerLeaderService.getPendingAssignments(),
  });

  const { data: rfqMonitoring, isLoading: loadingRfqMon, error: errRfq } = useQuery({
    queryKey: ['buyer-leader-rfq-monitoring', 'all', 'dash'],
    queryFn: () => buyerLeaderService.getRFQMonitoring('all'),
    staleTime: 30_000,
  });

  const { data: rfqsForComparison, isLoading: loadingCompare, error: errCompare } = useQuery({
    queryKey: ['buyer-leader-rfqs-for-comparison', 'dash'],
    queryFn: () => buyerLeaderService.getRFQsForComparison(),
    staleTime: 30_000,
  });

  const { data: overBudgetData, isLoading: loadingOverBudget, error: errOver } = useQuery({
    queryKey: ['buyer-leader-over-budget-prs', 'pending', 'dash'],
    queryFn: () => buyerLeaderService.getOverBudgetPRs('pending'),
    staleTime: 30_000,
  });

  const dashLoading = loadingPending || loadingRfqMon || loadingCompare || loadingOverBudget;
  const dashError = errPending || errRfq || errCompare || errOver;

  const pendingPRs = pendingAssignments?.prs ?? [];
  const rfqList = rfqMonitoring?.rfqs ?? [];
  const activeRfqStatuses = new Set(['DRAFT', 'SENT', 'QUOTATION_RECEIVED']);
  const activeRfqs = rfqList.filter(
    (r: { status?: string }) => r.status && activeRfqStatuses.has(r.status)
  );
  const comparisonRfqs = rfqsForComparison?.rfqs ?? [];
  const overBudgetPRs = overBudgetData?.prs ?? [];

  const rfqProgress = useMemo(() => {
    if (activeRfqs.length === 0) return 0;
    return Math.min(
      100,
      Math.round(
        activeRfqs.reduce((sum: number, r: { quotationsCount?: number; itemCount?: number }) => {
          const need = Math.max(1, Number(r.itemCount ?? 1));
          const have = Number(r.quotationsCount ?? 0);
          return sum + Math.min(100, (have / need) * 100);
        }, 0) / activeRfqs.length
      )
    );
  }, [activeRfqs]);

  if (dashLoading) {
    return (
      <div className={buyerLeaderDashboardOverviewPageShellClass}>
        <div className="space-y-4 px-1 pt-3 sm:px-1.5 md:px-3">
          <DashboardV3ShimmerBlock className="h-32 w-full shrink-0 rounded-[28px]" />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <DashboardV3ShimmerBlock className="min-h-[280px] rounded-[28px]" />
              <DashboardV3ShimmerBlock className="min-h-[160px] rounded-[28px]" />
            </div>
            <DashboardV3ShimmerBlock className="min-h-[240px] rounded-[28px] lg:col-span-4" />
          </div>
        </div>
      </div>
    );
  }

  if (dashError) {
    return (
      <div className={buyerLeaderDashboardOverviewPageShellClass}>
        <div className="px-1 pt-3 sm:px-1.5 md:px-3">
          <div className={`${dashboardV3ErrorCardClass} max-w-xl`}>
            <p className="font-medium text-red-800">Lỗi khi tải dữ liệu</p>
            <p className="mt-1 text-sm text-red-600">Vui lòng thử lại sau.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${buyerLeaderDashboardOverviewPageShellClass} animate-fade-in`}>
      <BuyerLeaderCommandCenter
        pendingPRs={pendingPRs}
        activeRfqs={activeRfqs}
        comparisonRfqs={comparisonRfqs}
        overBudgetPRs={overBudgetPRs}
        rfqProgress={rfqProgress}
        rfqCount={activeRfqs.length}
        comparisonPending={comparisonRfqs.length}
      />
    </div>
  );
};

export default DashboardHome;
