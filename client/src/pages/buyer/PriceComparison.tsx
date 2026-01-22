import { useQuery } from '@tanstack/react-query';
import { Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { buyerService } from '../../services/buyerService';

const PriceComparison = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-price-comparison'],
    queryFn: () => buyerService.getPriceComparison(),
    enabled: false, // Disable until API is ready
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Lỗi khi tải dữ liệu
        </div>
      </div>
    );
  }

  // Mock data structure
  const comparisons = data?.comparisons || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 rounded-xl">
          <Scale className="w-6 h-6 text-indigo-600" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Price Comparison (PR vs RFQ)</h1>
          <p className="text-sm text-slate-600">So sánh giá PR (Requestor) với giá báo NCC</p>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 gap-4">
        {comparisons.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center">
            <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-600 mb-2">Chưa có dữ liệu so sánh</p>
            <p className="text-sm text-slate-500">Dữ liệu sẽ hiển thị sau khi có RFQ và báo giá từ NCC</p>
          </div>
        ) : (
          comparisons.map((comparison: any) => {
            const prPrice = comparison.prPrice || 0;
            const rfqPrice = comparison.rfqPrice || 0;
            const diff = rfqPrice - prPrice;
            const diffPercent = prPrice > 0 ? ((diff / prPrice) * 100) : 0;
            const isOver = diff > 0;

            return (
              <div key={comparison.id} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Card Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{comparison.prNumber}</h3>
                      <p className="text-sm text-slate-600 mt-1">{comparison.description}</p>
                    </div>
                    {isOver && (
                      <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        Vượt {diffPercent.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Comparison Content */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PR Price */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Giá PR (Requestor)</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {prPrice.toLocaleString('vi-VN')} {comparison.currency || 'VND'}
                      </div>
                    </div>

                    {/* RFQ Price */}
                    <div className={`rounded-xl p-4 border-2 ${isOver ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${isOver ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Giá báo NCC</span>
                      </div>
                      <div className={`text-2xl font-bold ${isOver ? 'text-red-700' : 'text-green-700'}`}>
                        {rfqPrice.toLocaleString('vi-VN')} {comparison.currency || 'VND'}
                      </div>
                    </div>
                  </div>

                  {/* Difference */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Chênh lệch:</span>
                      <div className={`flex items-center gap-2 font-bold ${isOver ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                        {isOver ? (
                          <>
                            <TrendingUp className="w-5 h-5" />
                            <span>+{diff.toLocaleString('vi-VN')} {comparison.currency || 'VND'}</span>
                            <span className="text-sm">(+{diffPercent.toFixed(1)}%)</span>
                          </>
                        ) : diff < 0 ? (
                          <>
                            <TrendingDown className="w-5 h-5" />
                            <span>{diff.toLocaleString('vi-VN')} {comparison.currency || 'VND'}</span>
                            <span className="text-sm">({diffPercent.toFixed(1)}%)</span>
                          </>
                        ) : (
                          <>
                            <Minus className="w-5 h-5" />
                            <span>0 {comparison.currency || 'VND'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supplier Info */}
                  {comparison.supplierName && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">NCC:</span> {comparison.supplierName}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PriceComparison;


