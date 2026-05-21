import { FastifyReply } from 'fastify';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { INVENTORY_COMPANY_ID } from '../utils/inventoryReservation';

const ROLES = ['WAREHOUSE', 'SYSTEM_ADMIN'];
const prismaModels = ((Prisma as unknown as { dmmf?: { datamodel?: { models?: Array<{ name: string; fields?: Array<{ name: string }> }> } } }).dmmf?.datamodel?.models ?? []);
const PART_MASTER_HAS_COMPANY_ID = prismaModels
  .find((m) => m.name === 'PartMaster')
  ?.fields?.some((f) => f.name === 'companyId') ?? true;
const INVENTORY_BALANCE_HAS_COMPANY_ID = prismaModels
  .find((m) => m.name === 'InventoryBalance')
  ?.fields?.some((f) => f.name === 'companyId') ?? true;

/** Lỗi nghiệp vụ khi lưu tồn — trả 400 thay vì 500 */
class InventorySaveUserError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = 'SAVE_INVENTORY_VALIDATION'
  ) {
    super(message);
    this.name = 'InventorySaveUserError';
  }
}

async function createInventoryActivitySafe(
  _tx: Prisma.TransactionClient,
  request: AuthenticatedRequest,
  data: {
    companyId: string | null;
    partInternalCode: string;
    warehouseCode: string;
    partName: string | null;
    changeType: string;
    deltaAvailable: Prisma.Decimal;
    quantityAfter: Prisma.Decimal | null;
    createdById: string | null;
    note?: string;
  }
) {
  // Tạm thời bỏ ghi activity để tránh fail lưu tồn kho khi Prisma client/schema lệch.
  // Có thể bật lại sau khi migrate + prisma generate ổn định.
  request.log.warn(
    { partInternalCode: data.partInternalCode, warehouseCode: data.warehouseCode },
    'Inventory activity logging is temporarily disabled'
  );
}

function allow(userRole: string | undefined): boolean {
  return !!userRole && ROLES.includes(userRole);
}

export type InventoryRowInput = {
  partInternalCode: string;
  partName?: string;
  unit?: string;
  quantityAvailable: number;
  warehouseCode: string;
  location?: string;
  /** Ngưỡng Min — optional; dùng cảnh báo low stock */
  minStock?: number | null;
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

/** Đọc giá trị hiển thị từ ô Excel (hỗ trợ công thức, rich text). */
function cellDisplayString(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object' && v !== null) {
    if ('text' in v && typeof (v as { text: unknown }).text === 'string') {
      return String((v as { text: string }).text).trim();
    }
    if ('result' in v && (v as { result?: unknown }).result != null) {
      const r = (v as { result: string | number | boolean | Date }).result;
      if (r instanceof Date) return String(r.getTime());
      return String(r).trim();
    }
    if (
      'richText' in v &&
      Array.isArray((v as { richText: { text: string }[] }).richText)
    ) {
      return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('').trim();
    }
  }
  return String(v).trim();
}

/**
 * Chuẩn cột import (dòng 1): part_name, part_internal_code, unit, quantity_available,
 * warehouse_code, location, min_stock — thứ tự cột tự do; map theo tên header.
 */
