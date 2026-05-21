import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  X, Upload, FileText, Building2, Calendar, 
  Clock, Package, Save, AlertCircle, CheckCircle2, Trash2 
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import axios from 'axios';
import { useToast } from '../../contexts/ToastContext';
import { PAYMENT_TERMS_PERCENT_OPTIONS, WARRANTY_MONTHS_OPTIONS, LEAD_TIME_DAYS_OPTIONS } from '../../constants/quotationEvaluation';
import {
  validateQuotationCommercialFields,
  isQuotationCommercialComplete,
} from '../../utils/quotationCommercialValidation';
import CustomSelect from '../../components/CustomSelect';
import { buyerOutletPageShellClass, buyerOutletCenterMinHeightClass } from '../../constants/buyerLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatCurrency = (amount: number | null, currency: string = 'VND') => {
  if (!amount) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
};

interface QuotationItem {
  purchaseRequestItemId?: string;
  lineNo: number;
  description: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  notes?: string;
}

const CreateQuotation = () => {
  const { prId } = useParams<{ prId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState('');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [leadTime, setLeadTime] = useState<string>('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [warranty, setWarranty] = useState('');
  const [riskNotes, setRiskNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdQuotationCount, setCreatedQuotationCount] = useState(0);
  const [currentRFQId, setCurrentRFQId] = useState<string | null>(null);
  const [currentRFQNumber, setCurrentRFQNumber] = useState<string | null>(null);

  // Get PR Details
  const { data: prDetails, isLoading: isLoadingPR } = useQuery({
    queryKey: ['buyer-pr-details', prId],
    queryFn: () => buyerService.getPRDetails(prId!),
    enabled: !!prId,
  });

  // Get Suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/suppliers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    },
  });

  const suppliers = suppliersData?.suppliers || [];

  // Initialize items from PR
  useEffect(() => {
    if (prDetails?.items && items.length === 0) {
      const quotationItems: QuotationItem[] = prDetails.items.map((item: any, index: number) => ({
        purchaseRequestItemId: item.id,
        lineNo: item.lineNo || index + 1,
        description: item.description,
        qty: Number(item.qty) || 0,
        unit: item.unit || '',
        unitPrice: Number(item.unitPrice) || 0,
        notes: '',
      }));
      setItems(quotationItems);
      // Select all items by default
      setSelectedItemIds(new Set(prDetails.items.map((item: any) => item.id)));
    }
  }, [prDetails, items.length]);

  // Filter items based on selection
  const selectedItems = items.filter(item => 
    item.purchaseRequestItemId && selectedItemIds.has(item.purchaseRequestItemId)
  );

  // Calculate total from selected items only
  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

  // Create Quotation Mutation
  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!prId) throw new Error('PR ID is required');
      
      // Only include selected items
      if (selectedItems.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 item');
      }

      const commercialErr = validateQuotationCommercialFields(leadTime, paymentTerms, warranty);
      if (commercialErr) throw new Error(commercialErr);

      const quotationData = {
        supplierId,
        quotationNumber: quotationNumber || undefined,
        totalAmount,
        currency: prDetails?.currency || 'VND',
        leadTime: Number(leadTime),
        deliveryTerms: deliveryTerms || undefined,
        paymentTerms: `${paymentTerms}%`,
        warranty: `${warranty} tháng`,
        riskNotes: riskNotes || undefined,
        validUntil: validUntil || undefined,
        items: selectedItems, // Only selected items
      };

      const result = await buyerService.createQuotationForPR(prId, quotationData);
      
      // Store RFQ info for display
      if (result.rfqId && result.rfqNumber) {
        setCurrentRFQId(result.rfqId);
        setCurrentRFQNumber(result.rfqNumber);
      }
      
      // Upload files if any - via RFQ ID (Phase 2)
      if (files.length > 0 && result.rfqId) {
        await buyerService.uploadQuotationAttachmentsByRFQ(result.rfqId, files, result.id);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-pr-details', prId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-assigned-prs'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      setCreatedQuotationCount(prev => prev + 1);
      setShowSuccessModal(true);
    },
  });

  const { showWarning, showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || selectedItems.length === 0) {
      showWarning('Vui lòng chọn NCC và ít nhất 1 item');
      return;
    }
    const commercialErr = validateQuotationCommercialFields(leadTime, paymentTerms, warranty);
    if (commercialErr) {
      showWarning(commercialErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await createQuotationMutation.mutateAsync();
    } catch (error: unknown) {
      console.error('Error creating quotation:', error);
      const msg =
        error instanceof Error
          ? error.message
          : axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
            ? error.response.data.error
            : 'Tạo báo giá thất bại.';
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setSupplierId('');
    setQuotationNumber('');
    setLeadTime('');
    setDeliveryTerms('');
    setPaymentTerms('');
    setWarranty('');
    setRiskNotes('');
    setValidUntil('');
    setFiles([]);
    // Keep items from PR (they don't change)
  };

  const handleContinue = () => {
    setShowSuccessModal(false);
    resetForm();
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinish = () => {
    setShowSuccessModal(false);
    navigate(`/dashboard/buyer/assigned-prs`);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (isLoadingPR) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center py-3 sm:py-4 md:py-5`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải thông tin PR...</p>
        </div>
      </div>
    );
  }

  if (!prDetails) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center py-3 sm:py-4 md:py-5`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Không tìm thấy PR</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${buyerOutletPageShellClass} py-3 animate-fade-in-right fade-in-right-delay-0 sm:py-4 md:py-5`}>
      <div className="w-full min-w-0 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 pr-10 sm:pr-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Nhập báo giá</h1>
            <p className="mt-1 text-sm text-slate-600">PR: {prDetails.prNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/buyer/assigned-prs')}
            className="absolute right-3 top-3 shrink-0 rounded-lg p-2 hover:bg-slate-200 transition-colors sm:static sm:right-auto sm:top-auto"
            aria-label="Đóng"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* PR Info Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Thông tin PR</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prDetails.requiredDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Deadline</p>
                  <p className="font-semibold text-slate-900">{formatDate(prDetails.requiredDate)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Số items</p>
                <p className="font-semibold text-slate-900">{prDetails.items?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quotation Form */}
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Thông tin báo giá</h2>

          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">-- Chọn NCC --</option>
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} {supplier.code ? `(${supplier.code})` : ''}
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* Quotation Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Số báo giá
              </label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Số báo giá từ NCC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lead time (ngày) <span className="text-red-600">*</span>
              </label>
              <CustomSelect
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LEAD_TIME_DAYS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                ))}
              </CustomSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Điều kiện thanh toán (%) <span className="text-red-600">*</span>
              </label>
              <CustomSelect
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PAYMENT_TERMS_PERCENT_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                ))}
              </CustomSelect>
              <p className="text-xs text-slate-500 mt-1">Tỷ lệ % làm tròn để hệ thống đánh giá NCC</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bảo hành (tháng) <span className="text-red-600">*</span>
              </label>
              <CustomSelect
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {WARRANTY_MONTHS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                ))}
              </CustomSelect>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Điều kiện giao hàng
            </label>
            <textarea
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Điều kiện giao hàng"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ghi chú rủi ro
            </label>
            <textarea
              value={riskNotes}
              onChange={(e) => setRiskNotes(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Ghi chú về rủi ro (nếu có)"
            />
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-slate-900">Chi tiết items</h3>
              {currentRFQNumber && (
                <div className="text-sm text-blue-600 font-medium">
                  RFQ đang sử dụng: <span className="font-bold">{currentRFQNumber}</span>
                </div>
              )}
            </div>
            <div className="mb-2 text-sm text-slate-600">
              💡 Chọn items để nhóm vào RFQ. Items khác nhau sẽ tự động tạo RFQ mới.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 w-12">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.size === items.length && items.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIds(new Set(items.map(item => item.purchaseRequestItemId!).filter(Boolean)));
                          } else {
                            setSelectedItemIds(new Set());
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">STT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Mô tả</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">SL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Đơn vị</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Đơn giá</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const isSelected = item.purchaseRequestItemId && selectedItemIds.has(item.purchaseRequestItemId);
                    return (
                      <tr 
                        key={index} 
                        className={`border-b border-slate-100 ${isSelected ? 'bg-blue-50/50' : 'bg-white'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected || false}
                            onChange={(e) => {
                              if (!item.purchaseRequestItemId) return;
                              const newSet = new Set(selectedItemIds);
                              if (e.target.checked) {
                                newSet.add(item.purchaseRequestItemId);
                              } else {
                                newSet.delete(item.purchaseRequestItemId);
                              }
                              setSelectedItemIds(newSet);
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">{item.lineNo}</td>
                        <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                          className="w-20 px-2 py-1 border border-slate-300 rounded"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-slate-300 rounded"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(item.qty * item.unitPrice, prDetails.currency)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                      Tổng cộng ({selectedItems.length} items):
                    </td>
                    <td className="px-4 py-3 font-bold text-lg">
                      {formatCurrency(totalAmount, prDetails.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Upload file báo giá (PDF/Excel/ảnh)
            </label>
            <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 sm:p-6">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">
                  Click để chọn file hoặc kéo thả file vào đây
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, Excel, hoặc ảnh (tối đa 10MB mỗi file)
                </p>
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 sm:flex-none">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="self-end rounded p-1 hover:bg-red-100 sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/buyer/assigned-prs')}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50 sm:w-auto sm:px-6"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !supplierId ||
                selectedItems.length === 0 ||
                !isQuotationCommercialComplete(leadTime, paymentTerms, warranty)
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto sm:px-6"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu báo giá
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal — render qua portal để phủ full màn hình, trên mọi layout */}
      {showSuccessModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4 modal-popup-overlay"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="modal-popup-panel bg-white rounded-xl shadow-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Đã lưu báo giá thành công!
              </h3>
              {currentRFQNumber && (
                <p className="text-blue-600 font-medium mb-2">
                  RFQ: {currentRFQNumber}
                </p>
              )}
              <p className="text-slate-600 mb-6">
                Bạn đã nhập {createdQuotationCount} báo giá cho RFQ này.
                {createdQuotationCount < 2 && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    💡 Khuyến nghị: Nhập 2-3 báo giá để so sánh tốt nhất
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleContinue}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Tiếp tục nhập báo giá
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                >
                  Hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CreateQuotation;
