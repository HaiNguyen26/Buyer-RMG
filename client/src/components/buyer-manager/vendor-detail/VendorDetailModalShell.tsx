import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { VendorDetailTabs, vendorDetailCanvasClass } from './vendorDetailUi';

export type VendorDetailModalShellProps = {
  activeTab: string;
  onTabChange: (id: string) => void;
  tabs: { id: string; label: string; icon: LucideIcon }[];
  children: ReactNode;
};

export function VendorDetailModalShell({
  activeTab,
  onTabChange,
  tabs,
  children,
}: VendorDetailModalShellProps) {
  return (
    <div className={`flex min-h-0 flex-col ${vendorDetailCanvasClass}`}>
      <VendorDetailTabs tabs={tabs} activeId={activeTab} onChange={onTabChange} />
      <div className="min-h-0 flex-1 p-4 sm:p-5">{children}</div>
    </div>
  );
}
