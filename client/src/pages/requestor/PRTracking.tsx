import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Search, Filter, AlertCircle, CheckCircle2, Clock, User, ChevronRight, X } from 'lucide-react';

type PRTrackingData = {
  id: string;
  prNumber: string;
  itemName: string | null;
  purpose: string | null;
  department: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  progress: {
    percentage: number;
    stages: Array<{
      key: string;
      label: string;
      completed: boolean;
      current: boolean;
    }>;
    currentStage: {
      key: string;
      label: string;
      completed: boolean;
      current: boolean;
    } | null;
  };
  currentHandler: string | null;
  sla: {
    status: 'on_time' | 'warning' | 'overdue' | 'completed';
    timeRemaining: string | null;
    timeOverdue: string | null;
    daysSinceCreated: number;
  };
};

type FilterType = 'all' | 'on_time' | 'warning' | 'overdue' | 'completed';

const PRTracking = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedPR, setSelectedPR] = useState<PRTrackingData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pr-tracking-list'],
    queryFn: () => requestorService.getPRTrackingList(),
    refetchInterval: 30000, // Refetch every 30 seconds for realtime updates
  });

  // Filter PRs based on search and filter
  const filteredPRs = data?.prs.filter((pr) => {
    // Search filter
    const matchesSearch =
      pr.prNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pr.itemName && pr.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

    // Status filter
    const matchesFilter =
      filter === 'all' ||
      (filter === 'on_time' && pr.sla.status === 'on_time') ||
      (filter === 'warning' && pr.sla.status === 'warning') ||
      (filter === 'overdue' && pr.sla.status === 'overdue') ||
      (filter === 'completed' && pr.sla.status === 'completed');

    // Overdue only toggle
    const matchesOverdueOnly = !showOverdueOnly || pr.sla.status === 'overdue';

    return matchesSearch && matchesFilter && matchesOverdueOnly;
  }) || [];

  const getSLAStatusConfig = (status: PRTrackingData['sla']['status']) => {
    switch (status) {
      case 'on_time':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeColor: 'bg-green-100 text-green-700 border-green-300',
          progressColor: 'bg-green-500',
          icon: CheckCircle2,
          label: 'Đúng hạn',
        };
      case 'warning':
        return {
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          badgeColor: 'bg-amber-100 text-amber-700 border-amber-300',
          progressColor: 'bg-amber-500',
          icon: Clock,
          label: 'Sắp quá hạn',
          pulse: true,
        };
      case 'overdue':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeColor: 'bg-red-100 text-red-700 border-red-300',
          progressColor: 'bg-red-500',
          icon: AlertCircle,
          label: 'Quá hạn',
          glow: true,
        };
      case 'completed':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeColor: 'bg-blue-100 text-blue-700 border-blue-300',
          progressColor: 'bg-blue-500',
          icon: CheckCircle2,
          label: 'Hoàn thành',
        };
      default:
        return {
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
          progressColor: 'bg-slate-500',
          icon: Clock,
          label: 'Đang xử lý',
        };
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency === 'VND' ? 'VND' : 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 rounded-lg w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Theo dõi PR</h1>
          <p className="text-slate-600">Theo dõi tiến độ và trạng thái các PR của bạn</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm theo PR No hoặc tên PR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'on_time', 'warning', 'overdue', 'completed'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' ? 'Tất cả' : f === 'on_time' ? 'Đúng hạn' : f === 'warning' ? 'Sắp trễ' : f === 'overdue' ? 'Quá hạn' : 'Hoàn thành'}
                </button>
              ))}
            </div>

            {/* Overdue Only Toggle */}
            <button
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showOverdueOnly
                  ? 'bg-red-100 text-red-700 border-2 border-red-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-transparent'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Chỉ hiển thị PR trễ
            </button>
          </div>
        </div>

        {/* PR Cards Grid */}
        {filteredPRs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-500">Không tìm thấy PR nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPRs.map((pr) => {
              const statusConfig = getSLAStatusConfig(pr.sla.status);
              const StatusIcon = statusConfig.icon;
              const hasAnimation = statusConfig.pulse || statusConfig.glow;

              return (
                <div
                  key={pr.id}
                  onClick={() => setSelectedPR(pr)}
                  className={`bg-white rounded-lg shadow-sm border-2 ${
                    pr.sla.status === 'overdue'
                      ? 'border-red-300 shadow-red-100'
                      : pr.sla.status === 'warning'
                      ? 'border-amber-200'
                      : 'border-slate-200'
                  } hover:shadow-md transition-all cursor-pointer ${
                    hasAnimation && pr.sla.status === 'warning' ? 'animate-pulse' : ''
                  } ${
                    hasAnimation && pr.sla.status === 'overdue'
                      ? 'ring-2 ring-red-200 ring-opacity-50'
                      : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-lg">{pr.prNumber}</h3>
                        <p className="text-slate-600 text-sm mt-1 line-clamp-2">
                          {pr.itemName || 'Không có tên'}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${
                          statusConfig.badgeColor
                        } ${hasAnimation && pr.sla.status === 'warning' ? 'animate-pulse' : ''}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="px-4 py-3">
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span>Tiến độ</span>
                        <span className="font-semibold">{Math.round(pr.progress.percentage)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ease-in-out ${statusConfig.progressColor}`}
                          style={{ width: `${pr.progress.percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Current Stage */}
                    {pr.progress.currentStage && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Đang xử lý: </span>
                        {pr.progress.currentStage.label}
                      </div>
                    )}

                    {/* Current Handler */}
                    {pr.currentHandler && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <User className="w-4 h-4" />
                        <span>{pr.currentHandler}</span>
                      </div>
                    )}
                  </div>

                  {/* SLA Info */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center justify-between text-sm">
                      {pr.sla.status === 'completed' ? (
                        <span className="text-blue-600 font-medium">Đã hoàn thành</span>
                      ) : pr.sla.status === 'overdue' ? (
                        <span className="text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Quá hạn {pr.sla.timeOverdue}
                        </span>
                      ) : (
                        <span className={`font-medium ${statusConfig.color}`}>
                          {pr.sla.status === 'warning' ? 'Còn ' : 'Còn '}
                          {pr.sla.timeRemaining}
                        </span>
                      )}
                      {pr.totalAmount && (
                        <span className="text-slate-600">
                          {formatCurrency(pr.totalAmount, pr.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PR Detail Modal */}
      {selectedPR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{selectedPR.prNumber}</h2>
              <button
                onClick={() => setSelectedPR(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* PR Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Thông tin PR</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Tên PR:</span>
                    <p className="text-slate-900 font-medium">{selectedPR.itemName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Phòng ban:</span>
                    <p className="text-slate-900 font-medium">{selectedPR.department || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Mục đích:</span>
                    <p className="text-slate-900 font-medium">{selectedPR.purpose || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tổng giá trị:</span>
                    <p className="text-slate-900 font-medium">
                      {formatCurrency(selectedPR.totalAmount, selectedPR.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Stages */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">Tiến trình</h3>
                <div className="space-y-3">
                  {selectedPR.progress.stages.map((stage, index) => (
                    <div key={stage.key} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          stage.completed
                            ? 'bg-green-100 text-green-600'
                            : stage.current
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {stage.completed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : stage.current ? (
                          <ChevronRight className="w-5 h-5" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-current" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            stage.completed
                              ? 'text-green-700'
                              : stage.current
                              ? 'text-blue-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {stage.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLA Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Thời gian xử lý</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  {selectedPR.sla.status === 'completed' ? (
                    <p className="text-blue-600 font-medium">PR đã hoàn thành</p>
                  ) : selectedPR.sla.status === 'overdue' ? (
                    <p className="text-red-600 font-medium">
                      PR đã quá hạn {selectedPR.sla.timeOverdue}
                    </p>
                  ) : (
                    <p className={`font-medium ${getSLAStatusConfig(selectedPR.sla.status).color}`}>
                      {selectedPR.sla.status === 'warning' ? 'Còn ' : 'Còn '}
                      {selectedPR.sla.timeRemaining}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRTracking;





