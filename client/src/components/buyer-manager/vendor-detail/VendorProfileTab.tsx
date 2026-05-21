import type { ReactNode } from 'react';
import {
  Building,
  Building2,
  Briefcase,
  Edit2,
  FileText,
  Landmark,
  MapPin,
  Package,
  Save,
  ShieldCheck,
  Star,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  VendorDetailQuickActions,
  VendorDetailSection,
  VendorFieldLabel,
  VendorFieldValue,
  vendorDetailBtnPrimaryClass,
  vendorDetailBtnSecondaryClass,
  vendorDetailInputClass,
} from './vendorDetailUi';

type VendorStatus = 'APPROVED' | 'PENDING' | 'BLOCKED' | 'INACTIVE';
type VendorCategory = 'Electrical' | 'Mechanical' | 'Fabrication' | 'Chemical' | 'IT' | 'Services';

export type VendorProfileVendor = {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  address: string;
  country: string;
  legalRepresentative?: string;
  capital?: string;
  registeredOffice?: string;
  category: VendorCategory[];
  supplierType: 'STANDARD' | 'CUSTOM';
  status: VendorStatus;
  rating?: number;
  isPreferred: boolean;
  hasContract: boolean;
  onTimeDelivery: number;
  poCount: number;
  qualityIssues: number;
  tags?: string[];
  growthInsight?: string;
  avlStatus?: string;
};

type ProfileForm = {
  name: string;
  taxCode: string;
  legalRepresentative: string;
  capital: string;
  registeredOffice: string;
  address: string;
  country: string;
  avlStatus: string;
};

