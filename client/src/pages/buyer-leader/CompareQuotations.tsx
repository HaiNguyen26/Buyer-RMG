import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scale, ArrowRight, Info, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';

const formatCurrency = (amount: number | null, currency: string = 'VND') => {
  if (!amount) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatNumber = (num: number | null) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const CompareQuotations = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rfqId = searchParams.get('rfqId');
  const [selectedRFQId, setSelectedRFQId] = useState<string | null>(rfqId || null);

  const { data: compareData, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-compare-quotations', selectedRFQId],
    queryFn: () => buyerLeaderService.compareQuotations(selectedRFQId!),
    enabled: !!selectedRFQId,
  });

  // TODO: Get list of RFQs with quotations ready for comparison
  // For now, we'll use rfqId from URL params

  if (!selectedRFQId) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-12 text-center">
          <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-slate-600 font-medium text-lg mb-2">Chọn RFQ để so sánh báo giá</p>
          <p className="text-slate-500 text-sm">Vui lòng chọn RFQ từ danh sách hoặc truy cập từ module khác</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải dữ liệu so sánh...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" strokeWidth={2} />
            <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  if (!compareData || !compareData.quotations || compareData.quotations.length === 0) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-12 text-center">
          <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-slate-600 font-medium text-lg mb-2">Chưa có báo giá để so sánh</p>
          <p className="text-slate-500 text-sm">RFQ này chưa có báo giá hợp lệ từ NCC</p>
        </div>
      </div>
    );
  }

  const quotations = compareData.quotations || [];
  const recommendation = compareData.recommendation;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="flex-shrink-0 mb-6 px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">So sánh báo giá</h1>
              <p className="text-slate-600">
                RFQ: <span className="font-semibold text-indigo-600">{compareData.rfq?.rfqNumber}</span>
                {' • '}
                PR: <span className="font-semibold text-slate-900">{compareData.rfq?.prNumber}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-6">
        <div className="flex-1 min-h-0 flex flex-col gap-6">
          {/* A. BẢNG SO SÁNH */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 flex-1 flex flex-col overflow-hidden slide-right-content">
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Bảng so sánh báo giá</h2>
            </div>
            
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto scrollbar-hide">
              <table className="w-full">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">NCC</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Giá</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase">Lead time</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Bảo hành</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Thanh toán</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase">
                      <div className="flex items-center justify-center gap-1">
                        <span>Điểm</span>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-slate-400 cursor-help" strokeWidth={2} />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg z-20">
                            <p className="font-semibold mb-1">Điểm đánh giá:</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>Giá (70%): Giá càng thấp càng tốt</li>
                              <li>Lead time (20%): Thời gian giao hàng ngắn</li>
                              <li>Thanh toán (10%): Điều khoản thanh toán tốt</li>
                            </ul>
                            <p className="mt-2 text-slate-300">Tổng điểm: 0-100</p>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {quotations.map((q: any) => {
                    const isRecommended = q.isRecommended;
                    return (
                      <tr
                        key={q.id}
                        className={`transition-colors ${
                          isRecommended
                            ? 'bg-blue-50/50 hover:bg-blue-50'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isRecommended && (
                              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" strokeWidth={2} />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{q.supplier.name}</p>
                              {q.supplier.code && (
                                <p className="text-xs text-slate-500">Mã: {q.supplier.code}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {formatCurrency(q.totalAmount, q.currency)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-sm text-slate-700">
                            {q.leadTime ? `${q.leadTime} ngày` : '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">
                            {q.warranty || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">
                            {q.paymentTerms || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {q.recommendationScore !== null ? (
                              <>
                                <div className="group relative">
                                  <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-semibold text-slate-900">
                                    {q.recommendationScore.toFixed(1)}
                                  </div>
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg z-20">
                                    <p className="font-semibold mb-2">Chi tiết điểm:</p>
                                    <div className="space-y-1">
                                      <p>• Giá: {q.recommendationScore >= 70 ? 'Tốt' : q.recommendationScore >= 50 ? 'Khá' : 'Trung bình'}</p>
                                      <p>• Lead time: {q.leadTime ? `${q.leadTime} ngày` : 'Chưa có'}</p>
                                      <p>• Thanh toán: {q.paymentTerms || 'Chưa có'}</p>
                                    </div>
                                  </div>
                                </div>
                                {isRecommended && (
                                  <TrendingUp className="w-4 h-4 text-blue-600" strokeWidth={2} />
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* B. SUMMARY PANEL */}
          {recommendation && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-200/50 p-6 slide-right-card-1">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">NCC đề xuất</h3>
                  <p className="text-base font-semibold text-blue-900 mb-1">
                    {recommendation.supplier.name}
                  </p>
                  <div className="mt-3 p-4 bg-white/80 rounded-xl border border-blue-200">
                    <p className="text-sm font-semibold text-slate-700 mb-1">Lý do hệ thống:</p>
                    <p className="text-sm text-slate-600">{recommendation.reason}</p>
                    {recommendation.score !== null && (
                      <p className="text-xs text-slate-500 mt-2">
                        Điểm tổng hợp: <span className="font-semibold">{recommendation.score.toFixed(1)}/100</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. ACTION */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 slide-right-card-2">
            <button
              onClick={() => navigate(`/dashboard/buyer-leader/select-supplier?prId=${compareData.rfq?.prId}&rfqId=${selectedRFQId}`)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <span>Chuyển sang Chọn NCC</span>
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareQuotations;