export function mapExcelHeaderToKey(cell: string): keyof InventoryRowInput | 'quantity' | null {
  const n = normalizeHeader(cell);
  const map: Record<string, keyof InventoryRowInput | 'quantity'> = {
    part_internal_code: 'partInternalCode',
    part_code: 'partInternalCode',
    ma_part: 'partInternalCode',
    mapart: 'partInternalCode',
    part_name: 'partName',
    ten_part: 'partName',
    ten: 'partName',
    unit: 'unit',
    dvt: 'unit',
    quantity_available: 'quantity',
    quantityavail: 'quantity',
    qty_available: 'quantity',
    available_qty: 'quantity',
    quantity_on_hand: 'quantity',
    stock: 'quantity',
    qty: 'quantity',
    sl: 'quantity',
    ton: 'quantity',
    ton_kho: 'quantity',
    so_luong_ton: 'quantity',
    soluongton: 'quantity',
    quantity: 'quantity',
    so_luong: 'quantity',
    soluong: 'quantity',
    warehouse_code: 'warehouseCode',
    warehouse: 'warehouseCode',
    ma_kho: 'warehouseCode',
    makho: 'warehouseCode',
    kho: 'warehouseCode',
    kho_hang: 'warehouseCode',
    khohang: 'warehouseCode',
    wh: 'warehouseCode',
    wh_code: 'warehouseCode',
    ma_ck: 'warehouseCode',
    site: 'warehouseCode',
    branch_wh: 'warehouseCode',
    min_stock: 'minStock',
    minstock: 'minStock',
    reorder_level: 'minStock',
    reorder: 'minStock',
    min: 'minStock',
    location: 'location',
    vi_tri: 'location',
    vitri: 'location',
  };
  return (map[n] as any) ?? null;
}

function activityTypeLabel(changeType: string): string {
  switch (changeType) {
    case 'IMPORT':
      return 'nhập từ Excel';
    case 'RESERVE':
      return 'giữ chỗ PR';
    case 'RELEASE':
      return 'nhả giữ chỗ';
    case 'ISSUE_RESERVE':
      return 'giữ chỗ phiếu xuất';
    case 'ISSUE_RELEASE':
      return 'nhả giữ chỗ phiếu xuất';
    case 'ISSUE_SHIP':
      return 'xuất kho (phiếu xuất)';
    case 'MANUAL_SAVE':
      return 'cập nhật thủ công';
    default:
      return changeType.toLowerCase();
  }
}

export async function getWarehouseDashboard(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  const companyId = null as string | null;

  const all = await prisma.inventoryBalance.findMany({
    where: { companyId },
  });

  const totalItems = all.length;
  const totalQuantity = all.reduce((s, r) => s + Number(r.quantityAvailable), 0);
  const outOfStock = all.filter((r) => Number(r.quantityAvailable) <= 0).length;

  const isLow = (r: (typeof all)[0]) => {
    const q = Number(r.quantityAvailable);
    if (q <= 0) return false;
    if (r.minStock == null) return false;
    return q <= Number(r.minStock);
  };

  const lowStockCount = all.filter(isLow).length;

  const lowStock = all
    .filter(isLow)
    .sort((a, b) => Number(a.quantityAvailable) - Number(b.quantityAvailable))
    .slice(0, 25)
    .map((r) => ({
      partCode: r.partInternalCode,
      name: r.partName ?? r.partInternalCode,
      qty: Number(r.quantityAvailable),
      min: Number(r.minStock),
      warehouse: r.warehouseCode,
    }));

  const activities = await prisma.inventoryActivity.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const recentActivity = activities.map((a) => {
    const d = Number(a.deltaAvailable);
    const sign = d > 0 ? '+' : '';
    const label = activityTypeLabel(a.changeType);
    const name = a.partName || a.partInternalCode;
    return {
      id: a.id,
      at: a.createdAt.toISOString(),
      delta: d,
      partCode: a.partInternalCode,
      partName: a.partName,
      warehouse: a.warehouseCode,
      changeType: a.changeType,
      label,
      text: `${sign}${d} ${name} (${label})`,
    };
  });

  return reply.send({
    stats: {
      totalItems,
      totalQuantity,
      lowStockItems: lowStockCount,
      outOfStock,
    },
    lowStock,
    recentActivity,
  });
}

export async function listInventory(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  const companyId = null as string | null;
  const rows = await prisma.inventoryBalance.findMany({
    where: { companyId },
    orderBy: [{ warehouseCode: 'asc' }, { partInternalCode: 'asc' }],
  });
  return reply.send({
    rows: rows.map((r) => ({
      id: r.id,
      partCode: r.partInternalCode,
      partName: r.partName ?? '',
      unit: r.unit,
      quantity: Number(r.quantityAvailable),
      quantityReserved: Number(r.quantityReserved),
      minStock: r.minStock != null ? Number(r.minStock) : null,
      warehouse: r.warehouseCode,
      location: r.location ?? '',
    })),
  });
}

