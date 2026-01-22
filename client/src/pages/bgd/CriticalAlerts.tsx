import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { bgdService } from '../../services/bgdService';

const CriticalAlerts = () => {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['bgd-critical-alerts'],
    queryFn: bgdService.getCriticalAlerts,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded-soft"></div>
        </div>
      </div>
    );
  }

  const getIcon = (category: string) => {
    switch (category) {
      case 'budget':
        return DollarSign;
      case 'supplier':
        return AlertTriangle;
      case 'schedule':
        return Clock;
      default:
        return Bell;
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'red';
      case 'High':
        return 'amber';
      case 'Medium':
        return 'blue';
      default:
        return 'slate';
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Critical Alerts</h1>
        <p className="text-slate-600">Không bỏ sót vấn đề lớn</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-sm text-slate-600">Nghiêm trọng</div>
          </div>
          <div className="text-3xl font-bold text-red-600">
            {alertsData?.critical?.length || 0}
          </div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-sm text-slate-600">Cao</div>
          </div>
          <div className="text-3xl font-bold text-amber-600">
            {alertsData?.high?.length || 0}
          </div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600">Trung bình</div>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {alertsData?.medium?.length || 0}
          </div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-slate-600">Đã xử lý</div>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {alertsData?.resolved || 0}
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {alertsData?.critical && alertsData.critical.length > 0 && (
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-slate-800">Cảnh báo nghiêm trọng</h3>
          </div>
          <div className="space-y-3">
            {alertsData.critical.map((alert: any, idx: number) => {
              const Icon = getIcon(alert.category);
              return (
                <div
                  key={idx}
                  className="p-4 bg-red-50 rounded-lg border-2 border-red-300"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 mb-1">{alert.title}</div>
                      <div className="text-sm text-slate-600 mb-2">{alert.description}</div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Phát hiện: {alert.detectedAt}</span>
                        {alert.affectedProject && (
                          <span>Dự án: {alert.affectedProject}</span>
                        )}
                        {alert.impact && (
                          <span>Ảnh hưởng: {alert.impact}</span>
                        )}
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      Xử lý ngay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* High Priority Alerts */}
      {alertsData?.high && alertsData.high.length > 0 && (
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-slate-800">Cảnh báo cao</h3>
          </div>
          <div className="space-y-3">
            {alertsData.high.map((alert: any, idx: number) => {
              const Icon = getIcon(alert.category);
              return (
                <div
                  key={idx}
                  className="p-4 bg-amber-50 rounded-lg border border-amber-200"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 mb-1">{alert.title}</div>
                      <div className="text-sm text-slate-600 mb-2">{alert.description}</div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Phát hiện: {alert.detectedAt}</span>
                        {alert.affectedProject && (
                          <span>Dự án: {alert.affectedProject}</span>
                        )}
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Medium Priority Alerts */}
      {alertsData?.medium && alertsData.medium.length > 0 && (
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">Cảnh báo trung bình</h3>
          </div>
          <div className="space-y-3">
            {alertsData.medium.map((alert: any, idx: number) => {
              const Icon = getIcon(alert.category);
              return (
                <div
                  key={idx}
                  className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 mb-1">{alert.title}</div>
                      <div className="text-sm text-slate-600 mb-2">{alert.description}</div>
                      <div className="text-xs text-slate-500">
                        Phát hiện: {alert.detectedAt}
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Xem
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Alerts */}
      {(!alertsData?.critical || alertsData.critical.length === 0) &&
       (!alertsData?.high || alertsData.high.length === 0) &&
       (!alertsData?.medium || alertsData.medium.length === 0) && (
        <div className="glass rounded-soft p-12 text-center">
          <Bell className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <div className="text-xl font-semibold text-slate-800 mb-2">Không có cảnh báo</div>
          <div className="text-slate-600">Tất cả hệ thống đang hoạt động bình thường</div>
        </div>
      )}
    </div>
  );
};

export default CriticalAlerts;


