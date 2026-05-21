import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  CheckCircle,
  XCircle,
  MessageSquare,
  Building2,
  Calendar,
  Info,
  FileText,
  Package,
  User,
  Clock,
} from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BranchManagerPageHero } from '../../components/BranchManagerPageHero';
import {
  branchManagerPageRootClass,
  branchManagerPageContentClass,
  branchManagerDataTableCardClass,
  branchManagerDataTableCardHeaderClass,
} from '../../constants/branchManagerLayout';
import { dataTableOuterScrollXClass, dataTableWideMinWidthClass } from '../../constants/dataTableLayout';
import { dashboardV3IslandClass } from '../../components/dashboard/DashboardV3Chrome';

const PRHistory = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: historyData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-pr-history', statusFilter, departmentFilter, dateRange],
    queryFn: () =>
      branchManagerService.getPRHistory({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
        days: Number(dateRange),
      }),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'BUYER_LEADER_PENDING':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'REJECTED':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'RETURNED':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" strokeWidth={2} />;
      case 'BUYER_LEADER_PENDING':
        return <Clock className="h-4 w-4" strokeWidth={2} />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" strokeWidth={2} />;
      case 'RETURNED':
        return <MessageSquare className="h-4 w-4" strokeWidth={2} />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Đã duyệt';
      case 'BUYER_LEADER_PENDING':
        return 'Đã duyệt - chờ Buyer Leader';
      case 'REJECTED':
        return 'Bị từ chối';
      case 'RETURNED':
        return 'Bị trả';
      default:
        return 'Khác';
    }
  };

  if (isLoading) {
    return (
      <div className={branchManagerPageRootClass}>
        <div className={`${branchManagerPageContentClass} space-y-4`}>
          <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-2xl bg-slate-200/80" />
            <div className="h-24 rounded-2xl bg-slate-200/80" />
            <div className="h-72 rounded-2xl bg-slate-200/80" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${branchManagerPageRootClass} flex min-h-[40vh] flex-col justify-center p-6`}>
        <div className="max-w-lg rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Lỗi khi tải dữ liệu</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
        </div>
      </div>
    );
  }

  const prs = (historyData?.prs || []).filter(
    (pr: { prNumber?: string; itemName?: string }) =>
      pr.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.itemName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className={branchManagerPageRootClass}>
      <div className={`${branchManagerPageContentClass} space-y-6`}>
        <div className="shrink-0">
          <BranchManagerPageHero
            kicker="Giám đốc chi nhánh · Lịch sử"
            title="Lịch sử PR chi nhánh"
            description="Chỉ xem — theo dõi PR đã duyệt, bị trả và bị từ chối theo phòng ban hoặc Requestor."
            Icon={History}
            tint="violet"
            regionLabel="Lịch sử PR"
          />
        </div>

        <article className={`${dashboardV3IslandClass} !border-indigo-200/50 !bg-indigo-50/40 !p-3 sm:!p-4`}>
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" strokeWidth={2} />
            <p className="min-w-0 text-sm text-indigo-900/90">
              Dữ liệu phản ánh các PR đã qua xử lý tại chi nhánh. Dùng bộ lọc và ô tìm để thu hẹp danh sách.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_-16px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 sm:px-5 sm:py-5">
          <div className="space-y-4">
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
              />
              <input
                type="search"
                placeholder="Tìm theo mã PR hoặc tên hàng hóa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Trạng thái</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Tất cả</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Bị từ chối</option>
                  <option value="RETURNED">Bị trả</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Phòng ban</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Tất cả</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Thời gian</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:max-w-none"
                >
                  <option value="7">7 ngày qua</option>
                  <option value="30">30 ngày qua</option>
                  <option value="90">90 ngày qua</option>
                  <option value="365">1 năm qua</option>
                </select>
              </div>
            </div>
          </div>
        </article>

        <article className={`${branchManagerDataTableCardClass} overflow-hidden`}>
          <div className={branchManagerDataTableCardHeaderClass}>
            <h2 className="text-lg font-bold text-slate-900">Lịch sử PR ({prs.length})</h2>
            <p className="mt-0.5 text-sm text-slate-600">Cuộn trang để xem toàn bộ — cuộn ngang nếu bảng rộng.</p>
          </div>
          <div className={`${dataTableOuterScrollXClass} bg-white`}>
            <table className={`${dataTableWideMinWidthClass} text-left text-sm`}>
              <thead className="border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2} />
                      Mã PR
                    </span>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-violet-600" strokeWidth={2} />
                      Hàng hóa
                    </span>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2} />
                      Requestor / Phòng ban
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    Trạng thái
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ngày xử lý
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prs.length > 0 ? (
                  prs.map(
                    (
                      pr: {
                        id: string;
                        prNumber?: string;
                        itemName?: string;
                        status: string;
                        requestor?: { username?: string };
                        department?: string;
                        processedAt: string;
                      },
                      index: number,
                    ) => (
                      <tr
                        key={pr.id}
                        className={`group transition-all duration-300 ease-out [&>td]:relative [&>td]:transition-all [&>td]:duration-300 [&>td]:ease-out [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl hover:[&>td]:z-[2] hover:[&>td]:-translate-y-[1px] hover:[&>td]:bg-indigo-50/85 hover:[&>td]:shadow-[inset_0_1px_0_rgba(99,102,241,0.25),inset_0_-1px_0_rgba(99,102,241,0.25)] hover:[&>td:first-child]:shadow-[-14px_0_30px_-14px_rgba(79,70,229,0.42),inset_0_1px_0_rgba(99,102,241,0.25),inset_0_-1px_0_rgba(99,102,241,0.25)] hover:[&>td:last-child]:shadow-[14px_0_30px_-14px_rgba(79,70,229,0.42),inset_0_1px_0_rgba(99,102,241,0.25),inset_0_-1px_0_rgba(99,102,241,0.25)] ${
                          index % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'
                        }`}
                      >
                        <td className="relative whitespace-nowrap px-4 py-4">
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-y-2 left-0 z-[1] w-[3px] rounded-r-full bg-indigo-600 opacity-0 transition-all duration-300 ease-out group-hover:opacity-100"
                          />
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-4 text-slate-600" title={pr.itemName}>
                          {pr.itemName}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div className="flex min-w-0 items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{pr.requestor?.username || 'N/A'}</p>
                              <p className="text-xs text-slate-500">{pr.department || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadge(pr.status)}`}
                          >
                            {getStatusIcon(pr.status)}
                            {getStatusLabel(pr.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" strokeWidth={2} />
                            {new Date(pr.processedAt).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Không có dữ liệu PR khớp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  );
};

export default PRHistory;
