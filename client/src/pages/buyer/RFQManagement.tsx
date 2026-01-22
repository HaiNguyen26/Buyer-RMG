import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Edit, Eye, Download, Send, Filter, Search, Trash2 } from 'lucide-react';
// TODO: Import buyerService from services when API is ready
// import { buyerService } from '../../services/buyerService';

const RFQManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rfqsData, isLoading } = useQuery({
    queryKey: ['buyer-rfqs', statusFilter],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // return buyerService.getRFQs({ status: statusFilter === 'all' ? undefined : statusFilter });
      return { rfqs: [] };
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    enabled: false, // Disable until API is ready - returns empty data
  });

  const createRFQMutation = useMutation({
    mutationFn: async (data: any) => {
      // TODO: Replace with actual API call
      // return buyerService.createRFQ(data);
      throw new Error('API not implemented yet');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      navigate('/dashboard/buyer/rfq/create');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'SENT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EXPIRED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'SENT':
        return 'Đã gửi';
      case 'EXPIRED':
        return 'Hết hạn';
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

  const filteredRFQs = (rfqsData?.rfqs || []).filter((rfq: any) =>
    rfq.rfqNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfq.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfq.salesPO?.number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header với CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RFQ Management</h1>
          <p className="text-sm text-slate-500 mt-1">Tạo và quản lý RFQ (Request for Quotation)</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/buyer/rfq/create')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-soft-lg hover:bg-blue-700 transition-colors font-semibold shadow-soft-md"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          <span>Tạo RFQ mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm RFQ theo mã, PR..."
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
            <option value="DRAFT">Draft</option>
            <option value="SENT">Đã gửi</option>
            <option value="EXPIRED">Hết hạn</option>
          </select>
        </div>
      </div>

      {/* RFQs List */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Danh sách RFQ ({filteredRFQs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã RFQ
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã PR
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sales PO / Dự án
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRFQs.length > 0 ? (
                filteredRFQs.map((rfq: any, index: number) => (
                  <tr
                    key={rfq.id}
                    className={`transition-colors duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/50`}
                  >
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{rfq.rfqNumber}</span>
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      {rfq.prNumber}
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      <div>
                        <p className="font-medium text-slate-900">{rfq.salesPO.number}</p>
                        <p className="text-xs text-slate-500">{rfq.salesPO.project}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${getStatusBadge(rfq.status)}`}>
                        {getStatusLabel(rfq.status)}
                      </span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-slate-600 font-normal">
                      {new Date(rfq.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {rfq.status === 'DRAFT' && (
                          <button
                            onClick={() => navigate(`/dashboard/buyer/rfq/${rfq.id}/edit`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-soft transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" strokeWidth={2} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/dashboard/buyer/rfq/${rfq.id}`)}
                          className="p-2 text-slate-600 hover:bg-slate-50 rounded-soft transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement PDF export
                            // buyerService.exportRFQPDF(rfq.id);
                            alert('Chức năng xuất PDF sẽ được triển khai');
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-soft transition-colors"
                          title="Xuất PDF"
                        >
                          <Download className="w-4 h-4" strokeWidth={2} />
                        </button>
                        {rfq.status === 'DRAFT' && (
                          <button
                            onClick={() => {
                              // TODO: Implement send RFQ logic
                              alert('Chức năng gửi RFQ sẽ được triển khai');
                            }}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-soft transition-colors"
                            title="Gửi RFQ"
                          >
                            <Send className="w-4 h-4" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Không có RFQ nào
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

export default RFQManagement;

