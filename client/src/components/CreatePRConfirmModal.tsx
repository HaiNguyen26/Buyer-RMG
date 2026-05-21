import { FilePlus } from 'lucide-react';
import { AppModal } from './AppModal';

type CreatePRConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CreatePRConfirmModal({ open, onClose, onConfirm }: CreatePRConfirmModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Tạo phiếu yêu cầu (PR)?"
      subtitle="Mở form nhập thông tin PR mới."
      headerIcon={<FilePlus className="h-5 w-5 text-blue-600" strokeWidth={2} />}
      description="Xác nhận tạo phiếu yêu cầu mua hàng mới"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            Tiếp tục
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">
        Bạn có chắc muốn tạo phiếu yêu cầu mua hàng (PR) mới? Sau khi xác nhận, hệ thống sẽ chuyển bạn
        đến trang nhập chi tiết.
      </p>
    </AppModal>
  );
}
