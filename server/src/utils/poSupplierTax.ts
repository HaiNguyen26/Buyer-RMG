import type { Prisma } from '@prisma/client';

/** Chuẩn hóa MST: trim, rỗng → null. */
export function trimSupplierTaxCode(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t || null;
}

/** MST hiển thị trên PO: ưu tiên master NCC, fallback giá trị buyer nhập trên PO. */
export function effectiveSupplierTaxCode(
  masterTaxCode: string | null | undefined,
  poBuyerTaxCode: string | null | undefined
): string | null {
  return trimSupplierTaxCode(masterTaxCode) ?? trimSupplierTaxCode(poBuyerTaxCode);
}

export function mapSupplierTaxForPoView<T extends { taxCode?: string | null }>(
  supplier: T,
  poBuyerTaxCode: string | null | undefined
): T {
  const taxCode = effectiveSupplierTaxCode(supplier.taxCode, poBuyerTaxCode);
  if (taxCode === (supplier.taxCode ?? null)) return supplier;
  return { ...supplier, taxCode };
}

/**
 * Khi duyệt PO: nếu master NCC chưa có MST mà buyer đã nhập trên PO → ghi vào Supplier.
 * @returns true nếu đã cập nhật master
 */
export async function applySupplierTaxCodeOnPoApproval(
  tx: Prisma.TransactionClient,
  supplierId: string,
  masterTaxCode: string | null | undefined,
  poBuyerTaxCode: string | null | undefined
): Promise<boolean> {
  if (trimSupplierTaxCode(masterTaxCode)) return false;
  const tax = trimSupplierTaxCode(poBuyerTaxCode);
  if (!tax) return false;
  await tx.supplier.update({
    where: { id: supplierId },
    data: { taxCode: tax },
  });
  return true;
}
