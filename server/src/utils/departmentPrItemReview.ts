/** Trưởng phòng: quyết định theo dòng (partial) — tính tiền & điều kiện dòng NEED_PURCHASE
 *
 * **Luồng nghiệp vụ:**
 * - Chỉ dòng `NEED_PURCHASE` nhận outcome APPROVED | REJECTED | REVISION_REQUIRED | ON_HOLD (legacy) từ UI/API.
 * - Dòng `FROM_STOCK` (và các status khác) luôn ghi APPROVED ở server; không bulk-edit trên UI.
 * - `REVISION_REQUIRED`: Requestor sửa + Resubmit → Trưởng phòng duyệt lại chỉ dòng đó.
 * - Nếu sau duyệt không còn dòng NEED_PURCHASE+APPROVED để đi tiếp: PR chuyển MANAGER_REJECTED.
 */

import type { Prisma } from '@prisma/client';

export type DepartmentItemOutcomeValue =
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'REVISION_REQUIRED';

export function itemLineAmountForTotal(item: {
  amount?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  estimatedUnitPriceVnd?: unknown;
}): number {
  const a = item.amount != null ? Number(item.amount) : NaN;
  if (Number.isFinite(a) && a > 0) return a;
  const qty = Number(item.qty) || 0;
  const est = Number((item as { estimatedUnitPriceVnd?: unknown }).estimatedUnitPriceVnd) || 0;
  const unit = Number(item.unitPrice) || 0;
  const u = est > 0 ? est : unit;
  return u > 0 && qty > 0 ? qty * u : 0;
}

/** Chỉ dòng NEED_PURCHASE mới nhận quyết định từ Trưởng phòng; FROM_STOCK luôn coi là đã chốt nội bộ. */
export function itemEligibleForDepartmentOutcome(itemStatus: string): boolean {
  return String(itemStatus || '').toUpperCase() === 'NEED_PURCHASE';
}

/** Tổng PR sau duyệt: không tính dòng bị loại khỏi purchasing. */
export function sumPurchaseTotalAfterDepartmentDecisions(
  items: Array<{
    status: string;
    departmentItemOutcome: DepartmentItemOutcomeValue | null;
    amount?: unknown;
    qty?: unknown;
    unitPrice?: unknown;
    estimatedUnitPriceVnd?: unknown;
  }>
): number {
  let sum = 0;
  for (const item of items) {
    const o = item.departmentItemOutcome;
    if (o === 'REJECTED' || o === 'ON_HOLD' || o === 'REVISION_REQUIRED') continue;
    sum += itemLineAmountForTotal(item);
  }
  return Math.round(sum * 100) / 100;
}

/** Snapshot “ban đầu”: tất cả dòng (trước khi loại reject/hold/revision khỏi tổng purchasing). */
export function sumAllLinesSnapshot(
  items: Array<{
    amount?: unknown;
    qty?: unknown;
    unitPrice?: unknown;
    estimatedUnitPriceVnd?: unknown;
  }>
): number {
  let sum = 0;
  for (const item of items) {
    sum += itemLineAmountForTotal(item);
  }
  return Math.round(sum * 100) / 100;
}

/** Dòng còn tham gia mua/RFQ/PO. `null` = dữ liệu cũ (coi như active). */
export function itemDepartmentOutcomeAllowsProcurement(outcome: string | null | undefined): boolean {
  if (outcome === 'REJECTED' || outcome === 'ON_HOLD' || outcome === 'REVISION_REQUIRED') return false;
  return true;
}

/** Còn ít nhất một dòng NEED_PURCHASE được Trưởng phòng APPROVED → PR có thể chuyển tiếp (không MANAGER_REJECTED). */
export function hasActivePurchasingAfterDecisions(
  items: Array<{ status: string; departmentItemOutcome: DepartmentItemOutcomeValue | null }>
): boolean {
  for (const item of items) {
    if (!itemEligibleForDepartmentOutcome(String(item.status))) continue;
    if (item.departmentItemOutcome === 'APPROVED') return true;
  }
  return false;
}

/** Điều kiện Prisma: dòng NEED_PURCHASE chưa bị Trưởng phòng loại khỏi luồng mua. */
export const prismaPurchaseItemNeedPurchaseDepartmentActive = {
  deletedAt: null,
  status: 'NEED_PURCHASE',
  OR: [{ departmentItemOutcome: null }, { departmentItemOutcome: 'APPROVED' }],
} as Prisma.PurchaseRequestItemWhereInput;

/** Dòng PR chưa bị Trưởng phòng loại khỏi luồng (dùng kèm deletedAt cho mọi status dòng). */
export const prismaDepartmentOutcomeRowActive = {
  OR: [{ departmentItemOutcome: null }, { departmentItemOutcome: 'APPROVED' }],
} as Prisma.PurchaseRequestItemWhereInput;

/**
 * Danh sách item id thuộc phạm vi phân công của buyer (FULL / PARTIAL).
 * Đồng bộ với `getPRDetails` — gồm dòng ASSIGNED, RFQ_* (không chỉ NEED_PURCHASE).
 */
export function resolveBuyerAssignedItemIds(
  assignment: { scope: string; assignedItemIds: string | null },
  procurementItems: Array<{ id: string }>
): string[] {
  const activeIds = new Set(procurementItems.map((i) => i.id));
  if (assignment.scope === 'FULL') {
    return procurementItems.map((i) => i.id);
  }
  if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
    try {
      const parsed = JSON.parse(assignment.assignedItemIds) as string[];
      return parsed.filter((id) => activeIds.has(id));
    } catch {
      return [];
    }
  }
  return [];
}

const DEPT_HEAD_QUEUE_PR_STATUSES = new Set(['MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING']);

const DEPT_FIRST_PASS_DECIDED = new Set([
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'REVISION_REQUIRED',
]);

/**
 * PR còn trong hàng chờ duyệt Trưởng phòng (lần đầu): trạng thái cấp 1 đang chờ,
 * và còn dòng NEED_PURCHASE chưa có quyết định Trưởng phòng.
 */
export function purchaseRequestStillPendingDepartmentHeadQueue(pr: {
  status: string;
  items: ReadonlyArray<{
    status?: string | null;
    departmentItemOutcome?: string | null;
    departmentRevisionSubmittedAt?: Date | null;
  }>;
}): boolean {
  if (!DEPT_HEAD_QUEUE_PR_STATUSES.has(String(pr.status || ''))) return false;
  const need = (pr.items || []).filter((i) => String(i.status || '').toUpperCase() === 'NEED_PURCHASE');
  if (need.length === 0) return true;
  const allNeedDecided = need.every((i) => {
    const o = i.departmentItemOutcome;
    return o != null && DEPT_FIRST_PASS_DECIDED.has(String(o));
  });
  return !allNeedDecided;
}

/** Có dòng NEED_PURCHASE đã resubmit, chờ Trưởng phòng xem lại (PR có thể đã qua cấp 1). */
export function purchaseRequestNeedsDepartmentHeadRevisionResubmitReview(pr: {
  items: ReadonlyArray<{
    status?: string | null;
    departmentItemOutcome?: string | null;
    departmentRevisionSubmittedAt?: Date | null;
  }>;
}): boolean {
  return (pr.items || []).some(
    (i) =>
      String(i.status || '').toUpperCase() === 'NEED_PURCHASE' &&
      String(i.departmentItemOutcome || '') === 'REVISION_REQUIRED' &&
      i.departmentRevisionSubmittedAt != null
  );
}
