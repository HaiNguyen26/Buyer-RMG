import { useQuery } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Bell, CheckCircle, AlertCircle, FileText, MessageSquare } from 'lucide-react';

const Notifications = () => {
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['requestor-notifications'],
    queryFn: () => requestorService.getNotifications(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-64"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PR_SUBMITTED':
        return <FileText className="w-5 h-5 text-blue-500" strokeWidth={2} />;
      case 'PR_RETURNED':
        return <AlertCircle className="w-5 h-5 text-amber-500" strokeWidth={2} />;
      case 'PR_APPROVED':
        return <CheckCircle className="w-5 h-5 text-green-500" strokeWidth={2} />;
      case 'PR_READY_FOR_RFQ':
        return <CheckCircle className="w-5 h-5 text-emerald-500" strokeWidth={2} />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" strokeWidth={2} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'PR_SUBMITTED':
        return 'bg-blue-50 border-blue-200';
      case 'PR_RETURNED':
        return 'bg-amber-50 border-amber-200';
      case 'PR_APPROVED':
        return 'bg-green-50 border-green-200';
      case 'PR_READY_FOR_RFQ':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'PR_SUBMITTED':
        return 'PR được gửi thành công';
      case 'PR_RETURNED':
        return 'PR bị trả kèm comment';
      case 'PR_APPROVED':
        return 'PR được duyệt';
      case 'PR_READY_FOR_RFQ':
        return 'PR chuyển sang bước mua (Ready for RFQ)';
      default:
        return 'Thông báo';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 animate-fade-in">

      {/* Notifications List */}
      <div className="space-y-3 animate-slide-up">
        {notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
          notificationsData.notifications.map((notification: any) => (
            <div
              key={notification.id}
              className={`bg-white rounded-soft shadow-soft border-l-4 p-4 card-hover ${getNotificationColor(notification.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-900">
                      {getNotificationTitle(notification.type)}
                    </h3>
                    <span className="text-xs text-slate-500 font-normal">
                      {new Date(notification.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-normal mb-2">
                    {notification.message}
                  </p>
                  {notification.prNumber && (
                    <p className="text-xs text-slate-600 font-medium">
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
    </div>
  );
};

export default Notifications;

