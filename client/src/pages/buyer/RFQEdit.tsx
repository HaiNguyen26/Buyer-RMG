import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, X } from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { useToast } from '../../contexts/ToastContext';
import { stripRfqItemsTag, extractRfqItemsBlock } from '../../utils/rfqNotes';
import { buyerOutletPageShellClass } from '../../constants/buyerLayout';

const RFQEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [notes, setNotes] = useState('');
  const originalNotesRef = useRef<string>('');

  const { data: rfqData, isLoading, error } = useQuery({
    queryKey: ['buyer-rfq-detail', id],
    queryFn: () => buyerService.getRFQById(id!),
    enabled: !!id,
    retry: 1,
    onSuccess: (data) => {
      originalNotesRef.current = data.notes || '';
      setNotes(stripRfqItemsTag(data.notes) || '');
    },
  });

  const updateRFQMutation = useMutation({
    mutationFn: (data: { notes?: string }) => buyerService.updateRFQ(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      showSuccess('Đã cập nhật RFQ thành công');
      navigate(`/dashboard/buyer/rfq/${id}`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Lỗi khi cập nhật RFQ');
    },
  });

  const handleSave = () => {
    const rfqItemsBlock = extractRfqItemsBlock(originalNotesRef.current);
    const notesToSend = rfqItemsBlock
      ? `${notes.trim()}\n\n${rfqItemsBlock}`
      : notes.trim();
    updateRFQMutation.mutate({ notes: notesToSend || undefined });
  };

  if (isLoading) {
    return (
      <div className={`${buyerOutletPageShellClass} py-3 sm:py-4 md:py-5`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${buyerOutletPageShellClass} py-3 sm:py-4 md:py-5`}>
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-700">Lỗi khi tải chi tiết RFQ: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  if (!rfqData) {
    return (
      <div className={`${buyerOutletPageShellClass} py-3 sm:py-4 md:py-5`}>
        <div className="bg-slate-50 border border-slate-200 rounded-soft p-4">
          <p className="text-slate-700">Không tìm thấy RFQ</p>
        </div>
      </div>
    );
  }

  if (rfqData.status !== 'DRAFT') {
    return (
      <div className={`${buyerOutletPageShellClass} py-3 sm:py-4 md:py-5`}>
        <div className="w-full min-w-0">
          <div className="bg-yellow-50 border border-yellow-200 rounded-soft p-4">
            <p className="text-yellow-800">Chỉ có thể chỉnh sửa RFQ ở trạng thái DRAFT</p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/buyer/rfq/${id}`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-soft hover:bg-blue-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${buyerOutletPageShellClass} py-3 sm:py-4 md:py-5 animate-fade-in-right fade-in-right-delay-0`}>
      <div className="w-full min-w-0 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/buyer/rfq/${id}`)}
              className="shrink-0 rounded-soft p-2 text-slate-600 transition-colors hover:bg-slate-100"
              title="Quay lại"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Chỉnh sửa RFQ</h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{rfqData.rfqNumber}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-soft border border-slate-200 bg-white p-4 shadow-soft sm:p-5 md:p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Ghi chú
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-slate-200 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900"
                placeholder="Nhập ghi chú cho RFQ..."
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateRFQMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-soft bg-blue-600 px-4 py-2.5 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
              >
                <Save className="h-4 w-4" />
                <span>Lưu thay đổi</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/buyer/rfq/${id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-soft bg-slate-200 px-4 py-2.5 text-slate-700 transition-colors hover:bg-slate-300 sm:w-auto sm:px-6"
              >
                <X className="h-4 w-4" />
                <span>Hủy</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFQEdit;