export async function lookupPart(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  const code = String((request.query as { code?: string })?.code ?? '').trim();
  if (!code) return reply.send(null);
  const companyId = null as string | null;

  const pm = await prisma.partMaster.findFirst({
    where: { partInternalCode: code, companyId },
  });
  if (pm) return reply.send({ partName: pm.partName, unit: pm.unit });

  const inv = await prisma.inventoryBalance.findFirst({
    where: { partInternalCode: code, companyId },
    orderBy: { updatedAt: 'desc' },
  });
  if (inv) return reply.send({ partName: inv.partName ?? '', unit: inv.unit });

  return reply.send(null);
}

export function validateRowsPayload(rows: InventoryRowInput[]): { index: number; errors: string[] }[] {
  const issues: { index: number; errors: string[] }[] = [];
  const keyCount = new Map<string, number>();
  rows.forEach((r) => {
    const code = (r.partInternalCode ?? '').trim().toUpperCase();
    const wh = (r.warehouseCode ?? '').trim().toUpperCase();
    if (code && wh) {
      const k = `${code}|${wh}`;
      keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    }
  });

  rows.forEach((r, i) => {
    const err: string[] = [];
    const code = (r.partInternalCode ?? '').trim();
    const wh = (r.warehouseCode ?? '').trim();
    const unit = (r.unit ?? '').trim();
    const qty = Number(r.quantityAvailable);
    if (!code) err.push('MISSING_PART');
    if (!wh) err.push('MISSING_WAREHOUSE');
    if (!unit) err.push('MISSING_UNIT');
    if (Number.isNaN(qty) || qty < 0 || !Number.isFinite(qty)) err.push('INVALID_QTY');
    if (r.minStock != null && r.minStock !== undefined) {
      const m = Number(r.minStock);
      if (Number.isNaN(m) || m < 0) err.push('INVALID_MIN');
    }
    const k = `${code.toUpperCase()}|${wh.toUpperCase()}`;
    if (code && wh && (keyCount.get(k) ?? 0) > 1) err.push('DUPLICATE_KEY');
    if (err.length) issues.push({ index: i, errors: err });
  });
  return issues;
}

export async function validateInventory(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  const body = request.body as { rows?: InventoryRowInput[] };
  const rows = body.rows ?? [];
  const issues = validateRowsPayload(rows);
  return reply.send({
    ok: issues.length === 0,
    issues,
  });
}

