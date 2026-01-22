import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { salesService } from '../../services/salesService';
import { ArrowLeft, Save, X } from 'lucide-react';

const updateSalesPOSchema = z.object({
  salesPONumber: z.string().min(1, 'Số Sales PO là bắt buộc'),
  customerId: z.string().uuid('Vui lòng chọn khách hàng'),
  projectName: z.string().optional(),
  projectCode: z.string().optional(),
  amount: z.number().positive('Giá trị PO phải lớn hơn 0'),
  currency: z.string().default('VND'),
  effectiveDate: z.string().min(1, 'Ngày hiệu lực là bắt buộc'),
  notes: z.string().optional(),
});

type UpdateSalesPOForm = z.infer<typeof updateSalesPOSchema>;

const EditSalesPO = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mock customers
  const customers = [
    { id: '1', name: 'Công ty A', code: 'CUST-001' },
    { id: '2', name: 'Công ty B', code: 'CUST-002' },
    { id: '3', name: 'Công ty C', code: 'CUST-003' },
  ];

  const { data: salesPO, isLoading } = useQuery({
    queryKey: ['sales-po', id],
    queryFn: () => salesService.getSalesPOById(id!),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateSalesPOForm>({
    resolver: zodResolver(updateSalesPOSchema),
  });

  useEffect(() => {
    if (salesPO) {
      reset({
        salesPONumber: salesPO.salesPONumber,
        customerId: salesPO.customer.id,
        projectName: salesPO.projectName || '',
        projectCode: salesPO.projectCode || '',
        amount: salesPO.amount,
        currency: salesPO.currency,
        effectiveDate: new Date(salesPO.effectiveDate).toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [salesPO, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSalesPOForm) => salesService.updateSalesPO(id!, {
      ...data,
      effectiveDate: new Date(data.effectiveDate).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pos'] });
      queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
      navigate('/dashboard/sales/sales-pos');
    },
  });

  const onSubmit = (data: UpdateSalesPOForm) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!salesPO) {
    return (
      <div className="p-6">
        <p className="text-slate-600 font-normal">Không tìm thấy Sales PO</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-up">
        <button
          onClick={() => navigate('/dashboard/sales/sales-pos')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-soft transition-colors"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chỉnh sửa Sales PO</h1>
          <p className="text-slate-600 mt-1 font-normal">Cập nhật thông tin Sales Purchase Order</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-soft shadow-soft border border-slate-200 p-6 animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sales PO Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Số Sales PO <span className="text-red-500">*</span>
            </label>
            <input
              {...register('salesPONumber')}
              type="text"
              className={`w-full px-4 py-2 border rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal ${
                errors.salesPONumber ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {errors.salesPONumber && (
              <p className="mt-1 text-sm text-red-600 font-normal">{errors.salesPONumber.message}</p>
            )}
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Khách hàng <span className="text-red-500">*</span>
            </label>
            <select
              {...register('customerId')}
              className={`w-full px-4 py-2 border rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal ${
                errors.customerId ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Chọn khách hàng</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.code})
                </option>
              ))}
            </select>
            {errors.customerId && (
              <p className="mt-1 text-sm text-red-600 font-normal">{errors.customerId.message}</p>
            )}
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tên dự án</label>
            <input
              {...register('projectName')}
              type="text"
              className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal"
            />
          </div>

          {/* Project Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mã dự án</label>
            <input
              {...register('projectCode')}
              type="text"
              className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Giá trị PO <span className="text-red-500">*</span>
            </label>
            <input
              {...register('amount', { valueAsNumber: true })}
              type="number"
              step="0.01"
              className={`w-full px-4 py-2 border rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal ${
                errors.amount ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 font-normal">{errors.amount.message}</p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tiền tệ</label>
            <select
              {...register('currency')}
              className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal"
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ngày hiệu lực <span className="text-red-500">*</span>
            </label>
            <input
              {...register('effectiveDate')}
              type="date"
              className={`w-full px-4 py-2 border rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal ${
                errors.effectiveDate ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {errors.effectiveDate && (
              <p className="mt-1 text-sm text-red-600 font-normal">{errors.effectiveDate.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú</label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/dashboard/sales/sales-pos')}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-soft hover:bg-slate-50 transition-colors font-medium"
          >
            <X className="w-4 h-4 inline mr-2" strokeWidth={2} />
            Hủy
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-6 py-2 bg-[#3B82F6] text-white rounded-soft hover:bg-[#2563EB] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 inline mr-2" strokeWidth={2} />
            {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditSalesPO;




