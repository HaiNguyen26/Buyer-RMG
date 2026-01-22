import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, XCircle, Filter, Search, Eye, Trash2 } from 'lucide-react';
// TODO: Import buyerService from services when API is ready
// import { buyerService } from '../../services/buyerService';

const QuotationManagement = () => {
  const queryClient = useQueryClient();
  const [prFilter, setPrFilter] = useState<string>('all');
  const [validityFilter, setValidityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: quotationsData, isLoading } = useQuery({
    queryKey: ['buyer-quotations', prFilter, validityFilter],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // return buyerService.getQuotations({ prId: prFilter === 'all' ? undefined : prFilter });
      return { quotations: [] };
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    enabled: false, // Disable until API is ready - returns empty data
  });

  const toggleValidityMutation = useMutation({
    mutationFn: async ({ id, isValid }: { id: string; isValid: boolean }) => {
      // TODO: Replace with actual API call
      // return buyerService.toggleQuotationValidity(id, isValid);
      throw new Error('API not implemented yet');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-quotations'] });
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
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

  let filteredQuotations = quotationsData?.quotations || [];

  // Filter by validity
  if (validityFilter !== 'all') {
    filteredQuotations = filteredQuotations.filter((q: any) =>
      validityFilter === 'valid' ? q.isValid : !q.isValid
    );
  }

  // Filter by search
  filteredQuotations = filteredQuotations.filter((q: any) =>
    q.quotationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header với CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotation Management</h1>
          <p className="text-sm text-slate-500 mt-1">Lưu trữ và quản lý báo giá từ NCC (Tối thiểu 2-3 báo giá cho mỗi PR)</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-soft-lg hover:bg-blue-700 transition-colors font-semibold shadow-soft-md"
        >
          <Upload className="w-5 h-5" strokeWidth={2} />
          <span>Upload báo giá</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã báo giá, PR, NCC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 placeholder-slate-400 shadow-soft"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={validityFilter}
            onChange={(e) => setValidityFilter(e.target.value)}
            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 shadow-soft"
          >
            <option value="all">Tất cả</option>
            <option value="valid">Hợp lệ</option>
            <option value="invalid">Không hợp lệ</option>
          </select>
        </div>
      </div>

      {/* Quotations List */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Danh sách báo giá ({filteredQuotations.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã báo giá
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mã PR
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Nhà cung cấp
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Giá
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Thời gian giao
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Điều kiện thanh toán
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Hợp lệ
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.length > 0 ? (
                filteredQuotations.map((quotation: any, index: number) => (
                  <tr
                    key={quotation.id}
                    className={`transition-colors duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/50`}
                  >
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{quotation.quotationNumber}</span>
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      {quotation.prNumber}
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      <div>
                        <p className="font-medium text-slate-900">{quotation.supplier.name}</p>
                        <p className="text-xs text-slate-500">{quotation.supplier.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{formatPrice(quotation.price)}</span>
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal">
                      {quotation.deliveryTime}
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-600 font-normal max-w-xs">
                      <p className="truncate" title={quotation.paymentTerms}>{quotation.paymentTerms}</p>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <button
                        onClick={() =>
                          toggleValidityMutation.mutate({
                            id: quotation.id,
                            isValid: !quotation.isValid,
                          })
                        }
                        className={`p-2 rounded-soft transition-colors ${
                          quotation.isValid
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title={quotation.isValid ? 'Đánh dấu không hợp lệ' : 'Đánh dấu hợp lệ'}
                      >
                        {quotation.isValid ? (
                          <CheckCircle className="w-5 h-5" strokeWidth={2} />
                        ) : (
                          <XCircle className="w-5 h-5" strokeWidth={2} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(quotation.fileUrl, '_blank')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-soft transition-colors"
                          title="Xem file"
                        >
                          <Eye className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement edit quotation logic
                            alert('Chức năng chỉnh sửa sẽ được triển khai');
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-soft transition-colors"
                          title="Chỉnh sửa"
                        >
                          <FileText className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Không có báo giá nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal - Placeholder */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-soft-lg shadow-soft-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Upload báo giá</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn PR</label>
                <select className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                  <option>PR-20240101-ABCD</option>
                  <option>PR-20240102-EFGH</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhà cung cấp</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  placeholder="Tên NCC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Upload file (PDF/Excel)</label>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-soft hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement upload quotation logic
                    // buyerService.uploadQuotation(formData);
                    alert('Chức năng upload sẽ được triển khai');
                    setShowUploadModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-soft hover:bg-blue-700 transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationManagement;

