/**
 * Tổng hợp trạng thái PR từ trạng thái các item (Phase 1–2 lifecycle).
 * PR không set tay; PR status phản ánh tổng thể item.
 *
 * **Partial duyệt Trưởng phòng:** trước khi gọi hàm này, phải loại các dòng có
 * `departmentItemOutcome` ∈ { REJECTED, ON_HOLD, REVISION_REQUIRED } khỏi mảng status (các dòng đó
 * không tham gia pipeline mua/RFQ/PO). Dữ liệu cũ: outcome null = active.
 */

type ItemStatus = string;

// PRStatus values we set from item aggregate (use string to avoid circular dep on Prisma)
type PRStatusValue = 'ASSIGNED_TO_BUYER' | 'RFQ_IN_PROGRESS' | 'QUOTATION_RECEIVED' | 'SUPPLIER_SELECTED' | 'RFQ_COMPLETED';

/**
 * Tính trạng thái PR nên set dựa trên danh sách status của các item (không xóa).
 * Trả về null nếu không nên đổi PR (vd toàn NEW trong giai đoạn duyệt).
 */
export function computePRStatusFromItemStatuses(statuses: ItemStatus[]): PRStatusValue | null {
  if (statuses.length === 0) return null;

  const all = (pred: (s: string) => boolean) => statuses.every(pred);
  const some = (pred: (s: string) => boolean) => statuses.some(pred);

  // Tất cả item đã chọn NCC hoặc đã hoàn tất mua/nhận (FULFILLED) → RFQ xong, PR = RFQ_COMPLETED (Phase 3: Buyer tạo PO)
  const procurementDone = (s: string) => s === 'SUPPLIER_SELECTED' || s === 'FULFILLED';
  if (all(procurementDone)) {
    return 'RFQ_COMPLETED' as PRStatusValue;
  }

  // Có item đã sẵn sàng so sánh / đã submit → đang chờ Leader chọn NCC
  if (some(s => s === 'READY_FOR_REVIEW' || s === 'RFQ_SUBMITTED')) {
    return 'QUOTATION_RECEIVED' as PRStatusValue;
  }

  // Có item đã đưa vào RFQ
  if (some(s => s === 'RFQ_CREATED')) {
    return 'RFQ_IN_PROGRESS' as PRStatusValue;
  }

  // Tất cả item đã được phân công (không còn NEW) → ASSIGNED_TO_BUYER
  if (some(s => s === 'ASSIGNED') && !some(s => s === 'NEW')) {
    return 'ASSIGNED_TO_BUYER' as PRStatusValue;
  }

  // Toàn NEW hoặc còn NEW → không ép PR (giữ trạng thái hiện tại, e.g. BUYER_LEADER_PENDING)
  return null;
}
