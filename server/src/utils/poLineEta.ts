import { prisma } from '../config/database';

export function isoDateOnlyYmd(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

/** ETA dòng PO: DB → quotationItemId → báo giá NCC theo dòng PR → ngày mong muốn PR. */
export function resolvePoLineExpectedDeliveryYmd(input: {
  expectedDeliveryDate: Date | null;
  quotationItemId: string | null;
  purchaseRequestItemId: string;
  quotationDeliveryByQuotationItemId: Map<string, string>;
  quotationDeliveryByPrItemId: Map<string, string>;
  desiredDeliveryDate?: Date | null;
}): string | null {
  const stored = isoDateOnlyYmd(input.expectedDeliveryDate);
  if (stored) return stored;

  if (input.quotationItemId) {
    const fromQi = input.quotationDeliveryByQuotationItemId.get(input.quotationItemId);
    if (fromQi) return fromQi;
  }

  const fromPrSelection = input.quotationDeliveryByPrItemId.get(input.purchaseRequestItemId);
  if (fromPrSelection) return fromPrSelection;

  return isoDateOnlyYmd(input.desiredDeliveryDate);
}

export function buildQuotationDeliveryMaps(
  selections: Array<{
    purchaseRequestItemId: string | null;
    quotation: {
      items: Array<{
        id: string;
        purchaseRequestItemId: string | null;
        deliveryDate: Date | null;
      }>;
    };
  }>
): {
  byQuotationItemId: Map<string, string>;
  byPrItemId: Map<string, string>;
} {
  const byQuotationItemId = new Map<string, string>();
  const byPrItemId = new Map<string, string>();

  for (const sel of selections) {
    for (const it of sel.quotation.items) {
      const ymd = isoDateOnlyYmd(it.deliveryDate);
      if (!ymd) continue;
      byQuotationItemId.set(it.id, ymd);
      const prItemId = it.purchaseRequestItemId ?? sel.purchaseRequestItemId;
      if (prItemId) byPrItemId.set(prItemId, ymd);
    }
  }

  return { byQuotationItemId, byPrItemId };
}

/** Ghi ETA từ báo giá vào POItem chưa có expectedDeliveryDate (PO tạo trước khi có logic copy ETA). */
export async function backfillPoLineEtaFromQuotations(opts?: {
  dryRun?: boolean;
}): Promise<{ scanned: number; updated: number; skipped: number }> {
  const dryRun = opts?.dryRun ?? false;

  const poItems = await prisma.pOItem.findMany({
    where: {
      expectedDeliveryDate: null,
      purchaseOrder: { deletedAt: null },
    },
    select: {
      id: true,
      quotationItemId: true,
      purchaseRequestItemId: true,
      purchaseOrder: {
        select: {
          id: true,
          supplierId: true,
          purchaseRequestId: true,
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  const prIds = [...new Set(poItems.map((i) => i.purchaseOrder.purchaseRequestId))];
  const selectionsByPr = new Map<
    string,
    Awaited<ReturnType<typeof loadSelectionsForPr>>
  >();

  for (const prId of prIds) {
    selectionsByPr.set(prId, await loadSelectionsForPr(prId));
  }

  const prItemDates = await prisma.purchaseRequestItem.findMany({
    where: { id: { in: poItems.map((i) => i.purchaseRequestItemId) } },
    select: { id: true, desiredDeliveryDate: true },
  });
  const desiredByPrItem = new Map(
    prItemDates.map((r) => [r.id, r.desiredDeliveryDate])
  );

  for (const row of poItems) {
    const { purchaseOrder: po } = row;
    const selections = selectionsByPr.get(po.purchaseRequestId) ?? [];
    const supplierSelections = selections.filter(
      (s) => s.quotation.supplierId === po.supplierId
    );
    const maps = buildQuotationDeliveryMaps(supplierSelections);

    const ymd = resolvePoLineExpectedDeliveryYmd({
      expectedDeliveryDate: null,
      quotationItemId: row.quotationItemId,
      purchaseRequestItemId: row.purchaseRequestItemId,
      quotationDeliveryByQuotationItemId: maps.byQuotationItemId,
      quotationDeliveryByPrItemId: maps.byPrItemId,
      desiredDeliveryDate: desiredByPrItem.get(row.purchaseRequestItemId) ?? null,
    });

    if (!ymd) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.pOItem.update({
        where: { id: row.id },
        data: { expectedDeliveryDate: new Date(`${ymd}T00:00:00.000Z`) },
      });
    }
    updated++;
  }

  return { scanned: poItems.length, updated, skipped };
}

async function loadSelectionsForPr(prId: string) {
  return prisma.supplierSelection.findMany({
    where: { purchaseRequestId: prId },
    select: {
      purchaseRequestItemId: true,
      quotation: {
        select: {
          supplierId: true,
          items: {
            where: { deletedAt: null },
            select: {
              id: true,
              purchaseRequestItemId: true,
              deliveryDate: true,
            },
          },
        },
      },
    },
  });
}
