import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationBellProps {
  role: string;
  /** Nút chuông trên header tối (icon/hover) */
  toolbarOnDark?: boolean;
}

const NotificationBell = ({ role, toolbarOnDark = false }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle notification click based on role
  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (notification.status === 'UNREAD') {
      markAsRead(notification.id);
    }

    // Navigate based on role and notification type
    const { type, relatedId, relatedType } = notification;

    switch (role) {
      case 'REQUESTOR':
        // REQUESTOR: Open PR Detail (read-only)
        if (relatedType === 'PR' && relatedId) {
          // Navigate to PR detail modal or page
          // This depends on your routing structure
          navigate(`/dashboard/requestor/pr/${relatedId}`);
        }
        break;

      case 'DEPARTMENT_HEAD':
        // DEPARTMENT_HEAD: Open PR Approval module
        if (type === 'PR_PENDING_APPROVAL' && relatedId) {
          navigate(`/dashboard/department-head/pr-approval?prId=${relatedId}`);
        }
        break;

      case 'BUYER_LEADER':
        // BUYER_LEADER: Navigate to appropriate module
        if (relatedType === 'PR' && relatedId) {
          if (type === 'PR_READY_FOR_ASSIGNMENT') {
            navigate(`/dashboard/buyer-leader/pending-assignments?prId=${relatedId}`);
          } else if (type === 'PR_QUOTATIONS_COMPLETE') {
            navigate(`/dashboard/buyer-leader/rfq-monitoring?prId=${relatedId}`);
          } else if (type === 'PR_OVER_BUDGET_ACTION_REQUIRED') {
            navigate(`/dashboard/buyer-leader/over-budget-prs?prId=${relatedId}`);
          } else if (type === 'PR_RETURNED_FROM_BRANCH_MANAGER') {
            navigate(`/dashboard/buyer-leader/pending-assignments?prId=${relatedId}`);
          }
        }
        break;

      case 'BUYER':
        // BUYER: Open assigned PR/item
        if (relatedId) {
          if (relatedType === 'RFQ') {
            navigate(`/dashboard/buyer/rfq/${relatedId}`);
          } else {
            navigate(`/dashboard/buyer/assigned-prs/${relatedId}`);
          }
        }
        break;

      case 'BRANCH_MANAGER':
        // BRANCH_MANAGER: Open PR Approval or Over-Budget module
        if (relatedType === 'PR' && relatedId) {
          if (type === 'PR_OVER_BUDGET_DECISION_REQUIRED') {
            navigate(`/dashboard/branch-manager/budget-exceptions?prId=${relatedId}`);
          } else {
            navigate(`/dashboard/branch-manager/pr-approval?prId=${relatedId}`);
          }
        }
        break;
    }

    setIsOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const unreadNotifications = notifications.filter((n: any) => n.status === 'UNREAD');
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-xl p-2 transition-colors ${
          toolbarOnDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
        }`}
        aria-label="Notifications"
      >
        <Bell
          className={`h-5 w-5 ${toolbarOnDark ? 'text-slate-100' : 'text-slate-700'}`}
          strokeWidth={2}
        />
        {hasUnread && (
          <span
            className={`absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold text-white ${
              toolbarOnDark ? 'border-slate-800 bg-red-500' : 'border-white bg-red-600'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-[200] mt-2 flex w-80 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-slideUpFadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-sm font-bold text-slate-900">Thông báo</h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <button
                  onClick={() => {
                    markAllAsRead();
                  }}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4 inline mr-1" />
                  Đọc tất cả
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Notifications List — chỉ hiển thị ~3–4 đơn, dài hơn thì cuộn */}
          <div className="overflow-y-auto scrollbar-hide max-h-[280px] min-h-0">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-slate-500 text-sm">Không có thông báo</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification: any) => {
                  const isUnread = notification.status === 'UNREAD';
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors ${
                        isUnread
                          ? 'bg-indigo-50/50 hover:bg-indigo-100/50'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                            isUnread ? 'bg-red-500' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <h4
                              className={`text-xs font-semibold leading-tight line-clamp-2 ${
                                isUnread ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {notification.title}
                            </h4>
                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="p-0.5 hover:bg-indigo-100 rounded transition-colors flex-shrink-0"
                                title="Đánh dấu đã đọc"
                              >
                                <Check className="w-3 h-3 text-indigo-600" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mb-1 line-clamp-2">{notification.message}</p>
                          <p className="text-[10px] text-slate-400">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

