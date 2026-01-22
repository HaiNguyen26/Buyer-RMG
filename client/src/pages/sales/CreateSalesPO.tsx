import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { useCurrentUser } from '../../hooks/useAuth';
import { ArrowLeft, Building2, CheckCircle2, Save, Send, Sparkles, User, FolderKanban, DollarSign, FileText, TrendingUp, X } from 'lucide-react';

const createSalesPOSchema = z.object({
  customerId: z.string().uuid('Vui lòng chọn khách hàng'),
  projectName: z.string().min(1, 'Tên dự án là bắt buộc'),
  customerPONumber: z.string().optional(),
  expectedDeliveryPeriod: z.string().optional(),
  totalPOValue: z.number().positive('Giá trị PO phải lớn hơn 0'),
  tax: z.number().min(0, 'Thuế không được âm').optional(),
  poDescription: z.string().optional(),
  internalNotes: z.string().optional(),
  currency: z.string().min(1, 'Vui lòng chọn tiền tệ'),
  department: z.string().optional(),
});

type CreateSalesPOForm = z.infer<typeof createSalesPOSchema>;

const CreateSalesPO = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [action, setAction] = useState<'SAVE_DRAFT' | 'ACTIVATE'>('SAVE_DRAFT');

  // Get customers
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) return { customers: [] };
      return response.json();
    },
  });

  // Get next Sales PO number preview
  const { data: poNoPreview, isFetching: isFetchingPONo } = useQuery({
    queryKey: ['sales-next-po-number'],
    queryFn: () => salesService.getNextSalesPONumber(),
    staleTime: 30_000,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateSalesPOForm>({
    resolver: zodResolver(createSalesPOSchema),
    defaultValues: {
      currency: 'VND',
      department: 'SALES',
    },
  });

  const totalPOValue = watch('totalPOValue') || 0;
  const tax = watch('tax') || 0;
  const totalValueAfterTax = useMemo(() => {
    return totalPOValue + (totalPOValue * tax / 100);
  }, [totalPOValue, tax]);

  const createMutation = useMutation({
    mutationFn: (data: CreateSalesPOForm & { action: 'SAVE_DRAFT' | 'ACTIVATE' }) =>
      salesService.createSalesPO({
        salesPONumber: poNoPreview?.salesPONumber || '',
        customerId: data.customerId,
        projectName: data.projectName,
        projectCode: data.customerPONumber,
        amount: data.totalPOValue,
        currency: data.currency,
        effectiveDate: new Date().toISOString(),
        notes: data.internalNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pos'] });
      queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
      navigate('/dashboard/sales/sales-pos');
    },
  });

  const onSaveDraft = handleSubmit((data) => {
    createMutation.mutate({ ...data, action: 'SAVE_DRAFT' });
  });

  const onActivate = handleSubmit((data) => {
    createMutation.mutate({ ...data, action: 'ACTIVATE' });
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pb-24">
      <div className="p-6 space-y-6 animate-fade-in max-w-[98%] mx-auto">
        {/* Back Button */}
        <div className="flex items-center gap-4 animate-slide-up">
          <button
            onClick={() => navigate('/dashboard/sales/sales-pos')}
            className="p-2.5 text-slate-600 hover:bg-white/80 rounded-xl transition-all shadow-sm hover:shadow-md border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <span className="text-sm text-slate-500 font-normal">Quay lại danh sách Sales PO</span>
        </div>

        <form className="space-y-6">
          {/* SECTION 1 – HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 rounded-2xl shadow-xl p-5 text-center
                          before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] before:from-emerald-500/10 before:via-transparent before:to-transparent before:opacity-70
                          after:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] after:from-cyan-500/10 after:via-transparent after:to-transparent after:opacity-70">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
            <div className="relative border border-slate-600/30 rounded-xl p-3 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/30 rounded-full text-emerald-200 text-[10px] font-medium tracking-wider uppercase mb-2 shadow-inner">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Official Document
              </div>
              <div className="text-sm font-semibold text-slate-200 tracking-wide">
                RMG TECHNOLOGIES VIETNAM CO., LTD
              </div>
              <div className="mt-1 text-xl font-bold text-white drop-shadow-sm">
                SALES PURCHASE ORDER
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                PO Khách Hàng / Dự Án
              </div>
            </div>
          </div>

          {/* SECTION 2 – GENERAL INFORMATION */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
                <User className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thông tin chung</h2>
                <p className="text-xs text-slate-500">Xác định PO khách & người chịu trách nhiệm</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột trái */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Sales PO No <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={poNoPreview?.salesPONumber || (isFetchingPONo ? 'Đang tạo số PO...' : '')}
                      readOnly
                      placeholder="Đang tạo số PO..."
                      className="w-full px-4 py-3 border border-dashed border-indigo-300 rounded-xl bg-gradient-to-r from-indigo-50/50 to-blue-50/50 text-indigo-700 font-bold text-lg placeholder:text-slate-400 placeholder:font-normal"
                    />
                    {poNoPreview?.salesPONumber && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Salesperson</label>
                  <input
                    value={currentUser?.fullName || currentUser?.username || ''}
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Department (Sales)</label>
                  <select
                    {...register('department')}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="SALES">Sales</option>
                  </select>
                </div>
              </div>

              {/* Cột phải */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input
                    value={new Date().toLocaleDateString('vi-VN')}
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Currency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...register('currency')}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                      errors.currency ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="JPY">JPY</option>
                  </select>
                  {errors.currency && (
                    <p className="text-sm text-red-500 mt-1">{errors.currency.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">PO Status</label>
                  <input
                    value="Draft"
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3 – CUSTOMER & PROJECT INFORMATION */}
          <div className="relative bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50/60 rounded-2xl shadow-lg border-2 border-amber-200/70 p-6 space-y-5 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            
            <div className="flex items-center gap-3 relative">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-md">
                <Building2 className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thông tin Khách hàng & Dự án</h2>
                <p className="text-xs text-slate-500">Gắn khách hàng + dự án để PR dùng lại</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  {...register('customerId')}
                  className={`w-full px-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition-all ${
                    errors.customerId ? 'border-rose-400 bg-rose-50/50' : 'border-amber-300 bg-white hover:border-amber-400'
                  }`}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customersData?.customers?.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.code ? `(${customer.code})` : ''}
                    </option>
                  ))}
                </select>
                {errors.customerId && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.customerId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                  Project / Order Name <span className="text-rose-500">*</span>
                </label>
                <input
                  {...register('projectName')}
                  className={`w-full px-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition-all ${
                    errors.projectName ? 'border-rose-400 bg-rose-50/50' : 'border-amber-300 bg-white hover:border-amber-400'
                  }`}
                  placeholder="Tên dự án / đơn hàng"
                />
                {errors.projectName && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.projectName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Customer PO No (optional)</label>
                <input
                  {...register('customerPONumber')}
                  className="w-full px-4 py-3.5 border-2 border-amber-300 rounded-xl bg-white hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition-all"
                  placeholder="Số PO của khách hàng"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Expected Delivery Period (optional)</label>
                <input
                  type="date"
                  {...register('expectedDeliveryPeriod')}
                  className="w-full px-4 py-3.5 border-2 border-amber-300 rounded-xl bg-white hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4 – PO VALUE (NGUỒN KINH PHÍ) */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-green-50/60 rounded-2xl shadow-lg border-2 border-emerald-200/70 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
                <DollarSign className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">PO Value (Nguồn kinh phí)</h2>
                <p className="text-xs text-slate-500">Đây là NGÂN SÁCH GỐC - PR cộng dồn chi phí mua sau khi thanh toán DONE</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                  Total PO Value <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('totalPOValue', { valueAsNumber: true })}
                  className={`w-full px-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium transition-all ${
                    errors.totalPOValue ? 'border-rose-400 bg-rose-50/50' : 'border-emerald-300 bg-white hover:border-emerald-400'
                  }`}
                  placeholder="0"
                />
                {errors.totalPOValue && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.totalPOValue.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Tax (VAT) (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('tax', { valueAsNumber: true })}
                  className="w-full px-4 py-3.5 border-2 border-emerald-300 rounded-xl bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium transition-all"
                  placeholder="%"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Total Value After Tax (auto)</label>
                <input
                  value={totalValueAfterTax.toLocaleString('vi-VN')}
                  readOnly
                  className="w-full px-4 py-3.5 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50 text-emerald-900 font-bold"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5 – SUMMARY & NOTES */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl text-white shadow-md">
                <FileText className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tóm tắt & Ghi chú</h2>
                <p className="text-xs text-slate-500">Mô tả nhanh PO</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">PO Description / Scope</label>
              <textarea
                {...register('poDescription')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
                placeholder="Mô tả phạm vi dự án / đơn hàng"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Internal Notes (Sales & BGĐ)</label>
              <textarea
                {...register('internalNotes')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
                placeholder="Ghi chú nội bộ (chỉ Sales & BGĐ xem)"
              />
            </div>
          </div>

          {/* SECTION 6 – PO USAGE SUMMARY (READ-ONLY) */}
          <div className="bg-gradient-to-br from-violet-50 via-purple-50/50 to-indigo-50/60 rounded-2xl shadow-lg border-2 border-violet-200/70 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-md">
                <TrendingUp className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">PO Usage Summary (Read-only)</h2>
                <p className="text-xs text-slate-500">Hiển thị sau khi có PR phát sinh - Sales & BGĐ dùng để theo dõi vượt / thiếu ngân sách</p>
              </div>
            </div>

            <div className="bg-white/90 rounded-xl border border-violet-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-violet-100 to-purple-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Nội dung</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-100">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">Total PR Amount (Done)</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">0</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">Remaining Budget</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">{totalValueAfterTax.toLocaleString('vi-VN')}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">% Used</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 7 – ACTION BAR (STICKY FOOTER) */}
      <div className="fixed bottom-0 left-[240px] right-0 z-50 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-4">
        <div className="mx-auto max-w-[98%] px-6 pb-5">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
              <div className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">Draft</span>
                <span className="mx-2 text-slate-300">•</span>
                Lưu nháp hoặc kích hoạt PO
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/sales/sales-pos')}
                className="px-5 py-2.5 text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all font-medium"
              >
                <X className="w-4 h-4 inline mr-2" strokeWidth={2} />
                Hủy
              </button>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending ? 'Đang lưu...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={onActivate}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Send className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending ? 'Đang kích hoạt...' : 'Activate PO'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSalesPO;
