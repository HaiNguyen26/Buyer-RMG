import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { ArrowLeft, CheckCircle2, Clock, DollarSign } from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-po-detail', id],
    queryFn: () => salesService.getSalesPODetail(id!),
    enabled: !!id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_DONE':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã Payment DONE
          </span>
        );
      case 'SUPPLIER_SELECTED':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã chọn NCC
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Đang xử lý
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Không tìm thấy Sales PO</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/sales/sales-pos')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Project / Sales PO Detail</h1>
          <p className="text-slate-600 mt-1">
            {data.salesPO.salesPONumber} - {data.salesPO.projectName || data.salesPO.projectCode || 'N/A'}
          </p>
        </div>
      </div>

      {/* Sales PO Info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Thông tin Sales PO</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Số Sales PO</p>
            <p className="text-lg font-medium text-slate-800">{data.salesPO.salesPONumber}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Khách hàng</p>
            <p className="text-lg font-medium text-slate-800">{data.salesPO.customer.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Tên dự án</p>
            <p className="text-lg font-medium text-slate-800">{data.salesPO.projectName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Mã dự án</p>
            <p className="text-lg font-medium text-slate-800">{data.salesPO.projectCode || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Giá trị PO</p>
            <p className="text-lg font-medium text-slate-800">
              {formatCurrency(data.salesPO.amount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Ngày hiệu lực</p>
            <p className="text-lg font-medium text-slate-800">
              {new Date(data.salesPO.effectiveDate).toLocaleDateString('vi-VN')}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Trạng thái</p>
            <span
              className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-1 ${
                data.salesPO.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {data.salesPO.status === 'ACTIVE' ? 'Active' : 'Closed'}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Tổng hợp tài chính</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">Sales PO Amount</p>
            <p className="text-2xl font-bold text-slate-800 mt-2">
              {formatCurrency(data.financialSummary.salesPOAmount)}
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-700">Actual Cost</p>
            <p className="text-2xl font-bold text-amber-800 mt-2">
              {formatCurrency(data.financialSummary.actualCost)}
            </p>
            <p className="text-xs text-amber-600 mt-1">(Payment DONE)</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-emerald-700">Remaining Budget</p>
            <p className="text-2xl font-bold text-emerald-800 mt-2">
              {formatCurrency(data.financialSummary.remainingBudget)}
            </p>
          </div>
        </div>
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Tiến độ sử dụng ngân sách</p>
            <p className="text-sm font-medium text-slate-800">
              {data.financialSummary.progressPercent}%
            </p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                parseFloat(data.financialSummary.progressPercent) >= 100
                  ? 'bg-red-500'
                  : parseFloat(data.financialSummary.progressPercent) >= 90
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(parseFloat(data.financialSummary.progressPercent), 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Purchase Requests List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Danh sách PR thuộc PO này</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Số PR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Tên hàng hóa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Requestor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  NCC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Actual Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.purchaseRequests && data.purchaseRequests.length > 0 ? (
                data.purchaseRequests.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {pr.prNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pr.itemName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {pr.requestor.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {pr.supplier?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-600">
                      {formatCurrency(pr.actualCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(pr.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Chưa có PR nào
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

export default ProjectDetail;




