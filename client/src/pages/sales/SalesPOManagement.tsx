import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { Plus, Search, Filter, Edit, Lock, Unlock, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SalesPOManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-pos', statusFilter, searchQuery],
    queryFn: () =>
      salesService.getSalesPOs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery || undefined,
      }),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => salesService.closeSalesPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pos'] });
      queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => salesService.reopenSalesPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pos'] });
      queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Sales PO Management</h1>
          <p className="text-slate-600 mt-1">Tạo và quản lý PO khách hàng – nguồn ngân sách dự án</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/sales/sales-pos/new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Tạo Sales PO mới</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo số PO, tên dự án, mã dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          >
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Sales PO List */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Số Sales PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Khách hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Tên dự án / Mã dự án
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Giá trị PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Actual Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Remaining Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Ngày hiệu lực
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data?.salesPOs && data.salesPOs.length > 0 ? (
                  data.salesPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {po.salesPONumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {po.customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {po.projectName || po.projectCode || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {formatCurrency(po.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">
                        {formatCurrency(po.actualCost || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600">
                        {formatCurrency(po.remainingBudget || po.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(po.effectiveDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            po.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {po.status === 'ACTIVE' ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/dashboard/sales/projects/${po.id}`)}
                            className="p-1.5 text-slate-600 hover:text-[#3B82F6] hover:bg-blue-50 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/dashboard/sales/sales-pos/${po.id}/edit`)}
                            className="p-1.5 text-slate-600 hover:text-[#3B82F6] hover:bg-blue-50 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {po.status === 'ACTIVE' ? (
                            <button
                              onClick={() => closeMutation.mutate(po.id)}
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="Đóng PO"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => reopenMutation.mutate(po.id)}
                              className="p-1.5 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Mở lại PO"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Không có Sales PO nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPOManagement;