export type VendorProfileTabProps = {
  vendor: VendorProfileVendor;
  categoryLabels: Record<VendorCategory, string>;
  statusLabel: string;
  statusBadgeClass: string;
  statusIcon: ReactNode;
  isEditing: boolean;
  profileData: ProfileForm;
  onProfileDataChange: (data: ProfileForm) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export function VendorProfileTab({
  vendor,
  categoryLabels,
  statusLabel,
  statusBadgeClass,
  statusIcon,
  isEditing,
  profileData,
  onProfileDataChange,
  onStartEdit,
  onSave,
  onCancel,
}: VendorProfileTabProps) {
  const editActions = isEditing ? (
    <>
      <button type="button" onClick={onSave} className={vendorDetailBtnPrimaryClass}>
        <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
        Lưu
      </button>
      <button type="button" onClick={onCancel} className={vendorDetailBtnSecondaryClass}>
        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        Hủy
      </button>
    </>
  ) : (
    <button type="button" onClick={onStartEdit} className={vendorDetailBtnPrimaryClass}>
      <Edit2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      Cập nhật
    </button>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="min-w-0 space-y-4 lg:col-span-8">
        <VendorDetailSection title="Định danh doanh nghiệp">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <VendorFieldLabel icon={Building2}>Mã nhà cung cấp</VendorFieldLabel>
              <VendorFieldValue value={vendor.code} mono />
            </div>
            <div>
              <VendorFieldLabel icon={Building}>Tên nhà cung cấp</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => onProfileDataChange({ ...profileData, name: e.target.value })}
                  className={vendorDetailInputClass}
                />
              ) : (
                <VendorFieldValue value={vendor.name} />
              )}
            </div>
            <div className="sm:col-span-2">
              <VendorFieldLabel icon={FileText}>Mã số thuế</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.taxCode}
                  onChange={(e) => onProfileDataChange({ ...profileData, taxCode: e.target.value })}
                  className={`${vendorDetailInputClass} font-mono`}
                />
              ) : (
                <VendorFieldValue value={vendor.taxCode} mono />
              )}
            </div>
          </div>
        </VendorDetailSection>

        <VendorDetailSection title="Pháp lý & Tài chính">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <VendorFieldLabel icon={Briefcase}>Người đại diện pháp luật</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.legalRepresentative}
                  onChange={(e) =>
                    onProfileDataChange({ ...profileData, legalRepresentative: e.target.value })
                  }
                  className={vendorDetailInputClass}
                  placeholder="Nguyễn Văn A"
                />
              ) : (
                <VendorFieldValue value={vendor.legalRepresentative} />
              )}
            </div>
            <div>
              <VendorFieldLabel icon={Landmark}>Vốn điều lệ</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.capital}
                  onChange={(e) => onProfileDataChange({ ...profileData, capital: e.target.value })}
                  className={vendorDetailInputClass}
                  placeholder="100.000.000.000 VND"
                />
              ) : (
                <VendorFieldValue value={vendor.capital} />
              )}
            </div>
            <div className="sm:col-span-2">
              <VendorFieldLabel icon={ShieldCheck}>Trạng thái AVL</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.avlStatus}
                  onChange={(e) => onProfileDataChange({ ...profileData, avlStatus: e.target.value })}
                  className={vendorDetailInputClass}
                  placeholder="Verified for 2026"
                />
              ) : (
                <VendorFieldValue value={vendor.avlStatus} />
              )}
            </div>
          </div>
        </VendorDetailSection>

        <VendorDetailSection title="Địa lý & Phân loại">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <VendorFieldLabel icon={Building}>Văn phòng đăng ký</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.registeredOffice}
                  onChange={(e) =>
                    onProfileDataChange({ ...profileData, registeredOffice: e.target.value })
                  }
                  className={vendorDetailInputClass}
                />
              ) : (
                <VendorFieldValue value={vendor.registeredOffice} />
              )}
            </div>
            <div className="sm:col-span-2">
              <VendorFieldLabel icon={MapPin}>Địa chỉ</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.address}
                  onChange={(e) => onProfileDataChange({ ...profileData, address: e.target.value })}
                  className={vendorDetailInputClass}
                />
              ) : (
                <VendorFieldValue value={vendor.address} />
              )}
            </div>
            <div>
              <VendorFieldLabel icon={MapPin}>Quốc gia</VendorFieldLabel>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.country}
                  onChange={(e) => onProfileDataChange({ ...profileData, country: e.target.value })}
                  className={vendorDetailInputClass}
                />
              ) : (
                <VendorFieldValue value={vendor.country} />
              )}
            </div>
            <div>
              <VendorFieldLabel icon={Package}>Loại nhà cung cấp</VendorFieldLabel>
              <span
                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                  vendor.supplierType === 'STANDARD'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                }`}
              >
                {vendor.supplierType}
              </span>
            </div>
            <div className="sm:col-span-2">
              <VendorFieldLabel icon={Tag}>Trạng thái phê duyệt</VendorFieldLabel>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass}`}
              >
                {statusIcon}
                {statusLabel}
              </span>
            </div>
          </div>
        </VendorDetailSection>
      </div>

      <aside className="min-w-0 space-y-4 lg:col-span-4">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <h4 className="pt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tóm tắt nhanh</h4>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <VendorDetailQuickActions />
              {editActions}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {vendor.isPreferred ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden />
                Ưu tiên
              </span>
            ) : null}
            {vendor.hasContract ? (
              <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200/80">
                Có hợp đồng
              </span>
            ) : null}
            {!vendor.isPreferred && !vendor.hasContract ? (
              <span className="text-xs italic text-slate-400">Chưa gắn nhãn ưu tiên / HĐ</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ngành hàng</h4>
          <div className="flex flex-wrap gap-1.5">
            {vendor.category.length > 0 ? (
              vendor.category.map((cat) => (
                <span
                  key={cat}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80"
                >
                  {categoryLabels[cat] ?? cat}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-slate-400">Chưa phân loại ngành</span>
            )}
          </div>
        </section>

        {vendor.tags && vendor.tags.length > 0 ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Chứng chỉ / Tag</h4>
            <div className="flex flex-wrap gap-1.5">
              {vendor.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-sm ring-1 ring-indigo-100/50 sm:p-5">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-800">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            SLA & Hiệu suất (snapshot)
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between gap-2 border-b border-slate-100/90 pb-2">
              <span className="text-slate-600">Giao đúng hạn</span>
              <span className="font-bold tabular-nums text-slate-900">{vendor.onTimeDelivery}%</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-slate-100/90 pb-2">
              <span className="text-slate-600">Số PO</span>
              <span className="font-bold tabular-nums text-slate-900">{vendor.poCount}</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-slate-100/90 pb-2">
              <span className="text-slate-600">Vấn đề CL</span>
              <span className="font-bold tabular-nums text-slate-900">{vendor.qualityIssues}</span>
            </li>
            {vendor.rating != null ? (
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Đánh giá</span>
                <span className="font-bold text-slate-900">{vendor.rating}</span>
              </li>
            ) : null}
          </ul>
          {vendor.growthInsight ? (
            <p className="mt-3 rounded-lg border border-dashed border-indigo-200/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-indigo-900/90">
              {vendor.growthInsight}
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
