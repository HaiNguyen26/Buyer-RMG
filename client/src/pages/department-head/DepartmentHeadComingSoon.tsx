import { Info } from 'lucide-react';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import {
  departmentHeadPageStackClass,
  departmentHeadPanelCardClass,
} from '../../constants/departmentHeadLayout';

type Props = {
  title: string;
  description?: string;
};

export default function DepartmentHeadComingSoon({
  title,
  description = 'Tính năng đang được hoàn thiện.',
}: Props) {
  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${departmentHeadPageStackClass}`}>
      <div className="shrink-0 pb-2">
        <DepartmentPageHero
          kicker="Trưởng phòng"
          title={title}
          description={description}
          Icon={Info}
          tint="graphite"
          regionLabel={title}
        />
      </div>
      <div className={departmentHeadPanelCardClass}>
        <p className="text-slate-600">Sắp ra mắt...</p>
      </div>
    </div>
  );
}
