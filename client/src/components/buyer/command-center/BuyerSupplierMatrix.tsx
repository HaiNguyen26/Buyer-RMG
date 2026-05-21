import { Phone, Users } from 'lucide-react';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import { buyerDashboardKpiIslandPaddingClass } from '../../../constants/buyerLayout';
import type { ApiSupplier } from './buyerSupplierUtils';

const islandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerDashboardKpiIslandPaddingClass,
].join(' ');

type Props = {
  suppliers: ApiSupplier[];
  isLoading?: boolean;
};

export function BuyerSupplierMatrix({ suppliers, isLoading }: Props) {
  const visible = suppliers.slice(0, 6);

  return (
    <article className={`${islandClass} flex h-full flex-col space-y-3`}>
      <SectionHeader
        Icon={Users}
        eyebrow="NCC"
        title="Danh bạ NCC"
        description="Lấy từ API /suppliers — mã, liên hệ, gọi nhanh."
        stackDescription
      />

      {isLoading ? (
        <p className="py-6 text-center text-xs text-slate-500">Đang tải danh sách NCC…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200/70 bg-slate-50/50 px-3 py-6 text-center text-xs text-slate-500">
          Chưa có nhà cung cấp trong hệ thống.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-200/65 bg-white/55 px-2.5 py-2 transition hover:border-indigo-200/50 hover:bg-white/85 sm:px-3 sm:py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  {row.code ? (
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">{row.code}</p>
                  ) : null}
                  {row.contactPerson ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{row.contactPerson}</p>
                  ) : null}
                  {row.email ? (
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.email}</p>
                  ) : null}
                </div>
                {row.phone ? (
                  <a
                    href={`tel:${row.phone.replace(/\s/g, '')}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-200/40 transition hover:bg-indigo-500/20"
                    aria-label={`Gọi ${row.name}`}
                    title="Gọi nhanh"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
