import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { useCurrentUser } from '../../hooks/useAuth';
import { ArrowLeft, CheckCircle2, FileUp, Plus, Save, Send, Sparkles, Trash2, User, DollarSign, TrendingUp } from 'lucide-react';

const createPRSchema = z.object({
  department: z.string().min(1, 'Vui lòng chọn Phòng ban'),
  type: z.enum(['COMMERCIAL', 'PRODUCTION']).default('PRODUCTION'),
  requiredDate: z.string().optional(),
  currency: z.string().default('VND'),
  tax: z.number().min(0, 'Thuế không được âm').optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Mô tả là bắt buộc'),
        partNo: z.string().optional(),
        spec: z.string().optional(),
        manufacturer: z.string().optional(),
        qty: z.number().positive('Số lượng phải lớn hơn 0'),
        unit: z.string().optional(),
        unitPrice: z.number().min(0, 'Đơn giá không được âm'),
        purpose: z.string().optional(),
        remark: z.string().optional(),
      })
    )
    .min(1, 'Cần ít nhất 1 dòng vật tư/dịch vụ'),
  notes: z.string().optional(),
});

type CreatePRForm = z.infer<typeof createPRSchema>;

const CreatePR = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [attachments, setAttachments] = useState<File[]>([]);

  // Determine back route based on current pathname
  const getBackRoute = () => {
    if (location.pathname.includes('/department-head')) {
      return '/dashboard/department-head/my-prs';
    }
    return '/dashboard/requestor/pr';
  };

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<CreatePRForm>({
    resolver: zodResolver(createPRSchema),
    mode: 'onChange', // Enable real-time validation and updates
    defaultValues: {
      currency: 'VND',
      type: 'PRODUCTION',
      items: [
        {
          description: '',
          partNo: '',
          spec: '',
          manufacturer: '',
          qty: 1,
          unit: '',
          unitPrice: 0,
          purpose: '',
          remark: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const department = watch('department');
  // Use useWatch for reactive updates - triggers re-render on every change
  const items = useWatch({ control, name: 'items' }) || [];
  const currency = watch('currency');
  const tax = watch('tax') || 0;

  // Calculate amounts for each item - real-time calculation
  // This will recalculate whenever items array changes
  const itemsWithAmounts = useMemo(() => {
    return items.map((item: any, idx: number) => {
      const qty = Number(item?.qty) || 0;
      const unitPrice = Number(item?.unitPrice) || 0;
      const amount = qty * unitPrice;
      return {
        ...item,
        amount,
      };
    });
  }, [items]);

  // Calculate totals - will update when itemsWithAmounts changes
  const totalItemsAmount = useMemo(() => {
    return itemsWithAmounts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [itemsWithAmounts]);

  const totalPRAmount = useMemo(() => {
    const taxPercent = Number(tax) || 0;
    const taxAmount = totalItemsAmount * (taxPercent / 100);
    return totalItemsAmount + taxAmount;
  }, [totalItemsAmount, tax]);

  // Handle real-time calculation when qty or unitPrice changes
  const handleItemChange = (index: number, field: 'qty' | 'unitPrice', value: number) => {
    const numValue = Number(value) || 0;
    // Update only the specific field, don't touch the whole array
    setValue(`items.${index}.${field}` as any, numValue, { 
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    // watch('items') will automatically pick up the change and trigger re-calculation
    // No need to force update the whole array
  };

  const { data: prNoPreview, isFetching: isFetchingPRNo } = useQuery({
    queryKey: ['requestor-next-pr-number', department],
    queryFn: () => requestorService.getNextPRNumber(department),
    enabled: !!department?.trim(),
    staleTime: 30_000,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePRForm & { action: 'SAVE' | 'SUBMIT' }) =>
      requestorService.createPR({
        department: payload.department,
        type: payload.type,
        requiredDate: payload.requiredDate,
        currency: payload.currency,
        tax: payload.tax,
        notes: payload.notes,
        items: itemsWithAmounts.map((item) => ({
          description: item.description,
          partNo: item.partNo,
          spec: item.spec,
          manufacturer: item.manufacturer,
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          purpose: item.purpose,
          remark: item.remark,
        })),
        action: payload.action,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requestor-prs'] });
      queryClient.invalidateQueries({ queryKey: ['requestor-dashboard'] });
      navigate(getBackRoute());
    },
  });

  const onSaveDraft = handleSubmit((data) => {
    createMutation.mutate({ ...data, action: 'SAVE' });
  });

  const onSubmitPR = handleSubmit((data) => {
    createMutation.mutate({ ...data, action: 'SUBMIT' });
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pb-24">
      <div className="p-6 space-y-6 animate-fade-in max-w-[98%] mx-auto">
        {/* Back Button */}
        <div className="flex items-center gap-4 animate-slide-up">
          <button
            onClick={() => navigate(getBackRoute())}
            className="p-2.5 text-slate-600 hover:bg-white/80 rounded-xl transition-all shadow-sm hover:shadow-md border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <span className="text-sm text-slate-500 font-normal">Quay lại danh sách PR</span>
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
                PURCHASE REQUISITION
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                Phiếu Yêu Cầu Mua Vật Tư
              </div>
            </div>
          </div>

          {/* SECTION 1 – GENERAL INFORMATION */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
                <User className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thông tin chung</h2>
                <p className="text-xs text-slate-500">Thông tin cơ bản của yêu cầu mua hàng</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Người yêu cầu</label>
                <input
                  value={currentUser?.fullName || currentUser?.username || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                />
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Phòng ban <span className="text-rose-500">*</span>
                </label>
                <select
                  {...register('department')}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                    errors.department ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  <option value="SALES">Sales</option>
                  <option value="ENGINEERING">Engineering</option>
                  <option value="QS">QS</option>
                  <option value="SITE">Site</option>
                  <option value="ADMIN">Admin</option>
                  <option value="IT">IT</option>
                  <option value="OTHER">Other</option>
                </select>
                {errors.department && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.department.message}</p>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Loại PR <span className="text-rose-500">*</span>
                </label>
                <select
                  {...register('type')}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                    errors.type ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <option value="PRODUCTION">Sản xuất</option>
                  <option value="COMMERCIAL">Thương mại</option>
                </select>
                {errors.type && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.type.message}</p>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ngày</label>
                <input
                  value={new Date().toLocaleDateString('vi-VN')}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                />
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ngày dự kiến nhận hàng</label>
                <input
                  type="date"
                  {...register('requiredDate')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số PR</label>
                <div className="relative">
                  <input
                    value={department?.trim() ? (prNoPreview?.prNumber || (isFetchingPRNo ? 'Đang tạo số PR...' : '')) : ''}
                    readOnly
                    placeholder="Chọn Phòng ban để tạo số PR"
                    className="w-full px-4 py-3 border border-dashed border-indigo-300 rounded-xl bg-gradient-to-r from-indigo-50/50 to-blue-50/50 text-indigo-700 font-bold text-lg placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {prNoPreview?.prNumber && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 – MATERIAL / SERVICE DETAILS (CORE) */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden">
            <div className="p-6 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-md">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Chi tiết vật tư / dịch vụ</h2>
                  <p className="text-xs text-slate-500">Chi tiết vật tư / dịch vụ cần mua</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  append({
                    description: '',
                    partNo: '',
                    spec: '',
                    manufacturer: '',
                    qty: 1,
                    unit: '',
                    unitPrice: 0,
                    purpose: '',
                    remark: '',
                  })
                }
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Thêm dòng
              </button>
            </div>

            {errors.items && typeof errors.items.message === 'string' && (
              <div className="px-6 py-3 bg-rose-50 border-b border-rose-200">
                <p className="text-sm text-rose-600 font-medium">{errors.items.message}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                  <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-4 text-left w-14">STT</th>
                    <th className="px-4 py-4 text-left">Part Number</th>
                    <th className="px-4 py-4 text-left">Name <span className="text-rose-500">*</span></th>
                    <th className="px-4 py-4 text-left">Spec</th>
                    <th className="px-4 py-4 text-left">Manufacturer</th>
                    <th className="px-4 py-4 text-left w-24">Qty <span className="text-rose-500">*</span></th>
                    <th className="px-4 py-4 text-left w-24">Unit</th>
                    <th className="px-4 py-4 text-left w-32">Unit Price <span className="text-rose-500">*</span></th>
                    <th className="px-4 py-4 text-left w-32">Amount</th>
                    <th className="px-4 py-4 text-left">Remark</th>
                    <th className="px-4 py-4 text-right w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fields.map((row, idx) => {
                    const item = itemsWithAmounts[idx];
                    return (
                      <tr key={row.id} className="hover:bg-violet-50/30 transition-colors align-top group">
                        <td className="px-4 py-4">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-sm font-bold text-violet-700">
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.partNo` as const)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                            placeholder="Part Number"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.description` as const)}
                            className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all ${
                              errors.items?.[idx]?.description ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                            placeholder="Tên vật tư/dịch vụ"
                          />
                          {errors.items?.[idx]?.description && (
                            <p className="text-xs text-rose-500 mt-1">
                              {errors.items[idx]?.description?.message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.spec` as const)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                            placeholder="Thông số kỹ thuật"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.manufacturer` as const)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                            placeholder="Nhà sản xuất"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            {...register(`items.${idx}.qty` as const, { valueAsNumber: true })}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              handleItemChange(idx, 'qty', value);
                            }}
                            className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all ${
                              errors.items?.[idx]?.qty ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          />
                          {errors.items?.[idx]?.qty && (
                            <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.qty?.message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.unit` as const)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                            placeholder="Đơn vị"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            {...register(`items.${idx}.unitPrice` as const, { valueAsNumber: true })}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              handleItemChange(idx, 'unitPrice', value);
                            }}
                            className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all ${
                              errors.items?.[idx]?.unitPrice ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                            placeholder="0"
                          />
                          {errors.items?.[idx]?.unitPrice && (
                            <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.unitPrice?.message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={item?.amount?.toLocaleString('vi-VN') || '0'}
                            readOnly
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50/80 text-slate-700 font-semibold"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            {...register(`items.${idx}.remark` as const)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                            placeholder="Ghi chú"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => (fields.length > 1 ? remove(idx) : null)}
                            className={`p-2 rounded-lg transition-all ${
                              fields.length > 1
                                ? 'text-rose-500 hover:bg-rose-100 hover:text-rose-600 opacity-0 group-hover:opacity-100'
                                : 'text-slate-200 cursor-not-allowed'
                            }`}
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3 – PR SUMMARY (TỔNG HỢP CHI PHÍ) */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-green-50/60 rounded-2xl shadow-lg border-2 border-emerald-200/70 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
                <DollarSign className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tổng hợp chi phí PR</h2>
                <p className="text-xs text-slate-500">Giúp GĐ Chi nhánh duyệt nhanh - Buyer Leader dễ đánh giá</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Total Items Amount (auto)</label>
                <input
                  value={totalItemsAmount.toLocaleString('vi-VN')}
                  readOnly
                  className="w-full px-4 py-3.5 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50 text-emerald-900 font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Currency</label>
                <select
                  {...register('currency')}
                  className="w-full px-4 py-3.5 border-2 border-emerald-300 rounded-xl bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium transition-all"
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">VAT (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('tax', { valueAsNumber: true })}
                  className="w-full px-4 py-3.5 border-2 border-emerald-300 rounded-xl bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium transition-all"
                  placeholder="%"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Total PR Amount (auto)</label>
                <input
                  value={totalPRAmount.toLocaleString('vi-VN')}
                  readOnly
                  className="w-full px-4 py-3.5 border-2 border-dashed border-emerald-400 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900 font-bold text-lg"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4 – NOTES & ATTACHMENTS */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl text-white shadow-md">
                <FileUp className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ghi chú & Tệp đính kèm</h2>
                <p className="text-xs text-slate-500">Thông tin bổ sung và tài liệu đính kèm</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ghi chú</label>
              <textarea
                {...register('notes')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
                placeholder="Thông tin bổ sung (bản vẽ, spec, bối cảnh, báo giá sơ bộ, link tham khảo...)"
              />
              <p className="text-xs text-slate-400 mt-1.5">💡 Giá Requestor nhập là ước tính / đề xuất, Buyer vẫn có quyền thương lượng sau.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tệp đính kèm</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 px-5 py-3 border-2 border-dashed border-sky-300 bg-sky-50/50 rounded-xl hover:bg-sky-100/50 hover:border-sky-400 cursor-pointer transition-all">
                  <FileUp className="w-5 h-5 text-sky-600" strokeWidth={2} />
                  <span className="text-sm font-medium text-sky-700">Chọn file đính kèm</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachments(files);
                    }}
                  />
                </label>
                <div className="text-sm text-slate-500 font-medium">
                  {attachments.length > 0 ? (
                    <span className="text-sky-600">{attachments.length} file đã chọn</span>
                  ) : (
                    'Chưa có file'
                  )}
                </div>
              </div>
              {attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((f) => (
                    <div key={f.name} className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium">
                      <FileUp className="w-3.5 h-3.5" />
                      {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5 – APPROVAL FLOW */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl text-white">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Quy trình duyệt</h2>
                <p className="text-xs text-slate-400">GĐ Chi nhánh duyệt dựa trên: Tổng tiền PR & Mục đích mua</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">1</div>
                <div className="text-sm font-semibold text-white mt-2">Người yêu cầu</div>
                <div className="text-xs text-slate-400 mt-1">Tạo PR & Gửi duyệt</div>
              </div>
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">2</div>
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-white/20 hidden md:block"></div>
                <div className="text-sm font-semibold text-white mt-2">Giám đốc Chi nhánh</div>
                <div className="text-xs text-slate-400 mt-1">Duyệt / Trả bổ sung</div>
              </div>
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">3</div>
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-white/20 hidden md:block"></div>
                <div className="text-sm font-semibold text-white mt-2">Người mua</div>
                <div className="text-xs text-slate-400 mt-1">Xử lý mua (Giai đoạn sau)</div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 6 – ACTION BAR (STICKY FOOTER) */}
      <div className="fixed bottom-0 left-[240px] right-0 z-50 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-4">
        <div className="mx-auto max-w-[98%] px-6 pb-5">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
              <div className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">Draft</span>
                <span className="mx-2 text-slate-300">•</span>
                Lưu nháp hoặc gửi duyệt
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(getBackRoute())}
                className="px-5 py-2.5 text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending ? 'Đang lưu...' : 'Lưu nháp'}
              </button>
              <button
                type="button"
                onClick={onSubmitPR}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Send className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending ? 'Đang gửi...' : 'Gửi duyệt'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePR;