export async function saveInventory(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  const body = request.body as { rows?: InventoryRowInput[]; source?: string };
  const rows = body.rows ?? [];
  const changeType = body.source === 'import' ? 'IMPORT' : 'MANUAL_SAVE';
  const userId = request.user?.userId ?? null;
  const issues = validateRowsPayload(rows);
  if (issues.length) {
    return reply.code(400).send({ error: 'Validation failed', issues });
  }

  const companyId = INVENTORY_COMPANY_ID;

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const r of rows) {
        const code = (r.partInternalCode ?? '').trim();
        const wh = (r.warehouseCode ?? '').trim();
        const unit = (r.unit ?? '').trim();
        const partName = (r.partName?.trim() || code) as string;
        const newQty = Number(r.quantityAvailable);
        const qty = new Prisma.Decimal(newQty);
        const loc = r.location?.trim() || null;
        const minDec =
          r.minStock != null && r.minStock !== undefined && !Number.isNaN(Number(r.minStock))
            ? new Prisma.Decimal(r.minStock)
            : null;

        // Không dùng upsert khi companyId = null: Prisma/SQL không xử lý ổn định @@unique có nullable.
        const pmWhere = PART_MASTER_HAS_COMPANY_ID
          ? { partInternalCode: code, companyId }
          : { partInternalCode: code };
        const existingPm = await tx.partMaster.findFirst({ where: pmWhere });
        if (existingPm) {
          await tx.partMaster.update({
            where: { id: existingPm.id },
            data: { partName, unit },
          });
        } else {
          const pmCreateData = PART_MASTER_HAS_COMPANY_ID
            ? { partInternalCode: code, partName, unit, companyId }
            : { partInternalCode: code, partName, unit };
          await tx.partMaster.create({
            data: pmCreateData,
          });
        }

        const invWhere = INVENTORY_BALANCE_HAS_COMPANY_ID
          ? { partInternalCode: code, warehouseCode: wh, companyId }
          : { partInternalCode: code, warehouseCode: wh };
        const existingInv = await tx.inventoryBalance.findFirst({ where: invWhere });
        const oldQty = existingInv ? Number(existingInv.quantityAvailable) : 0;
        const reserved = existingInv ? Number(existingInv.quantityReserved) : 0;
        if (newQty < reserved) {
          throw new InventorySaveUserError(
            `Tồn khả dụng (${newQty}) không được nhỏ hơn số đang giữ chỗ (${reserved}) — ${code} / ${wh}`
          );
        }

        if (existingInv) {
          await tx.inventoryBalance.update({
            where: { id: existingInv.id },
            data: {
              partName,
              unit,
              quantityAvailable: qty,
              location: loc,
              minStock: minDec,
            },
          });
        } else {
          const invCreateData = INVENTORY_BALANCE_HAS_COMPANY_ID
            ? {
                partInternalCode: code,
                partName,
                unit,
                quantityAvailable: qty,
                quantityReserved: new Prisma.Decimal(0),
                warehouseCode: wh,
                location: loc,
                minStock: minDec,
                companyId,
              }
            : {
                partInternalCode: code,
                partName,
                unit,
                quantityAvailable: qty,
                quantityReserved: new Prisma.Decimal(0),
                warehouseCode: wh,
                location: loc,
                minStock: minDec,
              };
          await tx.inventoryBalance.create({
            data: invCreateData,
          });
        }

        const delta = newQty - oldQty;
        if (!existingInv && newQty !== 0) {
          await createInventoryActivitySafe(tx, request, {
            companyId,
            partInternalCode: code,
            warehouseCode: wh,
            partName,
            changeType,
            deltaAvailable: new Prisma.Decimal(newQty),
            quantityAfter: qty,
            createdById: userId,
            note: 'Nhap ton moi',
          });
        } else if (existingInv && delta !== 0) {
          await createInventoryActivitySafe(tx, request, {
            companyId,
            partInternalCode: code,
            warehouseCode: wh,
            partName,
            changeType,
            deltaAvailable: new Prisma.Decimal(delta),
            quantityAfter: qty,
            createdById: userId,
          });
        }
        }
      },
      {
        // Import/save nhiều dòng có thể vượt default interactive timeout (5s).
        maxWait: 10_000,
        timeout: 120_000,
      }
    );

    return reply.send({ success: true, saved: rows.length });
  } catch (e) {
    if (e instanceof InventorySaveUserError) {
      return reply.code(e.statusCode).send({ error: e.message, code: e.code });
    }
    request.log.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2022' || e.code === 'P2021') {
        return reply.code(503).send({
          error:
            'Database chưa migrate (thiếu cột/bảng tồn kho). Chạy trong thư mục server: npx prisma migrate deploy',
          code: e.code,
        });
      }
      if (e.code === 'P2002') {
        return reply.code(409).send({
          error: 'Trùng dữ liệu tồn kho (mã part + kho). Kiểm tra bản ghi trùng hoặc import.',
          code: e.code,
        });
      }
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return reply.code(500).send({
      error: 'Lưu tồn kho thất bại',
      details: process.env.NODE_ENV !== 'production' ? msg : undefined,
    });
  }
}

