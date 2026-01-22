import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationBellProps {
  role: string;
}

const NotificationBell = ({ role }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  // Debug logging
  useEffect(() => {
    console.log('🔔 NotificationBell - Role:', role);
    console.log('🔔 NotificationBell - Unread count:', unreadCount);
    console.log('🔔 NotificationBell - Notifications:', notifications);
  }, [role, unreadCount, notifications]);

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
            navigate(`/dashboard/buyer-leader/compare-quotations?prId=${relatedId}`);
          } else if (type === 'PR_OVER_BUDGET_ACTION_REQUIRED') {
            navigate(`/dashboard/buyer-leader/over-budget-prs?prId=${relatedId}`);
          } else if (type === 'PR_RETURNED_FROM_BRANCH_MANAGER') {
            navigate(`/dashboard/buyer-leader/pending-assignments?prId=${relatedId}`);
          }
        }
        break;

      case 'BUYER':
        // BUYER: Open assigned PR/item
        if (relatedType === 'PR' && relatedId) {
          navigate(`/dashboard/buyer/pr/${relatedId}`);
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
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-700" strokeWidth={2} />
        {hasUnread && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[600px] flex flex-col animate-slideUpFadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Thông báo</h3>
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

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
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
                      className={`p-4 cursor-pointer transition-colors ${
                        isUnread
                          ? 'bg-indigo-50/50 hover:bg-indigo-100/50'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            isUnread ? 'bg-red-500' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4
                              className={`text-sm font-semibold ${
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
                                className="p-1 hover:bg-indigo-100 rounded transition-colors flex-shrink-0"
                                title="Đánh dấu đã đọc"
                              >
                                <Check className="w-3.5 h-3.5 text-indigo-600" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                          <p className="text-xs text-slate-400">
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

