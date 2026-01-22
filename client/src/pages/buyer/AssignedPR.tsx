import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, MessageSquare, Filter, Search } from 'lucide-react';
import { buyerService } from '../../services/buyerService';

const AssignedPR = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: prsData, isLoading } = useQuery({
    queryKey: ['buyer-assigned-prs', statusFilter],
    queryFn: () =>
      buyerService.getAssignedPRs({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_RFQ':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COLLECTING_QUOTATION':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'QUOTATION_COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'READY_FOR_RFQ':
        return 'Ready for RFQ';
      case 'COLLECTING_QUOTATION':
        return 'Collecting quotation';
      case 'QUOTATION_COMPLETED':
        return 'Quotation completed';
      default:
        return status;
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

  const filteredPRs = (prsData?.prs || []).filter((pr: any) =>
    pr.prNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.salesPO?.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.salesPO?.project?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm PR theo mã, Sales PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 placeholder-slate-400 shadow-soft"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 shadow-soft"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="READY_FOR_RFQ">Ready for RFQ</option>
            <option value="COLLECTING_QUOTATION">Collecting quotation</option>
            <option value="QUOTATION_COMPLETED">Quotation completed</option>
          </select>
        </div>
      </div>

      {/* PRs List */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Danh sách PR được phân công ({filteredPRs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã PR
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sales PO / Dự án
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Phạm vi phụ trách
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Ngày phân công
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPRs.length > 0 ? (
                filteredPRs.map((pr: any, index: number) => (
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
                      <div>
                        <p className="font-medium text-slate-900">{pr.salesPO.number}</p>
                        <p className="text-xs text-slate-500">{pr.salesPO.project}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      {pr.scope}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${getStatusBadge(pr.status)}`}>
                        {getStatusLabel(pr.status)}
                      </span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-slate-600 font-normal">
                      {new Date(pr.assignedDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-soft transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}/comment`)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-soft transition-colors"
                          title="Yêu cầu bổ sung thông tin"
                        >
                          <MessageSquare className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Không có PR nào
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

export default AssignedPR;

