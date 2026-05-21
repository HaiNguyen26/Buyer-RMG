/**
 * Giới hạn mock GĐ chi nhánh khi layout `/dashboard/branch-manager` đang mount.
 */
let outletActive = false;

export function setBranchManagerMockOutletActive(active: boolean): void {
  outletActive = active;
}

export function isBranchManagerMockOutletActive(): boolean {
  return outletActive;
}