export async function downloadTemplate(_request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(_request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventory');
  ws.addRow([
    'part_name',
    'part_internal_code',
    'unit',
    'quantity_available',
    'warehouse_code',
    'location',
    'min_stock',
  ]);
  ws.getRow(1).font = { bold: true };
  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 10 },
    { width: 18 },
    { width: 16 },
    { width: 20 },
    { width: 12 },
  ];
  ws.addRow(['Motor Servo', 'P-001', 'pcs', 10, 'WH-HCM', 'A-01', 5]);

  const buf = await wb.xlsx.writeBuffer();
  reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename=inventory_import_template.xlsx');
  return reply.send(Buffer.from(buf));
}

type ImportRowParseOptions = {
  /** Gán khi ô / cột kho trống (file BOM thường không có kho) */
  defaultWarehouse?: string;
  /** Gán khi thiếu đơn vị, ví dụ pcs */
  defaultUnit?: string;
};

function parseExcelRowToInput(
  colMap: Map<string, number>,
  row: ExcelJS.Row,
  options?: ImportRowParseOptions
): InventoryRowInput {
  const g = (key: string): string => {
    const c = colMap.get(key);
    if (!c) return '';
    const cell = row.getCell(c);
    return cellDisplayString(cell);
  };

  const qRaw = g('quantity');
  const quantity = qRaw === '' ? NaN : Number(String(qRaw).replace(',', '.'));
  const mRaw = g('minStock');
  let minStock: number | null | undefined = undefined;
  if (mRaw !== '') {
    const m = Number(String(mRaw).replace(',', '.'));
    minStock = Number.isNaN(m) ? null : m;
  }

  let warehouseCode = g('warehouseCode').trim();
  if (!warehouseCode && options?.defaultWarehouse?.trim()) {
    warehouseCode = options.defaultWarehouse.trim();
  }

  let unit = g('unit').trim();
  if (!unit && options?.defaultUnit?.trim()) {
    unit = options.defaultUnit.trim();
  }

  return {
    partInternalCode: g('partInternalCode'),
    partName: g('partName') || undefined,
    unit: unit || undefined,
    quantityAvailable: quantity,
    minStock,
    warehouseCode,
    location: g('location')?.trim() || undefined,
  };
}

function importFallbackOptions(request: AuthenticatedRequest): ImportRowParseOptions {
  const q = request.query as { defaultWarehouse?: string; defaultUnit?: string };
  const fromQueryWh = String(q?.defaultWarehouse ?? '').trim();
  const fromQueryUt = String(q?.defaultUnit ?? '').trim();
  const defaultWarehouse =
    fromQueryWh ||
    String(process.env.WAREHOUSE_IMPORT_DEFAULT ?? process.env.WAREHOUSE_DEFAULT_CODE ?? '').trim() ||
    'MAIN';
  const defaultUnit = fromQueryUt;
  return {
    defaultWarehouse,
    ...(defaultUnit ? { defaultUnit } : {}),
  };
}

