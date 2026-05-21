import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buyerService } from '../../services/buyerService';
import { buyerDashboardOverviewPageShellClass } from '../../constants/buyerLayout';
import {
  dashboardV3ErrorCardClass,
  DashboardV3ShimmerBlock,
} from '../../components/dashboard/DashboardV3Chrome';
import { BuyerCommandCenter } from '../../components/buyer/command-center/BuyerCommandCenter';
import {
  buildUpcomingDeadlines,
  filterNeedInfo,
  filterRfqInProgress,
} from '../../components/buyer/command-center/buyerWorkQueueUtils';

const DashboardHome = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['buyer-dashboard'],
    queryFn: () => buyerService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: assignedPRs } = useQuery({
    queryKey: ['buyer-assigned-prs'],
    queryFn: () => buyerService.getAssignedPRs(),
    staleTime: 30000,
  });

  const { data: poDashboard } = useQuery({
    queryKey: ['buyer-po-dashboard'],
    queryFn: () => buyerService.getPODashboard(),
    staleTime: 30000,
  });

  const myAssignedPRs = assignedPRs?.prs ?? [];
  const rfqInProgressPRs = useMemo(() => filterRfqInProgress(myAssignedPRs), [myAssignedPRs]);
  const returnedPRs = useMemo(() => filterNeedInfo(myAssignedPRs), [myAssignedPRs]);
  const upcomingDeadlines = useMemo(() => buildUpcomingDeadlines(myAssignedPRs), [myAssignedPRs]);

  if (isLoading) {
    return (
      <div className={buyerDashboardOverviewPageShellClass}>
        <div className="space-y-4 px-1 pt-3 sm:px-1.5 md:px-3">
          <DashboardV3ShimmerBlock className="h-32 w-full shrink-0 rounded-[28px]" />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <DashboardV3ShimmerBlock className="min-h-[200px] rounded-[28px]" />
              <DashboardV3ShimmerBlock className="min-h-[140px] rounded-[28px]" />
              <div className="grid gap-4 md:grid-cols-2">
                <DashboardV3ShimmerBlock className="min-h-[180px] rounded-[28px]" />
                <DashboardV3ShimmerBlock className="min-h-[180px] rounded-[28px]" />
              </div>
            </div>
            <div className="space-y-4 lg:col-span-4">
              <DashboardV3ShimmerBlock className="min-h-[120px] rounded-[28px]" />
              <DashboardV3ShimmerBlock className="min-h-[100px] rounded-[28px]" />
              <DashboardV3ShimmerBlock className="min-h-[100px] rounded-[28px]" />
              <DashboardV3ShimmerBlock className="min-h-[140px] rounded-[28px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={buyerDashboardOverviewPageShellClass}>
        <div className="px-1 pt-3 sm:px-1.5 md:px-3">
          <div className={`${dashboardV3ErrorCardClass} max-w-xl`}>
            <p className="font-medium text-red-800">Lỗi khi tải dữ liệu</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dashboardSnap = {
    assignedPRs: dashboardData?.assignedPRs ?? 0,
    rfqInProgress: dashboardData?.rfqInProgress ?? 0,
    prsNeedMoreInfo: dashboardData?.prsNeedMoreInfo ?? 0,
    quotationsCompleted: dashboardData?.quotationsCompleted ?? 0,
  };

  const poStats = poDashboard
    ? {
        prWaitingPO: poDashboard.prWaitingPO ?? 0,
        poDraft: poDashboard.poDraft ?? 0,
        poWaitingApproval: poDashboard.poWaitingApproval ?? 0,
        poIssued: poDashboard.poIssued ?? 0,
      }
    : { prWaitingPO: 0, poDraft: 0, poWaitingApproval: 0, poIssued: 0 };

  return (
    <div className={`${buyerDashboardOverviewPageShellClass} animate-fade-in`}>
      <BuyerCommandCenter
        assignedPRs={myAssignedPRs}
        rfqInProgressPRs={rfqInProgressPRs}
        returnedPRs={returnedPRs}
        upcomingDeadlines={upcomingDeadlines}
        poStats={poStats}
        dashboardSnap={dashboardSnap}
      />
    </div>
  );
};

export default DashboardHome;
