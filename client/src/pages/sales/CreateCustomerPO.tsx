import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import {
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  Hash,
  Landmark,
  MapPin,
  UserRound,
  Phone,
  Mail,
  Sparkles,
  CalendarDays,
  CreditCard,
  Truck,
  Briefcase,
  Users,
  AlignLeft,
  StickyNote,
  Layers,
} from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { AppModal } from '../../components/AppModal';
import { dashboardPageContentBottomClass } from '../../constants/dashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type IconComp = ComponentType<{ className?: string; strokeWidth?: number }>;

const inp =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.07]';
const lbl = 'mb-1.5 block text-sm font-medium text-slate-700';
const fieldInputClass =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06]';
const fieldLabelClass = 'mb-1.5 block text-xs font-medium text-slate-700';

type FormSectionTone = 'amber' | 'sky' | 'violet' | 'teal' | 'indigo' | 'stone';

const formSectionTone: Record<
  FormSectionTone,
  { shell: string; header: string; icon: string; step: string; body: string }
> = {
  amber: {
    shell:
      'border-amber-200/65 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/45 shadow-[0_12px_40px_-18px_rgba(217,119,6,0.22)] ring-1 ring-amber-900/[0.05]',
    header:
      'border-b border-amber-100/85 bg-gradient-to-r from-amber-100/50 via-orange-50/45 to-amber-50/25',
    icon: 'rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-white/60 sm:rounded-2xl',
    step: 'text-amber-800/90',
    body: 'bg-gradient-to-b from-white via-amber-50/[0.12] to-orange-50/25',
  },
  sky: {
    shell:
      'border-sky-200/55 bg-gradient-to-br from-sky-50/65 via-white to-cyan-50/35 shadow-[0_12px_40px_-18px_rgba(14,165,233,0.18)] ring-1 ring-sky-900/[0.04]',
    header: 'border-b border-sky-100/80 bg-gradient-to-r from-sky-100/45 via-cyan-50/40 to-sky-50/20',
    icon: 'rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/20 ring-2 ring-white/60 sm:rounded-2xl',
    step: 'text-sky-800/90',
    body: 'bg-gradient-to-b from-white via-sky-50/[0.1] to-cyan-50/20',
  },
  violet: {
    shell:
      'border-violet-200/50 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 shadow-[0_12px_40px_-18px_rgba(139,92,246,0.16)] ring-1 ring-violet-900/[0.04]',
    header: 'border-b border-violet-100/75 bg-gradient-to-r from-violet-100/40 via-fuchsia-50/35 to-violet-50/20',
    icon: 'rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/20 ring-2 ring-white/60 sm:rounded-2xl',
    step: 'text-violet-800/90',
    body: 'bg-gradient-to-b from-white via-violet-50/[0.1] to-fuchsia-50/18',
  },
  teal: {
    shell:
      'border-teal-200/55 bg-gradient-to-br from-teal-50/55 via-white to-emerald-50/38 shadow-[0_12px_40px_-18px_rgba(20,184,166,0.17)] ring-1 ring-teal-900/[0.04]',
    header: 'border-b border-teal-100/80 bg-gradient-to-r from-teal-100/42 via-emerald-50/40 to-teal-50/22',
    icon: 'rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/22 ring-2 ring-white/60 sm:rounded-2xl',
    step: 'text-teal-800/90',
    body: 'bg-gradient-to-b from-white via-teal-50/[0.1] to-emerald-50/22',
  },
  indigo: {
    shell:
      'border-indigo-200/50 bg-gradient-to-br from-indigo-50/58 via-white to-blue-50/32 shadow-[0_12px_40px_-18px_rgba(99,102,241,0.15)] ring-1 ring-indigo-900/[0.04]',
    header: 'border-b border-indigo-100/75 bg-gradient-to-r from-indigo-100/38 via-blue-50/38 to-indigo-50/18',
    icon: 'rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-white/60 sm:rounded-2xl',
    step: 'text-indigo-800/90',
    body: 'bg-gradient-to-b from-white via-indigo-50/[0.09] to-blue-50/18',
  },
  stone: {
    shell:
      'border-stone-200/70 bg-gradient-to-br from-stone-100/55 via-white to-amber-50/22 shadow-[0_12px_36px_-16px_rgba(120,113,108,0.14)] ring-1 ring-stone-900/[0.04]',
    header: 'border-b border-stone-200/70 bg-gradient-to-r from-stone-100/60 via-amber-50/25 to-stone-50/30',
    icon: 'rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 text-white shadow-md shadow-stone-600/20 ring-2 ring-white/50 sm:rounded-2xl',
    step: 'text-stone-700',
    body: 'bg-gradient-to-b from-white via-stone-50/30 to-amber-50/12',
  },
};

