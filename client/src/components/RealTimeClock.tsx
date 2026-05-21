import { useState, useEffect } from 'react';
import { Calendar, Clock3 } from 'lucide-react';

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
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return { dayName, day, month, year };
  };

  const { hours, minutes, seconds } = formatTime(currentTime);
  const { dayName, day, month, year } = formatDate(currentTime);

  return (
    <div className="relative group cursor-default">
      {/* Glow background effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
      
      <div className="relative flex items-center gap-4 bg-slate-900 px-5 py-2.5 rounded-2xl border border-slate-700 shadow-xl">
        {/* Date */}
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
            <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{dayName}</span>
          </div>
          <div className="text-sm font-semibold text-slate-300 tracking-tight">
            {day}/{month}/{year}
          </div>
        </div>
        
        {/* Divider */}
        <div className="w-px h-8 bg-slate-700/80" />
        
        {/* Time */}
        <div className="flex items-center gap-2">
          <div className="flex items-baseline text-2xl font-black tracking-tighter tabular-nums text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            <span>{hours}</span>
            <span className="mx-1 text-blue-500 animate-[pulse_1s_ease-in-out_infinite] opacity-80">:</span>
            <span>{minutes}</span>
            <span className="mx-1 text-blue-500 animate-[pulse_1s_ease-in-out_infinite] opacity-80">:</span>
            <span className="text-blue-300 w-[2ch] inline-block text-center">{seconds}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeClock;
