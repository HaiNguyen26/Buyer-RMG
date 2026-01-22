import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const RealTimeClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return { hours, minutes, seconds };
  };

  const formatDate = (date: Date) => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return { dayName, day, month, year };
  };

  const { hours, minutes, seconds } = formatTime(currentTime);
  const { dayName, day, month, year } = formatDate(currentTime);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-soft-lg shadow-soft-md border border-slate-700/50">
      {/* Clock Icon */}
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
        <Clock className="w-5 h-5 text-blue-400" strokeWidth={2} />
      </div>

      {/* Time Display */}
      <div className="flex flex-col">
        {/* Time */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-white tabular-nums">{hours}</span>
          <span className="text-xl font-bold text-blue-400 animate-pulse">:</span>
          <span className="text-2xl font-bold text-white tabular-nums">{minutes}</span>
          <span className="text-xl font-bold text-blue-400 animate-pulse">:</span>
          <span className="text-lg font-semibold text-blue-300 tabular-nums">{seconds}</span>
        </div>
        
        {/* Date */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-300 font-medium">{dayName}</span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-300 font-normal">{day}/{month}/{year}</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeClock;