function FormSection({
  step,
  title,
  description,
  icon: Icon,
  tone = 'amber',
  children,
}: {
  step: string;
  title: string;
  description?: string;
  icon: IconComp;
  tone?: FormSectionTone;
  children: React.ReactNode;
}) {
  const t = formSectionTone[tone];
  return (
    <section className={`overflow-hidden rounded-2xl border sm:rounded-3xl ${t.shell}`}>
      <div className={`flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 md:px-8 ${t.header}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11 ${t.icon}`}>
          <Icon className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${t.step}`}>{step}</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
      </div>
      <div className={`space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:px-8 ${t.body}`}>{children}</div>
    </section>
  );
}

const CreateCustomerPO = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalNewCustomer, setModalNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    code: '',
    taxCode: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
  });

  const { data: nextNumber } = useQuery({
    queryKey: ['sales-next-po-number'],
    queryFn: () => salesService.getNextSalesPONumber(),
  });
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/customers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const j = await res.json();
      return j?.customers ?? [];
    },
  });
  const customers = (customersData ?? []) as { id: string; name: string }[];

  const formatContractVND = (n: number) =>
    n > 0
      ? new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
          maximumFractionDigits: 0,
        }).format(n)
      : '';

  const [form, setForm] = useState({
    customerPONumber: '',
    poDate: new Date().toISOString().slice(0, 10),
    contractValue: 0,
    customerId: '',
    projectName: '',
    projectCode: '',
    projectManager: '',
    salesOwner: '',
    deliveryDeadline: '',
    paymentTerms: '',
    advancePercent: 0,
    projectDescription: '',
    notes: '',
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setForm((f) => ({ ...f, customerId: data.customer?.id ?? '' }));
      setModalNewCustomer(false);
      setNewCustomer({ name: '', code: '', taxCode: '', address: '', contactPerson: '', phone: '', email: '' });
    },
  });

  const createPOMutation = useMutation({
    mutationFn: () =>
      salesService.createSalesPO({
        salesPONumber: nextNumber?.salesPONumber ?? `SO-${new Date().getFullYear()}-001`,
        customerPONumber: form.customerPONumber || undefined,
        customerId: form.customerId,
        projectName: form.projectName,
        projectCode: form.projectCode || undefined,
        totalPOValue: form.contractValue,
        currency: 'VND',
        effectiveDate: form.poDate ? new Date(form.poDate).toISOString() : new Date().toISOString(),
        action: 'ACTIVATE',
        projectManager: form.projectManager || undefined,
        deliveryDeadline: form.deliveryDeadline || undefined,
        paymentTerms: form.paymentTerms || undefined,
        advancePercent: form.advancePercent || undefined,
        projectDescription: form.projectDescription || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sales-sales-pos'] });
      navigate(`/dashboard/sales/orders/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.projectName.trim() || form.contractValue <= 0) return;
    createPOMutation.mutate();
  };

  const canSubmit = form.customerId && form.projectName.trim() && form.contractValue > 0 && !createPOMutation.isPending;

  return (
    <div className={`w-full min-w-0 ${dashboardPageContentBottomClass}`}>
      {/* Full width trong outlet (max-w-[100rem] đã ở shell); không thu hẹp max-w-3xl */}
      <div className="mx-auto w-full min-w-0 max-w-[100rem] space-y-6 sm:space-y-8">
        <button
          type="button"
          onClick={() => navigate('/dashboard/sales/orders')}
          className="group inline-flex w-fit items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" strokeWidth={2} />
          Quay lại danh sách SO
        </button>

        {/* Banner compact — Sales + chip mã SO */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/30 p-4 shadow-[0_10px_32px_-18px_rgba(217,119,6,0.22)] ring-1 ring-amber-900/[0.04] sm:rounded-2xl sm:p-4 md:px-5 md:py-4">
          <div
            className="pointer-events-none absolute -right-16 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-amber-400/15 to-orange-400/8 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-1 ring-white/50">
                <FileText className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800/80">Tạo mới</p>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  Sales Order (SO)
                </h1>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                  Hợp đồng, khách hàng, dự án — SO <span className="font-semibold text-slate-800">Running</span> để các bộ phận tạo PR
                  và theo dõi ngân sách.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 sm:justify-end">
              <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm sm:min-w-[9.5rem]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mã SO (tự động)</p>
                <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                  {nextNumber?.salesPONumber ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 md:space-y-7">
          <FormSection
            tone="amber"
            step="Bước 1"
            title="Hợp đồng & giá trị"
            description="Số PO khách (nếu có), ngày hiệu lực và tổng giá trị — dùng làm ngưỡng ngân sách dự án."
            icon={FileText}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={lbl}>Số PO khách hàng</label>
                <input
                  value={form.customerPONumber}
                  onChange={(e) => setForm((f) => ({ ...f, customerPONumber: e.target.value }))}
                  className={inp}
                  placeholder="VD: 223212"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-slate-400">Tuỳ chọn — để đối chiếu với chứng từ khách.</p>
              </div>
              <div>
                <label className={lbl}>Ngày hiệu lực</label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={form.poDate}
                    onChange={(e) => setForm((f) => ({ ...f, poDate: e.target.value }))}
                    className={`${inp} pl-10`}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>
                  Giá trị hợp đồng (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.contractValue || ''}
                  onChange={(e) => setForm((f) => ({ ...f, contractValue: parseFloat(e.target.value) || 0 }))}
                  className={inp}
                  placeholder="VD: 5000000000"
                  required
                />
                {form.contractValue > 0 ? (
                  <p className="mt-2 text-sm font-medium tabular-nums text-slate-700">{formatContractVND(form.contractValue)}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400">Bắt buộc để kích hoạt SO.</p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection
            tone="sky"
            step="Bước 2"
            title="Khách hàng"
            description="Chọn khách hàng trong hệ thống hoặc thêm mới nếu chưa có."
            icon={Users}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-md">
                <label className={lbl}>Customer</label>
                <CustomSelect
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                  className={`${inp} py-2`}
                >
                  <option value="">Chọn khách hàng…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <button
                type="button"
                onClick={() => setModalNewCustomer(true)}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300/90 bg-white/90 px-4 text-sm font-medium text-sky-900/85 shadow-sm backdrop-blur-sm transition hover:border-sky-400 hover:bg-sky-50/90"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Tạo khách hàng mới
              </button>
            </div>
          </FormSection>

          <FormSection
            tone="violet"
            step="Bước 3"
            title="Dự án & phụ trách"
            description="Tên dự án bắt buộc; mã dự án và người phụ trách giúp theo dõi trên dashboard."
            icon={Briefcase}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={lbl}>
                  Tên dự án <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.projectName}
                  onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                  className={inp}
                  placeholder="VD: Hệ thống camera nhà máy"
                  required
                />
              </div>
              <div>
                <label className={lbl}>Mã dự án</label>
                <input
                  value={form.projectCode}
                  onChange={(e) => setForm((f) => ({ ...f, projectCode: e.target.value }))}
                  className={inp}
                  placeholder="PROJ-2026-001"
                />
              </div>
              <div>
                <label className={lbl}>Project manager</label>
                <input
                  value={form.projectManager}
                  onChange={(e) => setForm((f) => ({ ...f, projectManager: e.target.value }))}
                  className={inp}
                  placeholder="Nguyễn Văn B"
                />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Sales owner</label>
                <input
                  value={form.salesOwner}
                  onChange={(e) => setForm((f) => ({ ...f, salesOwner: e.target.value }))}
                  className={inp}
                  placeholder="Tên hoặc mã nhân viên sales"
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            tone="teal"
            step="Bước 4"
            title="Hạn giao & thanh toán"
            description="Tách hạn vận hành (giao hàng) với cấu trúc thanh toán (tạm ứng % và milestone / điều khoản)."
            icon={Layers}
          >
            <div className="space-y-6">
              <div className="rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50/50 via-white to-cyan-50/25 p-4 shadow-sm ring-1 ring-teal-900/[0.03] sm:rounded-3xl sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm ring-2 ring-white/50">
                    <Truck className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Hạn giao hàng</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Mốc vận hành — ưu tiên Buyer, lead time NCC, kho. Không nhầm với kỳ thanh toán.
                      </p>
                    </div>
                    <div className="max-w-xs">
                      <label htmlFor="so-delivery-deadline" className={lbl}>
                        Ngày hạn giao
                      </label>
                      <input
                        id="so-delivery-deadline"
                        type="date"
                        value={form.deliveryDeadline}
                        onChange={(e) => setForm((f) => ({ ...f, deliveryDeadline: e.target.value }))}
                        className={inp}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200/55 bg-gradient-to-br from-white via-emerald-50/35 to-teal-50/20 p-4 shadow-sm ring-1 ring-emerald-900/[0.04] sm:rounded-3xl sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-2 ring-white/45">
                    <CreditCard className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Cấu trúc thanh toán</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      <strong className="font-medium text-slate-700">Tạm ứng %</strong> = tiền mặt trả trước. Ô bên phải mô tả toàn bộ kỳ
                      còn lại, Net 30, nghiệm thu…
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label htmlFor="so-advance-pct" className={lbl}>
                      Tạm ứng khi ký PO (%)
                    </label>
                    <div className="relative">
                      <input
                        id="so-advance-pct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={form.advancePercent || ''}
                        onChange={(e) => setForm((f) => ({ ...f, advancePercent: parseFloat(e.target.value) || 0 }))}
                        className={`${inp} pr-10 tabular-nums`}
                        placeholder="VD: 20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Điều kiện Finance / NCC trước khi sản xuất.</p>
                    {form.advancePercent > 0 && form.advancePercent < 100 && (
                      <p className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-950/90">
                        Gợi ý phần còn lại:{' '}
                        <span className="tabular-nums">{(100 - form.advancePercent).toFixed(2).replace(/\.?0+$/, '')}%</span>
                        <span className="font-normal text-emerald-900/70"> — mô tả chi tiết ở ô bên cạnh.</span>
                      </p>
                    )}
                    {form.advancePercent >= 100 && (
                      <p className="mt-2 text-xs text-slate-600">100% tạm ứng.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="so-payment-terms" className={lbl}>
                      Điều khoản & milestone
                    </label>
                    <textarea
                      id="so-payment-terms"
                      value={form.paymentTerms}
                      onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                      rows={5}
                      className={`${inp} min-h-[8rem] resize-y`}
                      placeholder={`Ví dụ:\n• 80% sau giao hàng & nghiệm thu\n• Net 30 từ ngày hóa đơn\n• Milestone: 40% mid — 40% FAT`}
                    />
                    <p className="mt-2 text-xs text-slate-500">Cấu trúc tổng thể cho Finance và đàm phán NCC.</p>
                  </div>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            tone="indigo"
            step="Bước 5"
            title="Mô tả dự án"
            description="Tóm tắt phạm vi để các team nắm ngữ cảnh nhanh."
            icon={AlignLeft}
          >
            <textarea
              value={form.projectDescription}
              onChange={(e) => setForm((f) => ({ ...f, projectDescription: e.target.value }))}
              rows={4}
              className={`${inp} resize-y`}
              placeholder="VD: Triển khai hệ thống camera an ninh cho nhà máy…"
            />
          </FormSection>

          <FormSection
            tone="stone"
            step="Tuỳ chọn"
            title="Ghi chú nội bộ"
            description="Chỉ hiển thị nội bộ, không bắt buộc."
            icon={StickyNote}
          >
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className={`${inp} resize-y`}
              placeholder="Ghi chú cho nội bộ…"
            />
          </FormSection>

          {/* Action bar — nền glass + viền ấm đồng bộ Sales */}
          <div className="flex flex-col-reverse gap-3 rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-50/50 via-white to-orange-50/40 p-4 shadow-[0_8px_30px_-12px_rgba(217,119,6,0.2)] backdrop-blur-sm ring-1 ring-amber-900/[0.04] sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:px-6 sm:py-5">
            <p className="text-center text-xs text-slate-500 sm:text-left">
              {canSubmit ? 'Sẵn sàng tạo SO ở trạng thái Running.' : 'Cần: khách hàng, tên dự án và giá trị hợp đồng > 0.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/dashboard/sales/orders')}
                className="h-10 min-w-[7rem] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-10 min-w-[10rem] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {createPOMutation.isPending ? 'Đang tạo…' : 'Tạo SO (Running)'}
              </button>
            </div>
          </div>
        </form>

        <AppModal
          open={modalNewCustomer}
          onClose={() => {
            setModalNewCustomer(false);
            createCustomerMutation.reset();
          }}
          title="Tạo khách hàng mới"
          subtitle="Thêm vào danh mục để gắn vào Sales Order. Chỉ tên là bắt buộc."
          headerIcon={<Building2 className="h-5 w-5" strokeWidth={2} />}
          description="Form tạo khách hàng mới để gắn vào Sales Order"
          size="lg"
          className="shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.04]"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalNewCustomer(false);
                  createCustomerMutation.reset();
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => newCustomer.name.trim() && createCustomerMutation.mutate(newCustomer)}
                disabled={!newCustomer.name.trim() || createCustomerMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createCustomerMutation.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Đang tạo…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 opacity-90" strokeWidth={2} />
                    Tạo khách hàng
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-8">
            {createCustomerMutation.isError ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm text-rose-900"
              >
                <p className="font-medium">Không tạo được khách hàng</p>
                <p className="mt-1 text-rose-800/90">
                  {createCustomerMutation.error instanceof Error
                    ? createCustomerMutation.error.message
                    : 'Vui lòng thử lại hoặc kiểm tra kết nối.'}
                </p>
              </div>
            ) : null}

            <section aria-labelledby="new-customer-company">
              <div
                id="new-customer-company"
                className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                Doanh nghiệp
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="nc-name" className={fieldLabelClass}>
                    Tên khách hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="nc-name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="Ví dụ: Công ty TNHH ABC"
                    autoComplete="organization"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="nc-code" className={fieldLabelClass}>
                    <span className="inline-flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-slate-400" strokeWidth={2} />
                      Mã khách hàng
                    </span>
                  </label>
                  <input
                    id="nc-code"
                    value={newCustomer.code}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, code: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="VD: CUST-001"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="nc-tax" className={fieldLabelClass}>
                    <span className="inline-flex items-center gap-1.5">
                      <Landmark className="h-3 w-3 text-slate-400" strokeWidth={2} />
                      Mã số thuế
                    </span>
                  </label>
                  <input
                    id="nc-tax"
                    value={newCustomer.taxCode}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, taxCode: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="Nếu có"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="nc-address" className={fieldLabelClass}>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-slate-400" strokeWidth={2} />
                      Địa chỉ
                    </span>
                  </label>
                  <input
                    id="nc-address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, address: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="Địa chỉ trụ sở / giao dịch"
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            <section aria-labelledby="new-customer-contact">
              <div
                id="new-customer-contact"
                className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                Liên hệ
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="nc-contact" className={fieldLabelClass}>
                    Người liên hệ
                  </label>
                  <input
                    id="nc-contact"
                    value={newCustomer.contactPerson}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, contactPerson: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="Họ và tên"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="nc-phone" className={fieldLabelClass}>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-400" strokeWidth={2} />
                      Điện thoại
                    </span>
                  </label>
                  <input
                    id="nc-phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="+84 …"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label htmlFor="nc-email" className={fieldLabelClass}>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-slate-400" strokeWidth={2} />
                      Email
                    </span>
                  </label>
                  <input
                    id="nc-email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                    className={fieldInputClass}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>
          </div>
        </AppModal>
      </div>
    </div>
  );
};

export default CreateCustomerPO;
