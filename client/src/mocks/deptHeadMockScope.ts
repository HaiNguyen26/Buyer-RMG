/**
 * Giới hạn mock Trưởng phòng chỉ khi layout Department Head đang mount,
 * tránh lẫn dữ liệu vào route Requestor dùng chung requestorService.
 */
let outletActive = false;

export function setDeptHeadMockOutletActive(active: boolean): void {
  outletActive = active;
}

export function isDeptHeadMockOutletActive(): boolean {
  return outletActive;
}
