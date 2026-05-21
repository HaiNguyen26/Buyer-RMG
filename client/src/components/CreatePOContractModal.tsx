import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { downloadPoContractPdf } from '../utils/poContractPdf';

type PoLike = {
  poNumber: string;
  prCode?: string | null;
  rfqRef?: string | null;
  deliveryDate?: string | null;
  deliveryAddress?: string | null;
  incoterms?: string | null;
  paymentTerms?: string | null;
  totalAmount: number;
  currency?: string | null;
  supplier?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    taxCode?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    contactPerson?: string | null;
    email?: string | null;
  } | null;
  items?: Array<{
    lineNo: number;
    description?: string | null;
    model?: string | null;
    brand?: string | null;
    unit?: string | null;
    qty: number;
    unitPrice: number;
    amount: number;
    vatPercent?: number | null;
    expectedDeliveryDate?: string | null;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  po: PoLike;
};

const defaultToday = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export function CreatePOContractModal({ open, onClose, po }: Props) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contractNumber, setContractNumber] = useState(`25${new Date().getFullYear()}/LK-RMG/${new Date().getFullYear()}`);
  const [signedAt, setSignedAt] = useState(defaultToday());
  const [buyerRepresentative, setBuyerRepresentative] = useState('Ông. LÊ THANH TÙNG');
  const [buyerRepresentativeTitle, setBuyerRepresentativeTitle] = useState('Giám Đốc');
  const [sellerRepresentative, setSellerRepresentative] = useState('');
  const [sellerRepresentativeTitle, setSellerRepresentativeTitle] = useState('Giám đốc');
  const [buyerAddress, setBuyerAddress] = useState('159/59 Trần Văn Đang, Phường Nhiêu Lộc, TP Hồ Chí Minh, Việt Nam');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerTaxCode, setBuyerTaxCode] = useState('0305797333');
  const [paymentTerms, setPaymentTerms] = useState(po.paymentTerms?.trim() || '');

  useEffect(() => {
    if (open) {
      setPaymentTerms(po.paymentTerms?.trim() || '');
      setSellerRepresentative(po.supplier?.contactPerson?.trim() || '');
    }
  }, [open, po.paymentTerms, po.supplier?.contactPerson]);

  const canSubmit = useMemo(() => contractNumber.trim().length > 0 && signedAt.trim().length > 0, [contractNumber, signedAt]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-[1px] sm:p-6">
      <div className="flex max-h-[90vh] w-[min(1100px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[min(1100px,calc(100vw-3rem))]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">Tạo hợp đồng kinh tế</h3>
            <p className="text-xs text-slate-500 sm:text-sm">
              PO {po.poNumber}
              {po.prCode ? ` · PR ${po.prCode}` : ''}
              {po.rfqRef ? ` · RFQ ${po.rfqRef}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 sm:grid-cols-2 sm:p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Số hợp đồng</span>
            <input
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Ngày ký</span>
            <input
              value={signedAt}
              onChange={(e) => setSignedAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="dd/mm/yyyy"
            />
          </label>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 sm:col-span-2">
            <span className="font-semibold text-slate-700">Tham chiếu trên PDF: </span>
            PO {po.poNumber}
            {po.prCode ? ` · PR ${po.prCode}` : ''}
            {po.rfqRef ? ` · RFQ ${po.rfqRef}` : ''}
            {po.incoterms ? ` · Incoterms ${po.incoterms}` : ''}
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Điều khoản thanh toán (PDF Điều 5)</span>
            <input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="VD: Net 30 ngày sau hóa đơn · 50% tạm ứng · Thanh toán một lần sau giao hàng"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Đại diện Bên mua</span>
            <input
              value={buyerRepresentative}
              onChange={(e) => setBuyerRepresentative(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Chức vụ Bên mua</span>
            <input
              value={buyerRepresentativeTitle}
              onChange={(e) => setBuyerRepresentativeTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Đại diện Bên bán</span>
            <input
              value={sellerRepresentative}
              onChange={(e) => setSellerRepresentative(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Chức vụ Bên bán</span>
            <input
              value={sellerRepresentativeTitle}
              onChange={(e) => setSellerRepresentativeTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Địa chỉ Bên mua</span>
            <input
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Điện thoại Bên mua</span>
            <input
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">MST Bên mua</span>
            <input
              value={buyerTaxCode}
              onChange={(e) => setBuyerTaxCode(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={async () => {
              try {
                setSubmitting(true);
                await downloadPoContractPdf({
                  contractNumber: contractNumber.trim(),
                  signedAt: signedAt.trim(),
                  poNumber: po.poNumber,
                  prRef: po.prCode,
                  rfqRef: po.rfqRef,
                  deliveryDate: po.deliveryDate,
                  deliveryAddress: po.deliveryAddress,
                  incoterms: po.incoterms,
                  paymentTerms: paymentTerms.trim() || po.paymentTerms,
                  partialDeliveryAllowed: true,
                  buyer: {
                    companyName: 'CÔNG TY TNHH RMG VIETNAM',
                    address: buyerAddress,
                    phone: buyerPhone,
                    taxCode: buyerTaxCode,
                    representative: buyerRepresentative,
                    representativeTitle: buyerRepresentativeTitle,
                  },
                  seller: {
                    companyName: po.supplier?.name || '',
                    address: po.supplier?.address,
                    phone: po.supplier?.phone,
                    taxCode: po.supplier?.taxCode,
                    representative: sellerRepresentative,
                    representativeTitle: sellerRepresentativeTitle,
                    bankName: po.supplier?.bankName,
                    bankAccount: po.supplier?.bankAccount,
                    contactPerson: po.supplier?.contactPerson,
                    email: po.supplier?.email,
                  },
                  totalAmount: Number(po.totalAmount || 0),
                  currency: po.currency,
                  items: (po.items || []).map((x) => ({
                    lineNo: x.lineNo,
                    description: x.description,
                    model: x.model,
                    brand: x.brand,
                    unit: x.unit,
                    qty: Number(x.qty || 0),
                    unitPrice: Number(x.unitPrice || 0),
                    amount: Number(x.amount || 0),
                    vatPercent: x.vatPercent,
                    deliveryEta: x.expectedDeliveryDate ?? po.deliveryDate,
                  })),
                });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Xuất PDF hợp đồng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
