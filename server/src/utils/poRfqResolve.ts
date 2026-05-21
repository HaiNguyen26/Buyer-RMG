import { prisma } from '../config/database';

/**
 * Mã RFQ cho PO/PR — ưu tiên RFQ trên PR, sau đó RFQ của báo giá đã chọn (PO line / SupplierSelection).
 */
export async function resolveRfqNumbersForPo(
  purchaseRequestId: string,
  quotationItemIds: (string | null | undefined)[]
): Promise<string[]> {
  const seen = new Set<string>();
  const add = (n: string | null | undefined) => {
    const t = n?.trim();
    if (t) seen.add(t);
  };

  const byPr = await prisma.rFQ.findMany({
    where: { purchaseRequestId, deletedAt: null },
    select: { rfqNumber: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of byPr) add(r.rfqNumber);

  const qItemIds = quotationItemIds.filter((id): id is string => Boolean(id));
  if (qItemIds.length > 0) {
    const qItems = await prisma.quotationItem.findMany({
      where: { id: { in: qItemIds }, deletedAt: null },
      select: {
        quotation: {
          select: {
            rfq: {
              select: { rfqNumber: true, deletedAt: true },
            },
          },
        },
      },
    });
    for (const row of qItems) {
      const rfq = row.quotation?.rfq;
      if (rfq && rfq.deletedAt == null) add(rfq.rfqNumber);
    }
  }

  if (seen.size === 0) {
    const selections = await prisma.supplierSelection.findMany({
      where: { purchaseRequestId },
      select: {
        quotation: {
          select: {
            rfq: { select: { rfqNumber: true, deletedAt: true } },
          },
        },
      },
    });
    for (const sel of selections) {
      const rfq = sel.quotation?.rfq;
      if (rfq && rfq.deletedAt == null) add(rfq.rfqNumber);
    }
  }

  return [...seen];
}
