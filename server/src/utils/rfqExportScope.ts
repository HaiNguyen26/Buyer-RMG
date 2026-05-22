import { prisma } from '../config/database';
import { resolveBuyerAssignedItemIds } from './departmentPrItemReview';

export function parseRfqItemIdsFromNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const match = notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]) as { itemIds?: string[] };
    return Array.isArray(parsed.itemIds) ? parsed.itemIds : [];
  } catch {
    return [];
  }
}

/** RFQ + dòng hàng thuộc phạm vi buyer (và RFQ_ITEMS nếu có). */
export async function loadRfqExportScopeForBuyer(rfqId: string, buyerId: string) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId, deletedAt: null },
    include: {
      purchaseRequest: {
        include: {
          items: {
            where: { deletedAt: null },
            orderBy: { lineNo: 'asc' },
          },
          requestor: {
            select: { username: true, email: true, fullName: true },
          },
          salesPO: {
            select: {
              salesPONumber: true,
              customerPONumber: true,
              projectCode: true,
              projectName: true,
            },
          },
          assignments: {
            where: { buyerId, deletedAt: null },
          },
        },
      },
      buyer: {
        select: { username: true, email: true, fullName: true, phone: true },
      },
    },
  });

  if (!rfq) return null;
  if (rfq.buyerId !== buyerId) return { forbidden: true as const };

  const assignment = rfq.purchaseRequest.assignments[0];
  if (!assignment) return { forbidden: true as const };

  const rfqItemIds = parseRfqItemIdsFromNotes(rfq.notes);
  const assignedItemIds = resolveBuyerAssignedItemIds(assignment, rfq.purchaseRequest.items);

  let items = rfq.purchaseRequest.items;
  if (rfqItemIds.length > 0) {
    items = items.filter(
      (item) => rfqItemIds.includes(item.id) && assignedItemIds.includes(item.id)
    );
  } else {
    items = items.filter((item) => assignedItemIds.includes(item.id));
  }

  return { rfq, items, assignment };
}
