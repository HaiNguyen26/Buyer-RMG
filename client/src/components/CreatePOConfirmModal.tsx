import { ShoppingCart } from 'lucide-react';
import { AppModal } from './AppModal';

export type CreatePOConfirmTarget = {
  prId: string;
  prCode: string;
  supplierCount?: number;
  selectedAmount?: number | null;
  currency?: string;
};

type CreatePOConfirmModalProps = {
  open: boolean;
  target: CreatePOConfirmTarget | null;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CreatePOConfirmModal({
  open,
  target,
  isPending = false,
  onClose,
  onConfirm,
}: CreatePOConfirmModalProps) {
  const amountLabel =
    target?.selectedAmount != null
      ? `${Number(target.selectedAmount).toLocaleString('vi-VN')} ${target.currency ?? 'VND'}`
      : null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Tạo đơn đặt hàng (PO)?"
      subtitle={target ? `Từ PR ${target.prCode}` : 'Xác nhận trước khi tạo PO nháp'}
      headerIcon={<ShoppingCart className="h-5 w-5 text-indigo-600" strokeWidth={2} />}
      description="Xác nhận tạo đơn đặt hàng từ PR đã chọn NCC"
      size="sm"
      closeOnBackdropClick={!isPending}
      closeOnEscape={!isPending}
      showCloseButton={!isPending}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Đang tạo…' : 'Xác nhận tạo PO'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-slate-600">
        <p>
          Hệ thống sẽ tạo <strong className="font-semibold text-slate-800">PO nháp</strong>
          {target && (target.supplierCount ?? 0) > 1
            ? ` — ${target.supplierCount} PO (mỗi NCC một đơn)`
            : ''}{' '}
          theo nhà cung cấp đã chọn trên PR. Bạn có thể chỉnh sửa và gửi duyệt sau khi tạo.
        </p>
        {target ? (
          <ul className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700">
            <li>
              <span className="font-medium text-slate-500">Mã PR:</span>{' '}
              <span className="font-semibold text-slate-900">{target.prCode}</span>
            </li>
            {target.supplierCount != null ? (
              <li className="mt-1">
                <span className="font-medium text-slate-500">Số NCC:</span>{' '}
                <span className="font-semibold text-slate-900">{target.supplierCount}</span>
              </li>
            ) : null}
            {amountLabel ? (
              <li className="mt-1">
                <span className="font-medium text-slate-500">Giá trị đã chọn:</span>{' '}
                <span className="font-semibold tabular-nums text-slate-900">{amountLabel}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
        <p className="text-xs text-slate-500">Thao tác này chưa gửi PO cho NCC — chỉ khởi tạo bản nháp trong hệ thống.</p>
      </div>
    </AppModal>
  );
}
