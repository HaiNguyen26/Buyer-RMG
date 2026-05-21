/**
 * Chuẩn hóa thông tin Sales Order (SO) / PO khách gắn với PR cho API + UI.
 */

export type SerializedPRSalesOrder = {
  linkedToSO: boolean;
  salesPOId: string | null;
  salesPONumber: string | null;
  customerPONumber: string | null;
  projectName: string | null;
  projectCode: string | null;
  customerName: string | null;
  /** Một dòng: SO-xxx · PO KH · dự án */
  label: string | null;
};

type SalesPORow = {
  salesPONumber: string;
  customerPONumber: string | null;
  projectName: string | null;
  projectCode: string | null;
  customer: { name: string } | null;
} | null;

export function serializePRSalesOrder(pr: {
  salesPOId: string | null;
  customerPO: string | null;
  projectName: string | null;
  projectCode: string | null;
  customerName: string | null;
  salesPO?: SalesPORow;
}): SerializedPRSalesOrder {
  const so = pr.salesPO ?? null;
  const salesPONumber = so?.salesPONumber ?? null;
  const customerPONumber = so?.customerPONumber ?? pr.customerPO ?? null;
  const projectName = so?.projectName ?? pr.projectName ?? null;
  const projectCode = so?.projectCode ?? pr.projectCode ?? null;
  const customerName = so?.customer?.name ?? pr.customerName ?? null;
  const linkedToSO = Boolean(pr.salesPOId);

  const parts: string[] = [];
  if (salesPONumber) parts.push(`SO ${salesPONumber}`);
  if (customerPONumber && customerPONumber !== salesPONumber) {
    parts.push(`PO KH ${customerPONumber}`);
  } else if (!salesPONumber && customerPONumber) {
    parts.push(`PO KH ${customerPONumber}`);
  }
  if (projectName) parts.push(projectName);
  else if (customerName) parts.push(customerName);

  const label =
    parts.length > 0 ? parts.join(' · ') : linkedToSO ? 'Đã liên kết SO' : null;

  return {
    linkedToSO,
    salesPOId: pr.salesPOId,
    salesPONumber,
    customerPONumber,
    projectName,
    projectCode,
    customerName,
    label,
  };
}

/** Dùng trong Prisma `include: { salesPO: { select: prSalesPOSelect } }` */
export const prSalesPOSelect = {
  id: true,
  salesPONumber: true,
  customerPONumber: true,
  projectName: true,
  projectCode: true,
  customer: { select: { name: true } },
} as const;
