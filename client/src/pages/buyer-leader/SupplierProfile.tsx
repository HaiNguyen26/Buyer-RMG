/**
 * Trang chi tiết nhà cung cấp (Hồ sơ NCC).
 * Mở từ So sánh báo giá qua nút "Hồ sơ NCC", nhận supplier qua location.state hoặc id từ URL.
 */
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  FileText,
  Mail,
  Phone,
  MapPin,
  Hash,
  CheckCircle2,
  Award,
  TrendingUp,
} from 'lucide-react';

const SupplierProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const supplier = (location.state as { supplier?: Record<string, unknown> } | null)?.supplier as Record<string, unknown> | undefined;

  const displayId = id ? decodeURIComponent(id) : '';
  const name = (supplier?.name as string) || displayId || 'Nhà cung cấp';
  const code = (supplier?.code as string) || '';

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto animate-fade-in-right fade-in-right-delay-0">
      <div className="w-full min-w-0 space-y-8 py-4 sm:py-6">
        {/* Nút quay lại */}
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>

        {/* Card header — Hồ sơ NCC */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 px-8 py-8 border-b border-slate-200">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
                {code && (
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    {code}
                  </p>
                )}
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Đối tác hợp tác
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin chi tiết */}
          <div className="p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Thông tin chi tiết
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: 'Tên NCC', value: name, icon: Building2 },
                { label: 'Mã NCC', value: code || '—', icon: Hash },
                { label: 'Email', value: (supplier?.email as string) || '—', icon: Mail },
                { label: 'Điện thoại', value: (supplier?.phone as string) || '—', icon: Phone },
                { label: 'Địa chỉ', value: (supplier?.address as string) || '—', icon: MapPin },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:border-slate-300 transition-colors"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </p>
                  <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
                </div>
              ))}
            </div>

            {/* Các trường bổ sung từ API (nếu có) */}
            {supplier &&
              Object.entries(supplier).some(
                ([k, v]) =>
                  !['id', 'name', 'code', 'email', 'phone', 'address'].includes(k) &&
                  v != null &&
                  String(v).trim() !== ''
              ) && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Thông tin khác</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(supplier)
                      .filter(
                        ([k, v]) =>
                          !['id', 'name', 'code', 'email', 'phone', 'address'].includes(k) &&
                          v != null &&
                          String(v).trim() !== ''
                      )
                      .map(([key, val]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                          <dd className="text-sm text-slate-900">{String(val)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
          </div>
        </div>

        {/* Card tóm tắt (placeholder cho số liệu sau này) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">RFQ đã tham gia</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">—</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Tỷ lệ trúng thầu</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">—</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Đánh giá gần đây</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierProfile;
