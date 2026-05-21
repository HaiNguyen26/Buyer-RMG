import { Bell } from 'lucide-react';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import { buyerLeaderPageStackClass } from '../../constants/buyerLeaderLayout';

const Notifications = () => {
  return (
    <div className={`animate-fade-in-right fade-in-right-delay-0 ${buyerLeaderPageStackClass}`}>
      <BuyerLeaderPageHero
        kicker="Buyer Leader · Thông báo"
        title="Thông báo"
        description="Thông báo và cảnh báo quan trọng"
        Icon={Bell}
        tint="graphite"
        regionLabel="Thông báo Buyer Leader"
      />

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

