import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastComponent = ({ toast, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-amber-900';
      case 'info':
        return 'text-blue-900';
    }
  };

  return (
    <div
      className={`
        toast-popup-enter
        ${getBgColor()}
        border rounded-soft-lg shadow-soft-lg p-4 mb-3
        flex items-start gap-3 min-w-[320px] max-w-[480px]
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className={`flex-1 ${getTextColor()} text-sm font-medium`}>
        {toast.message}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className={`
          flex-shrink-0 
          ${getTextColor()} 
          hover:opacity-70 
          transition-opacity
        `}
        aria-label="Đóng thông báo"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ToastComponent;
