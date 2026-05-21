import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardCheck, MessageSquare, Clock } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BranchManagerPageHero } from '../../components/BranchManagerPageHero';
import { branchManagerPageStackClass, branchManagerPanelCardClass } from '../../constants/branchManagerLayout';

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
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col py-6">
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
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col py-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const unreadCount = notificationsData?.notifications.filter((n: any) => !n.read).length || 0;

  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${branchManagerPageStackClass}`}>
      <div className="shrink-0 pb-2">
        <BranchManagerPageHero
          kicker="Giám đốc chi nhánh · Thông báo"
          title="Thông báo"
          description="Nhận thông báo cần hành động — PR mới, PR trả, PR khẩn."
          Icon={Bell}
          tint="ocean"
          regionLabel="Thông báo"
          rightSlot={
            unreadCount > 0 ? (
              <div className="rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Chưa đọc</p>
                <p className="text-lg font-bold tabular-nums text-white">{unreadCount}</p>
              </div>
            ) : null
          }
        />
      </div>

      {/* Notifications List */}
      <div className="flex min-w-0 flex-col gap-3">
        {notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
          notificationsData.notifications.map((notification: any) => (
            <div
              key={notification.id}
              className={`${branchManagerPanelCardClass} !p-4 card-hover transition-all ${
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
          <div className={`${branchManagerPanelCardClass} py-10 text-center`}>
            <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" strokeWidth={2} />
            <p className="text-slate-600 font-normal">Không có thông báo nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;