export async function importPreview(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });

  const data = await request.file();
  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

  const buf = Buffer.from(await data.toBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 1) {
    return reply.code(400).send({ error: 'Empty or invalid spreadsheet' });
  }

  const headerRow = ws.getRow(1);
  const colMap = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellDisplayString(cell);
    const key = mapExcelHeaderToKey(raw || String(cell.value ?? ''));
    if (key === 'quantity') colMap.set('quantity', colNumber);
    else if (key) colMap.set(key, colNumber);
  });

  if (!colMap.has('partInternalCode')) {
    return reply.code(400).send({
      error: 'Missing part_internal_code column in header row',
    });
  }

  if (!colMap.has('quantity')) {
    return reply.code(400).send({
      error:
        'Thiếu cột số lượng tồn. Dòng tiêu đề cần một trong: quantity_available, quantity, qty, stock, ton_kho…',
    });
  }

  const importOpts = importFallbackOptions(request);

  const preview: Array<{
    rowIndex: number;
    partCode: string;
    partName: string;
    unit: string;
    quantity: number;
    minStock: number | null;
    warehouse: string;
    location: string;
    errors: string[];
  }> = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals = row.values as unknown[];
    const hasData =
      Array.isArray(vals) && vals.slice(1).some((v) => v != null && String(v).trim() !== '');
    if (!hasData) continue;

    const input = parseExcelRowToInput(colMap, row, importOpts);
    const rowIssues = validateRowsPayload([input])[0]?.errors ?? [];
    preview.push({
      rowIndex: r,
      partCode: input.partInternalCode,
      partName: input.partName ?? '',
      unit: input.unit ?? '',
      quantity: input.quantityAvailable,
      minStock:
        input.minStock != null && input.minStock !== undefined && !Number.isNaN(Number(input.minStock))
          ? Number(input.minStock)
          : null,
      warehouse: input.warehouseCode,
      location: input.location ?? '',
      errors: rowIssues,
    });
  }

  return reply.send({ preview });
}

/** Chi tiết từng phần giữ chỗ trên một dòng tồn (part + kho) — PR / dự án / phiếu xuất */
export async function listInventoryReservationDetails(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) return reply.code(403).send({ error: 'Forbidden' });

  const q = request.query as { partCode?: string; warehouseCode?: string };
  const partCode = String(q.partCode ?? '').trim();
  const warehouseCode = String(q.warehouseCode ?? '').trim();
  if (!partCode || !warehouseCode) {
    return reply.code(400).send({ error: 'Cần partCode và warehouseCode' });
  }

  try {
    const balance = await prisma.inventoryBalance.findFirst({
      where: {
        partInternalCode: partCode,
        warehouseCode,
        companyId: INVENTORY_COMPANY_ID,
      },
      select: { id: true },
    });
    if (!balance) {
      return reply.send({ lines: [] });
    }

    const reservations = await prisma.inventoryReservation.findMany({
      where: { inventoryBalanceId: balance.id, refType: 'ISSUE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!reservations.length) {
      return reply.send({ lines: [] });
    }

    const itemIds = [...new Set(reservations.map((r) => r.refId))];
    const items = await prisma.stockIssueItem.findMany({
      where: {
        id: { in: itemIds },
        deletedAt: null,
        stockIssue: { deletedAt: null },
      },
      include: {
        stockIssue: {
          include: {
            requestor: { select: { username: true, fullName: true } },
            salesPO: {
              select: { salesPONumber: true, projectCode: true, projectName: true },
            },
            purchaseRequest: {
              select: { id: true, prNumber: true, projectCode: true, projectName: true },
            },
          },
        },
      },
    });

    const itemMap = new Map(items.map((it) => [it.id, it]));
    const lines = reservations
      .map((r) => {
        const it = itemMap.get(r.refId);
        const si = it?.stockIssue;
        if (!si) return null;
        return {
          reservationId: r.id,
          qtyReserved: Number(r.qty),
          issueItemLineNo: it.lineNo,
          issueId: si.id,
          issueNumber: si.issueNumber,
          issueStatus: si.status,
          requestor: si.requestor
            ? { username: si.requestor.username, fullName: si.requestor.fullName }
            : null,
          salesPO: si.salesPO
            ? {
                salesPONumber: si.salesPO.salesPONumber,
                projectCode: si.salesPO.projectCode,
                projectName: si.salesPO.projectName,
              }
            : null,
          purchaseRequest: si.purchaseRequest
            ? {
                id: si.purchaseRequest.id,
                prNumber: si.purchaseRequest.prNumber,
                projectCode: si.purchaseRequest.projectCode,
                projectName: si.purchaseRequest.projectName,
              }
            : null,
        };
      })
      .filter(Boolean);

    return reply.send({ lines });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ error: e instanceof Error ? e.message : 'Lỗi' });
  }
}
