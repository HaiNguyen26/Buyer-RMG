import { prisma } from '../config/database';

type ItemStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'RFQ_CREATED'
  | 'RFQ_SUBMITTED'
  | 'READY_FOR_REVIEW'
  | 'SUPPLIER_SELECTED'
  | 'FULFILLED';

// Các trạng thái PRStatus trong phase 1–2 được ánh xạ từ trạng thái item
type PhaseStatus = 'DRAFT' | 'IN_RFQ_PROGRESS' | 'IN_SUPPLIER_SELECTION' | 'RFQ_COMPLETED';

const TERMINAL_PR_STATUSES: string[] = [
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
  'BUDGET_REJECTED',
  'PAYMENT_DONE',
  'CANCELLED',
];

// Tính trạng thái phase (DRAFT / IN_RFQ_PROGRESS / IN_SUPPLIER_SELECTION / RFQ_COMPLETED)
function computePhaseStatusFromItems(statuses: ItemStatus[]): PhaseStatus {
  if (statuses.length === 0) return 'DRAFT';

  const has = (s: ItemStatus) => statuses.includes(s);

  const doneForPhase = (s: ItemStatus) => s === 'SUPPLIER_SELECTED' || s === 'FULFILLED';

  // Tất cả item đã chọn NCC hoặc đã hoàn tất nhận hàng theo dòng
  if (statuses.every((s) => doneForPhase(s))) {
    return 'RFQ_COMPLETED';
  }

  // Đang chọn NCC: có item đã SUBMITTED / READY_FOR_REVIEW nhưng còn item chưa SUPPLIER_SELECTED
  if (
    has('READY_FOR_REVIEW') ||
    has('RFQ_SUBMITTED')
  ) {
    return 'IN_SUPPLIER_SELECTION';
  }

  // Đang tạo / thu thập RFQ
  if (has('ASSIGNED') || has('RFQ_CREATED')) {
    return 'IN_RFQ_PROGRESS';
  }

  // Mặc định: coi như đang chuẩn bị RFQ
  return 'DRAFT';
}

// Ánh xạ phase-status sang PRStatus hiện có
function mapPhaseStatusToPRStatus(phaseStatus: PhaseStatus): string {
  switch (phaseStatus) {
    case 'DRAFT':
      return 'ASSIGNED_TO_BUYER'; // Đã phân công nhưng chưa thực sự hỏi giá
    case 'IN_RFQ_PROGRESS':
      return 'RFQ_IN_PROGRESS';
    case 'IN_SUPPLIER_SELECTION':
      return 'QUOTATION_RECEIVED';
    case 'RFQ_COMPLETED':
      return 'SUPPLIER_SELECTED';
    default:
      return 'ASSIGNED_TO_BUYER';
  }
}

/**
 * Cập nhật PR.status dựa trên trạng thái item (Phase 1–2: PR → RFQ → Supplier Selected)
 * - Không override các trạng thái terminal như BUDGET_EXCEPTION, PAYMENT_DONE, CANCELLED...
 */
export async function updatePRStatusFromItems(prId: string): Promise<void> {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      id: true,
      status: true,
      items: {
        where: { deletedAt: null },
        select: { status: true },
      },
    },
  });

  if (!pr) return;

  // Không đụng vào PR đã sang các phase sau
  if (TERMINAL_PR_STATUSES.includes(pr.status)) {
    return;
  }

  const itemStatuses = (pr.items || []).map((i) => i.status as ItemStatus);
  const phaseStatus = computePhaseStatusFromItems(itemStatuses);
  const targetStatus = mapPhaseStatusToPRStatus(phaseStatus);

  if (targetStatus === pr.status) {
    return;
  }

  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { status: targetStatus },
  });
}

