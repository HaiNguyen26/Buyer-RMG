import { Bell, AlertCircle, CheckCircle2, Info } from 'lucide-react';

const Notifications = () => {
  // TODO: Integrate with Socket.IO for real-time notifications
  const notifications = [
    {
      id: '1',
      type: 'new_pr',
      title: 'Có PR mới phát sinh',
      message: 'PR #PR-001 đã được tạo cho Sales PO #SPO-001',
      timestamp: new Date(),
      read: false,
    },
    {
      id: '2',
      type: 'payment_done',
      title: 'PR hoàn tất thanh toán',
      message: 'PR #PR-002 đã hoàn tất thanh toán (Payment DONE)',
      timestamp: new Date(Date.now() - 3600000),
      read: false,
    },
    {
      id: '3',
      type: 'budget_warning',
      title: 'Dự án sắp vượt ngân sách',
      message: 'Sales PO #SPO-002 đã sử dụng 95% ngân sách',
      timestamp: new Date(Date.now() - 7200000),
      read: true,
    },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_done':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'budget_warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'payment_done':
        return 'bg-emerald-50 border-emerald-200';
      case 'budget_warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="w-8 h-8 text-[#3B82F6]" />
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-600 mt-1">
            Cập nhật các sự kiện ảnh hưởng đến dự án
          </p>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`bg-white rounded-lg border-2 p-4 transition-all ${
              notification.read ? 'opacity-75' : ''
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
                  {!notification.read && (
                    <span className="w-2 h-2 bg-[#3B82F6] rounded-full flex-shrink-0 mt-2"></span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {notification.timestamp.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-600">
          <strong>Thông báo sẽ được gửi khi:</strong>
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
          <li>Có PR mới phát sinh cho Sales PO</li>
          <li>PR hoàn tất thanh toán (Payment DONE)</li>
          <li>Dự án vượt / sắp vượt ngân sách</li>
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Tính năng này sẽ được tích hợp với Socket.IO để nhận thông báo real-time.
        </p>
      </div>
    </div>
  );
};

export default Notifications;




