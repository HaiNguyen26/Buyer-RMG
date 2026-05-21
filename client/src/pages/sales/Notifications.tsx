import { useQuery } from '@tanstack/react-query';
import { Bell, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

const Notifications = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'sales'],
    queryFn: () => notificationService.getNotifications(),
    refetchOnWindowFocus: true,
  });

  const notifications = data?.notifications ?? [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT_DONE':
      case 'PR_APPROVED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'BUDGET_WARNING':
      case 'PR_RETURNED':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'PAYMENT_DONE':
      case 'PR_APPROVED':
        return 'bg-emerald-50 border-emerald-200';
      case 'BUDGET_WARNING':
      case 'PR_RETURNED':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-200 rounded w-64" />
          <div className="h-24 bg-slate-200 rounded" />
          <div className="h-24 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
          Không tải được thông báo. Vui lòng thử lại sau.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-8 h-8 text-[#3B82F6]" />
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-600 mt-1">Thông báo từ hệ thống theo tài khoản của bạn</p>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Chưa có thông báo
          </div>
        ) : (
          notifications.map((notification: {
            id: string;
            type: string;
            title: string;
            message: string;
            createdAt: string;
            readAt?: string | null;
            status?: string;
          }) => {
            const read = Boolean(notification.readAt) || notification.status !== 'UNREAD';
            return (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                  read ? 'opacity-75' : ''
                } ${getNotificationBg(notification.type)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{notification.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                      </div>
                      {!read && <span className="w-2 h-2 bg-[#3B82F6] rounded-full flex-shrink-0 mt-2" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(notification.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notifications;
