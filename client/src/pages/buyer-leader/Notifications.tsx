import { Bell } from 'lucide-react';

const Notifications = () => {
  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-soft-lg shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Thông báo</h1>
            <p className="text-slate-600 mt-1">Thông báo và cảnh báo quan trọng</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white/80 backdrop-blur-sm rounded-soft-lg shadow-soft-md border border-slate-200/50 p-12 text-center slide-right-content">
        <Bell className="w-16 h-16 text-slate-400 mx-auto mb-4" strokeWidth={2} />
        <p className="text-slate-600 font-medium text-lg">Không có thông báo</p>
        <p className="text-slate-500 text-sm mt-2">Các thông báo quan trọng sẽ hiển thị ở đây</p>
      </div>
    </div>
  );
};

export default Notifications;

