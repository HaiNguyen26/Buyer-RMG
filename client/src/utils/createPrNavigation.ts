/**
 * Đường dẫn mở form tạo PR (không gồm tạo phiếu xuất kho hay route khác có /create).
 */
export function isCreatePRNavigationPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return /\/pr\/create$/.test(base) || /\/my-prs\/create$/.test(base);
}
