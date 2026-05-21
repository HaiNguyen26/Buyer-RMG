import { Prisma } from '@prisma/client';

/** Multi-tenant: hiện tại dùng null như inventory hiện có */
export const INVENTORY_COMPANY_ID = null as string | null;

export class InsufficientStockError extends Error {
  code = 'INSUFFICIENT_STOCK' as const;
  constructor(
    message: string,
    public partCode?: string,
    public requested?: number,
    public available?: number
  ) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

type Tx = Prisma.TransactionClient;

async function logActivity(
  tx: Tx,
  params: {
    companyId: string | null;
    partInternalCode: string;
    warehouseCode: string;
    partName: string | null;
    changeType: string;
    deltaAvailable: Prisma.Decimal;
    quantityAfter: Prisma.Decimal | null;
    createdById: string | null;
    note?: string | null;
  }
) {
  await tx.inventoryActivity.create({ data: params });
}

/**
 * Giữ chỗ cho một dòng phiếu xuất: tạo InventoryReservation + tăng quantityReserved.
 * refId = stock_issue_item.id
 */
export async function allocateReservationsForIssueItem(
  tx: Tx,
  params: {
    issueItemId: string;
    partInternalCode: string;
    qty: number;
    userId: string | null;
  }
): Promise<void> {
  const { issueItemId, userId } = params;
  const part = params.partInternalCode.trim();
  if (!part) {
    throw new InsufficientStockError('Thiếu mã vật tư');
  }
  const qty = Number(params.qty);
  if (qty <= 0) return;

  let remaining = qty;
  const balances = await tx.inventoryBalance.findMany({
    where: { partInternalCode: part, companyId: INVENTORY_COMPANY_ID },
    orderBy: [{ quantityAvailable: 'desc' }, { updatedAt: 'asc' }],
  });

  for (const b of balances) {
    if (remaining <= 0) break;
    const fresh = await tx.inventoryBalance.findUnique({ where: { id: b.id } });
    if (!fresh) continue;
    const rowAvail = Math.max(
      0,
      Number(fresh.quantityAvailable) - Number(fresh.quantityReserved)
    );
    if (rowAvail <= 0) continue;
    const alloc = Math.min(remaining, rowAvail);
    const newRes = Number(fresh.quantityReserved) + alloc;
    await tx.inventoryBalance.update({
      where: { id: fresh.id },
      data: { quantityReserved: new Prisma.Decimal(newRes) },
    });
    await tx.inventoryReservation.create({
      data: {
        companyId: INVENTORY_COMPANY_ID,
        refType: 'ISSUE',
        refId: issueItemId,
        inventoryBalanceId: fresh.id,
        qty: new Prisma.Decimal(alloc),
      },
    });
    await logActivity(tx, {
      companyId: INVENTORY_COMPANY_ID,
      partInternalCode: part,
      warehouseCode: fresh.warehouseCode,
      partName: fresh.partName,
      changeType: 'ISSUE_RESERVE',
      deltaAvailable: new Prisma.Decimal(0),
      quantityAfter: fresh.quantityAvailable,
      createdById: userId,
      note: `Giữ chỗ phiếu xuất: ${alloc}`,
    });
    remaining -= alloc;
  }

  if (remaining > 0) {
    const totalAvail = balances.reduce((s, row) => {
      return s + Math.max(0, Number(row.quantityAvailable) - Number(row.quantityReserved));
    }, 0);
    throw new InsufficientStockError(
      `Không đủ tồn cho ${part}: cần ${qty}, khả dụng ~${totalAvail}`,
      part,
      qty,
      totalAvail
    );
  }
}

/** Nhả toàn bộ reservation gắn với một dòng phiếu xuất */
export async function releaseReservationsForIssueItem(
  tx: Tx,
  issueItemId: string,
  userId: string | null,
  note?: string
): Promise<void> {
  const rows = await tx.inventoryReservation.findMany({
    where: { refType: 'ISSUE', refId: issueItemId },
  });
  for (const r of rows) {
    const bal = await tx.inventoryBalance.findUnique({ where: { id: r.inventoryBalanceId } });
    if (!bal) {
      await tx.inventoryReservation.delete({ where: { id: r.id } });
      continue;
    }
    const q = Number(r.qty);
    const newRes = Math.max(0, Number(bal.quantityReserved) - q);
    await tx.inventoryBalance.update({
      where: { id: bal.id },
      data: { quantityReserved: new Prisma.Decimal(newRes) },
    });
    await logActivity(tx, {
      companyId: INVENTORY_COMPANY_ID,
      partInternalCode: bal.partInternalCode,
      warehouseCode: bal.warehouseCode,
      partName: bal.partName,
      changeType: 'ISSUE_RELEASE',
      deltaAvailable: new Prisma.Decimal(0),
      quantityAfter: bal.quantityAvailable,
      createdById: userId,
      note: note ?? `Nhả giữ chỗ phiếu xuất: ${q}`,
    });
    await tx.inventoryReservation.delete({ where: { id: r.id } });
  }
}

export async function releaseAllReservationsForStockIssue(
  tx: Tx,
  stockIssueId: string,
  userId: string | null,
  note?: string
): Promise<void> {
  const items = await tx.stockIssueItem.findMany({
    where: { stockIssueId, deletedAt: null },
    select: { id: true },
  });
  for (const it of items) {
    await releaseReservationsForIssueItem(tx, it.id, userId, note);
  }
}

/** Đổi số lượng dòng khi phiếu đang RESERVED: nhả cũ + giữ mới */
export async function adjustIssueItemReservations(
  tx: Tx,
  params: {
    issueItemId: string;
    partInternalCode: string;
    newQty: number;
    userId: string | null;
  }
): Promise<void> {
  await releaseReservationsForIssueItem(tx, params.issueItemId, params.userId, 'Điều chỉnh SL');
  await allocateReservationsForIssueItem(tx, {
    issueItemId: params.issueItemId,
    partInternalCode: params.partInternalCode,
    qty: params.newQty,
    userId: params.userId,
  });
}

/**
 * Xuất một phần hoặc toàn bộ một dòng phiếu (theo reservation FIFO).
 * Cập nhật qty_shipped trên stock_issue_item.
 */
export async function fulfillIssueItemShipment(
  tx: Tx,
  params: { issueItemId: string; shipQty: number; userId: string | null }
): Promise<void> {
  const { issueItemId, userId } = params;
  const shipQtyRaw = Number(params.shipQty);
  if (!Number.isFinite(shipQtyRaw) || shipQtyRaw <= 0) return;

  const item = await tx.stockIssueItem.findFirst({
    where: { id: issueItemId, deletedAt: null },
  });
  if (!item) {
    throw new InsufficientStockError('Không tìm thấy dòng phiếu xuất');
  }

  const lineQty = Number(item.qty);
  const already = Number(item.qtyShipped ?? 0);
  const maxShip = lineQty - already;
  if (shipQtyRaw > maxShip + 1e-9) {
    throw new InsufficientStockError(
      `Số lượng xuất vượt quá còn lại (tối đa ${maxShip})`,
      item.partInternalCode,
      shipQtyRaw,
      maxShip
    );
  }

  let remaining = shipQtyRaw;
  const resRows = await tx.inventoryReservation.findMany({
    where: { refType: 'ISSUE', refId: issueItemId },
    orderBy: { createdAt: 'asc' },
  });
  const totalRes = resRows.reduce((s, r) => s + Number(r.qty), 0);
  if (remaining > totalRes + 1e-9) {
    throw new InsufficientStockError(
      `Không đủ lượng đã giữ để xuất: cần ${remaining}, đang giữ ${totalRes}`,
      item.partInternalCode,
      remaining,
      totalRes
    );
  }

  for (const r of resRows) {
    if (remaining <= 1e-9) break;
    const rQty = Number(r.qty);
    const take = Math.min(remaining, rQty);
    const bal = await tx.inventoryBalance.findUnique({ where: { id: r.inventoryBalanceId } });
    if (!bal) {
      await tx.inventoryReservation.delete({ where: { id: r.id } });
      remaining -= take;
      continue;
    }
    const newAvail = Math.max(0, Number(bal.quantityAvailable) - take);
    const newRes = Math.max(0, Number(bal.quantityReserved) - take);
    await tx.inventoryBalance.update({
      where: { id: bal.id },
      data: {
        quantityAvailable: new Prisma.Decimal(newAvail),
        quantityReserved: new Prisma.Decimal(newRes),
      },
    });
    await logActivity(tx, {
      companyId: INVENTORY_COMPANY_ID,
      partInternalCode: bal.partInternalCode,
      warehouseCode: bal.warehouseCode,
      partName: bal.partName,
      changeType: 'ISSUE_SHIP',
      deltaAvailable: new Prisma.Decimal(-take),
      quantityAfter: new Prisma.Decimal(newAvail),
      createdById: userId,
      note: `Xuất kho phiếu xuất: ${take}`,
    });
    if (take >= rQty - 1e-9) {
      await tx.inventoryReservation.delete({ where: { id: r.id } });
    } else {
      await tx.inventoryReservation.update({
        where: { id: r.id },
        data: { qty: new Prisma.Decimal(rQty - take) },
      });
    }
    remaining -= take;
  }

  await tx.stockIssueItem.update({
    where: { id: issueItemId },
    data: { qtyShipped: new Prisma.Decimal(already + shipQtyRaw) },
  });
}

/**
 * Xuất toàn bộ phần còn lại của từng dòng (legacy / nút xuất hết).
 */
export async function fulfillStockIssueShipments(
  tx: Tx,
  stockIssueId: string,
  userId: string | null
): Promise<void> {
  const items = await tx.stockIssueItem.findMany({
    where: { stockIssueId, deletedAt: null },
    select: { id: true, qty: true, qtyShipped: true },
  });
  for (const it of items) {
    const rem = Number(it.qty) - Number(it.qtyShipped ?? 0);
    if (rem > 1e-9) {
      await fulfillIssueItemShipment(tx, { issueItemId: it.id, shipQty: rem, userId });
    }
  }
}
