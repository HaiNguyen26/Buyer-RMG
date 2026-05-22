import { PO_STATUS_BADGE_LABEL } from '../constants/poApprovalQueueFilter';
import type { PoDisplayLang } from './poDisplayLang';

const PO_LINE_STATUS_BADGE_LABEL_EN: Record<string, string> = {
  OPEN: 'Open',
  CONFIRMED: 'Confirmed',
  PARTIAL: 'Partial',
  FULLY_RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

const PO_LINE_STATUS_BADGE_LABEL_VI: Record<string, string> = {
  OPEN: 'Mở',
  CONFIRMED: 'Đã xác nhận',
  PARTIAL: 'Nhận một phần',
  FULLY_RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy dòng',
};

export const PO_STATUS_LABELS: Record<PoDisplayLang, Record<string, string>> = {
  vi: PO_STATUS_BADGE_LABEL,
  en: PO_STATUS_BADGE_LABEL,
};

export const PO_LINE_STATUS_LABELS: Record<PoDisplayLang, Record<string, string>> = {
  vi: PO_LINE_STATUS_BADGE_LABEL_VI,
  en: PO_LINE_STATUS_BADGE_LABEL_EN,
};

export type PoDetailUi = {
  languageLabel: string;
  loading: string;
  errorTitle: string;
  errorSubtitle: string;
  backToList: string;
  heroDescEdit: string;
  heroDescSubmit: string;
  heroDescPost: string;
  edit: string;
  save: string;
  cancel: string;
  submitApproval: string;
  downloadPdf: string;
  markSent: string;
  markConfirmed: string;
  requestCancel: string;
  requestCancelLine: string;
  cancelLineRowAction: string;
  thActions: string;
  partialReceiveBannerTitle: string;
  partialReceiveBannerBody: string;
  cancelPendingBannerTitle: string;
  cancelPendingBannerBody: string;
  lineCancelPendingBadge: string;
  cancelReasonLabel: string;
  cancelReasonPlaceholder: string;
  cancelWarning: string;
  toastCancelRequestedOk: string;
  postLeaderHint: string;
  metaPr: string;
  metaBuyer: string;
  metaSupplier: string;
  metaTotal: string;
  buyerBlockTitle: string;
  buyerCompany: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerTax: string;
  buyerBank: string;
  buyerBankAddr: string;
  buyerBankAcc: string;
  supplierSection: string;
  lblSupplierName: string;
  lblSupplierAddr: string;
  lblSupplierTax: string;
  lblSupplierPhone: string;
  lblSupplierBank: string;
  lblSupplierBankAcc: string;
  termsSection: string;
  lblPaymentTerms: string;
  lblDeliveryAddr: string;
  lblIncoterms: string;
  lblProjectCode: string;
  lblDeliveryDate: string;
  lblNote: string;
  rejectPrefix: string;
  lineItemsSection: string;
  thLine: string;
  thPrItem: string;
  thDesc: string;
  thQty: string;
  thUnit: string;
  thUnitPrice: string;
  thAmount: string;
  thVat: string;
  totalsSection: string;
  subtotal: string;
  subtotalExVat: string;
  vatTotal: string;
  vat8: string;
  grandTotal: string;
  amountsIncludeVatNote: string;
  lineItemsVatHint: string;
  approvalLine: string;
  approvedFallback: string;
  attachments: string;
  toastPdfOk: string;
  toastSubmitOk: string;
  toastMarkSentOk: string;
  toastMarkConfirmedOk: string;
  cancelModalTitle: string;
  cancelModalSelectHint: string;
  cancelModalReason: string;
  cancelModalSubmit: string;
  cancelModalClose: string;
  thReceived: string;
  thRemaining: string;
  thConfirmedQty: string;
  thEta: string;
  colLineStatus: string;
  confirmModalTitle: string;
  confirmModalSubtitle: string;
  confirmModalHint: string;
  confirmModalSubmit: string;
  confirmModalNoLines: string;
  confirmModalQtyInvalid: string;
  confirmModalQtyOver: string;
  confirmModalEtaRequired: string;
  confirmModalNeedOneLine: string;
  updateSupplierConfirm: string;
  updateSupplierConfirmSubmit: string;
  toastUpdateSupplierConfirmOk: string;
};

const VI: PoDetailUi = {
  languageLabel: 'Ngôn ngữ',
  loading: 'Đang tải chi tiết PO…',
  errorTitle: 'Không tải được chi tiết PO',
  errorSubtitle: 'Vui lòng thử lại hoặc quay về danh sách.',
  backToList: 'Danh sách PO',
  heroDescEdit: 'Chỉnh sửa thông tin PO, sau đó lưu hoặc gửi Trưởng phòng Mua hàng duyệt.',
  heroDescSubmit: 'Kiểm tra dữ liệu và gửi duyệt khi sẵn sàng.',
  heroDescPost:
    'Sau khi Trưởng phòng duyệt (CREATED): xuất PDF, gửi mail NCC ngoài hệ thống, rồi Mark as Sent (SENT) để kho thấy PO chờ nhận.',
  edit: 'Chỉnh sửa',
  save: 'Lưu thay đổi',
  cancel: 'Hủy',
  submitApproval: 'Gửi duyệt',
  downloadPdf: 'Tải PDF PO',
  markSent: 'Mark as Sent',
  markConfirmed: 'NCC đã xác nhận',
  requestCancel: 'Yêu cầu hủy PO',
  requestCancelLine: 'Hủy dòng còn lại',
  cancelLineRowAction: 'Hủy dòng',
  thActions: 'Thao tác',
  partialReceiveBannerTitle: 'Kho nhận thiếu — cần xử lý với NCC',
  partialReceiveBannerBody:
    'Sau khi NCC xác nhận hết hàng / không giao được phần còn lại: chọn Hủy dòng còn lại (không hủy toàn PO). Hủy có hiệu lực ngay — item trở về PR được phân công (cùng mã PR) để RFQ và PO mới.',
  cancelPendingBannerTitle: 'PO đang chờ xử lý hủy dòng (dữ liệu cũ)',
  cancelPendingBannerBody:
    'Trưởng phòng Mua hàng cần duyệt một lần trong hàng chờ PO, hoặc Buyer hủy lại sau khi đã xử lý.',
  lineCancelPendingBadge: 'Chờ xử lý hủy',
  cancelReasonLabel: 'Lý do hủy dòng (NCC hết hàng / không giao được)',
  cancelReasonPlaceholder: 'Ví dụ: NCC hết hàng, không giao được phần còn lại sau khi kho nhận thiếu…',
  cancelWarning:
    'Chỉ hủy phần chưa nhận kho. Sau khi xác nhận, item về màn PR được phân công — giữ nguyên mã PR, tạo RFQ/PO mới.',
  toastCancelRequestedOk: 'Đã hủy dòng PO còn lại. Item chờ mua lại đã trả về PR.',
  postLeaderHint:
    'Đã duyệt nội bộ — chỉ xem; xuất PDF, gửi NCC ngoài hệ thống, rồi Mark as Sent để kho nhận hàng.',
  metaPr: 'PR',
  metaBuyer: 'Buyer',
  metaSupplier: 'NCC',
  metaTotal: 'Tổng',
  buyerBlockTitle: 'Bên mua',
  buyerCompany: 'Công ty:',
  buyerAddress: 'Địa chỉ:',
  buyerPhone: 'Điện thoại:',
  buyerTax: 'MST:',
  buyerBank: 'Ngân hàng:',
  buyerBankAddr: 'Địa chỉ NH:',
  buyerBankAcc: 'Số tài khoản:',
  supplierSection: 'Nhà cung cấp',
  lblSupplierName: 'Tên NCC',
  lblSupplierAddr: 'Địa chỉ',
  lblSupplierTax: 'MST',
  lblSupplierPhone: 'Điện thoại',
  lblSupplierBank: 'Ngân hàng',
  lblSupplierBankAcc: 'Số tài khoản',
  termsSection: 'Điều khoản và giao hàng',
  lblPaymentTerms: 'Điều khoản thanh toán',
  lblDeliveryAddr: 'Địa chỉ giao hàng',
  lblIncoterms: 'Incoterms',
  lblProjectCode: 'Mã dự án',
  lblDeliveryDate: 'Ngày giao dự kiến',
  lblNote: 'Ghi chú',
  rejectPrefix: 'Từ chối:',
  lineItemsSection: 'Chi tiết hàng',
  thLine: 'STT',
  thPrItem: 'PR Item',
  thDesc: 'Mô tả',
  thQty: 'SL',
  thUnit: 'Đơn vị',
  thUnitPrice: 'Đơn giá (chưa VAT)',
  thAmount: 'Thành tiền (có VAT)',
  thVat: 'VAT %',
  totalsSection: 'Tổng tiền',
  subtotal: 'Tạm tính',
  subtotalExVat: 'Tiền hàng (chưa VAT)',
  vatTotal: 'Tiền VAT',
  vat8: 'VAT 8%',
  grandTotal: 'Tổng cộng (có VAT)',
  amountsIncludeVatNote:
    'Số liệu từ báo giá NCC: đơn giá chưa VAT; thành tiền từng dòng và tổng PO đã bao gồm VAT theo % đã nhập khi báo giá.',
  lineItemsVatHint:
    'Thành tiền = SL × đơn giá × (1 + VAT%). Tổng PO là tổng các dòng đã gồm VAT.',
  approvalLine: 'Phê duyệt (Trưởng phòng Mua hàng):',
  approvedFallback: 'Đã duyệt',
  attachments: 'Đính kèm',
  toastPdfOk: 'Đã tải file PDF',
  toastSubmitOk: 'PO đã được gửi duyệt',
  toastMarkSentOk: 'Đã đánh dấu đã gửi NCC (SENT). Kho sẽ thấy PO trong màn PO chờ nhận.',
  toastMarkConfirmedOk: 'Đã cập nhật CONFIRMED.',
  cancelModalTitle: 'Hủy dòng PO còn lại (không hủy toàn PO)',
  cancelModalSelectHint:
    'Chọn dòng còn thiếu so với đã nhận kho. Mặc định chọn tất cả dòng đủ điều kiện.',
  cancelModalReason: 'Lý do',
  cancelModalSubmit: 'Xác nhận hủy dòng',
  cancelModalClose: 'Đóng',
  thReceived: 'Đã nhận',
  thRemaining: 'Còn lại',
  thConfirmedQty: 'SL confirm',
  thEta: 'ETA giao',
  colLineStatus: 'Dòng PO',
  confirmModalTitle: 'Ghi nhận xác nhận NCC',
  confirmModalSubtitle: 'Nhập số lượng NCC cam kết và ngày giao dự kiến theo từng dòng.',
  confirmModalHint:
    'Mỗi dòng cần SL confirm ≤ SL đặt. Dòng có SL confirm > 0 bắt buộc có ETA. Kho chỉ nhận tối đa SL confirm.',
  confirmModalSubmit: 'Xác nhận NCC',
  confirmModalNoLines: 'PO không có dòng hàng.',
  confirmModalQtyInvalid: 'SL confirm không hợp lệ.',
  confirmModalQtyOver: 'SL confirm vượt quá SL đặt.',
  confirmModalEtaRequired: 'Dòng có SL confirm > 0 cần ETA.',
  confirmModalNeedOneLine: 'Cần ít nhất một dòng có SL confirm > 0.',
  updateSupplierConfirm: 'Cập nhật xác nhận NCC',
  updateSupplierConfirmSubmit: 'Lưu cập nhật',
  toastUpdateSupplierConfirmOk: 'Đã cập nhật xác nhận NCC / ETA.',
};

const EN: PoDetailUi = {
  languageLabel: 'Language',
  loading: 'Loading purchase order…',
  errorTitle: 'Could not load PO',
  errorSubtitle: 'Please try again or return to the list.',
  backToList: 'PO list',
  heroDescEdit: 'Edit PO details, then save or submit to Buyer Manager for approval.',
  heroDescSubmit: 'Review the data and submit for approval when ready.',
  heroDescPost:
    'After Buyer Manager approval (CREATED): export PDF, email the supplier outside the system, then Mark as Sent (SENT) so warehouse sees the PO.',
  edit: 'Edit',
  save: 'Save changes',
  cancel: 'Cancel',
  submitApproval: 'Submit for approval',
  downloadPdf: 'Download PO PDF',
  markSent: 'Mark as Sent',
  markConfirmed: 'Supplier confirmed',
  requestCancel: 'Request PO cancellation',
  requestCancelLine: 'Cancel remaining lines',
  cancelLineRowAction: 'Cancel line',
  thActions: 'Actions',
  partialReceiveBannerTitle: 'Short receipt — follow up with supplier',
  partialReceiveBannerBody:
    'After the supplier confirms they cannot deliver the remainder: use Cancel remaining lines (not the whole PO). Takes effect immediately — items return to assigned PR for a new RFQ/PO.',
  cancelPendingBannerTitle: 'PO pending line cancel (legacy)',
  cancelPendingBannerBody:
    'Buyer Manager must approve once in the PO queue, or Buyer can retry after it is processed.',
  lineCancelPendingBadge: 'Cancel pending',
  cancelReasonLabel: 'Reason (out of stock / cannot deliver)',
  cancelReasonPlaceholder:
    'Example: supplier out of stock; cannot deliver remainder after partial warehouse receipt…',
  cancelWarning:
    'Only the unreceived quantity is cancelled. Items return to assigned PR immediately — same PR number, new RFQ/PO.',
  toastCancelRequestedOk: 'Remaining PO lines cancelled. Items returned to PR for re-sourcing.',
  postLeaderHint:
    'Internally approved — view only; export PDF, contact supplier, then Mark as Sent for warehouse receiving.',
  metaPr: 'PR',
  metaBuyer: 'Buyer',
  metaSupplier: 'Supplier',
  metaTotal: 'Total',
  buyerBlockTitle: 'Buyer',
  buyerCompany: 'Company:',
  buyerAddress: 'Address:',
  buyerPhone: 'Phone:',
  buyerTax: 'Tax code:',
  buyerBank: 'Bank:',
  buyerBankAddr: 'Bank address:',
  buyerBankAcc: 'Account no.:',
  supplierSection: 'Supplier',
  lblSupplierName: 'Supplier name',
  lblSupplierAddr: 'Address',
  lblSupplierTax: 'Tax code',
  lblSupplierPhone: 'Phone',
  lblSupplierBank: 'Bank',
  lblSupplierBankAcc: 'Account number',
  termsSection: 'Terms & delivery',
  lblPaymentTerms: 'Payment terms',
  lblDeliveryAddr: 'Delivery address',
  lblIncoterms: 'Incoterms',
  lblProjectCode: 'Project code',
  lblDeliveryDate: 'Expected delivery',
  lblNote: 'Notes',
  rejectPrefix: 'Rejected:',
  lineItemsSection: 'Line items',
  thLine: 'No.',
  thPrItem: 'PR item',
  thDesc: 'Description',
  thQty: 'Qty',
  thUnit: 'UoM',
  thUnitPrice: 'Unit price (excl. VAT)',
  thAmount: 'Amount (incl. VAT)',
  thVat: 'VAT %',
  totalsSection: 'Totals',
  subtotal: 'Subtotal',
  subtotalExVat: 'Subtotal (excl. VAT)',
  vatTotal: 'VAT amount',
  vat8: 'VAT 8%',
  grandTotal: 'Grand total (incl. VAT)',
  amountsIncludeVatNote:
    'From supplier quotation: unit price excludes VAT; line amounts and PO total include VAT per quotation entry.',
  lineItemsVatHint:
    'Line amount = qty × unit price × (1 + VAT%). PO total is the sum of VAT-inclusive line amounts.',
  approvalLine: 'Approved by (Buyer Manager):',
  approvedFallback: 'Approved',
  attachments: 'Attachments',
  toastPdfOk: 'PDF downloaded',
  toastSubmitOk: 'PO submitted for approval',
  toastMarkSentOk: 'Marked as sent (SENT). Warehouse will see the PO for receiving.',
  toastMarkConfirmedOk: 'Updated to CONFIRMED.',
  cancelModalTitle: 'Cancel remaining PO lines (not the whole PO)',
  cancelModalSelectHint:
    'Select lines still short vs warehouse received. Default: all eligible lines.',
  cancelModalReason: 'Reason',
  cancelModalSubmit: 'Confirm cancel lines',
  cancelModalClose: 'Close',
  thReceived: 'Received',
  thRemaining: 'Remaining',
  thConfirmedQty: 'Confirmed qty',
  thEta: 'Delivery ETA',
  colLineStatus: 'PO line',
  confirmModalTitle: 'Record supplier confirmation',
  confirmModalSubtitle: 'Enter committed qty and expected delivery date per line.',
  confirmModalHint:
    'Confirmed qty must not exceed ordered qty. Lines with qty > 0 require an ETA. Warehouse receipt is capped at confirmed qty.',
  confirmModalSubmit: 'Confirm supplier',
  confirmModalNoLines: 'PO has no line items.',
  confirmModalQtyInvalid: 'Invalid confirmed quantity.',
  confirmModalQtyOver: 'Confirmed qty exceeds ordered qty.',
  confirmModalEtaRequired: 'Lines with confirmed qty > 0 require an ETA.',
  confirmModalNeedOneLine: 'At least one line must have confirmed qty > 0.',
  updateSupplierConfirm: 'Update supplier confirmation',
  updateSupplierConfirmSubmit: 'Save update',
  toastUpdateSupplierConfirmOk: 'Supplier confirmation / ETA updated.',
};

export function poDetailUi(lang: PoDisplayLang): PoDetailUi {
  return lang === 'en' ? EN : VI;
}
