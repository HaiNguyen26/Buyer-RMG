import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardCheck, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';

const Notifications = () => {
  const { data: notificationsData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-notifications'],
    queryFn: () => branchManagerService.getNotifications(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'NEW_PR':
        return <ClipboardCheck className="w-5 h-5 text-blue-500" strokeWidth={2} />;
      case 'PR_RETURNED':
        return <MessageSquare className="w-5 h-5 text-amber-500" strokeWidth={2} />;
      case 'PR_URGENT':
        return <Clock className="w-5 h-5 text-red-500" strokeWidth={2} />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" strokeWidth={2} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'NEW_PR':
        return 'bg-blue-50 border-blue-200 border-l-4 border-blue-500';
      case 'PR_RETURNED':
        return 'bg-amber-50 border-amber-200 border-l-4 border-amber-500';
      case 'PR_URGENT':
        return 'bg-red-50 border-red-200 border-l-4 border-red-500';
      default:
        return 'bg-slate-50 border-slate-200 border-l-4 border-slate-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const unreadCount = notificationsData?.notifications.filter((n: any) => !n.read).length || 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Nhận thông báo cần hành động</p>
        </div>
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-soft-lg font-semibold">
            {unreadCount} thông báo chưa đọc
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
          notificationsData.notifications.map((notification: any) => (
            <div
              key={notification.id}
              className={`bg-white rounded-soft shadow-soft p-4 card-hover transition-all ${
                !notification.read ? 'ring-2 ring-blue-200' : ''
              } ${getNotificationColor(notification.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                      {notification.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                      <span className="text-xs text-slate-500 font-normal">
                        {new Date(notification.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm mb-2 ${!notification.read ? 'font-medium text-slate-900' : 'font-normal text-slate-700'}`}>
                    {notification.message}
                  </p>
                  {notification.prNumber && (
                    <p className="text-xs text-slate-600 font-medium mb-1">
                      PR: {notification.prNumber}
                    </p>
                  )}
                  {notification.comment && (
                    <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium mb-1">Comment:</p>
                      <p className="text-xs text-slate-700 font-normal">{notification.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-soft shadow-soft border border-slate-200 p-8 text-center">
            <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" strokeWidth={2} />
            <p className="text-slate-600 font-normal">Không có thông báo nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;


