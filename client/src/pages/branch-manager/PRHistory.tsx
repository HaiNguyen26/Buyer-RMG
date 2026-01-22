import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Search, CheckCircle, XCircle, MessageSquare, Building2, Calendar } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';

const PRHistory = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30'); // days
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
        return 'bg-green-50 text-green-700 border-green-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'RETURNED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-4 h-4" strokeWidth={2} />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4" strokeWidth={2} />;
      case 'RETURNED':
        return <MessageSquare className="w-4 h-4" strokeWidth={2} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const prs = (historyData?.prs || []).filter((pr: any) =>
    pr.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.itemName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-soft p-4">
        <div className="flex items-start gap-3">
          <History className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Chỉ xem – không chỉnh</h3>
            <p className="text-sm text-blue-700">
              Theo dõi lịch sử PR của chi nhánh: PR đã duyệt, PR bị trả, PR theo phòng ban/Requestor
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm PR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900"
            >
              <option value="all">Tất cả</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Bị từ chối</option>
              <option value="RETURNED">Bị trả</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phòng ban</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900"
            >
              <option value="all">Tất cả</option>
              {/* TODO: Populate from API */}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Thời gian</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900"
            >
              <option value="7">7 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
              <option value="365">1 năm qua</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRs List */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Lịch sử PR ({prs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã PR
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Hàng hóa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Requestor / Phòng ban
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Ngày xử lý
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prs.length > 0 ? (
                prs.map((pr: any, index: number) => (
                  <tr
                    key={pr.id}
                    className={`transition-colors duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/50`}
                  >
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      {pr.itemName}
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" strokeWidth={2} />
                        <div>
                          <p className="font-medium text-slate-900">{pr.requestor?.username || 'N/A'}</p>
                          <p className="text-xs text-slate-500">{pr.department || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border flex items-center gap-1 w-fit ${getStatusBadge(pr.status)}`}>
                        {getStatusIcon(pr.status)}
                        {pr.status === 'APPROVED' ? 'Đã duyệt' :
                         pr.status === 'REJECTED' ? 'Bị từ chối' :
                         pr.status === 'RETURNED' ? 'Bị trả' : pr.status}
                      </span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-slate-600 font-normal">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" strokeWidth={2} />
                        {new Date(pr.processedAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Không có dữ liệu PR
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PRHistory;


