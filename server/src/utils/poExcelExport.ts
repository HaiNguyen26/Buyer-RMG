import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { inferVatPercentFromLine } from './quotationLine';
import { resolveRfqNumbersForPo } from './poRfqResolve';
import {
  computeIncomingLineDisplayStatus,
  lineReceiveCap,
  poItemLabel,
  todayDateOnlyUtc,
  toPoNum,
} from './poLineConfirmation';
import { mapSupplierTaxForPoView } from './poSupplierTax';

function computePoReceiveTotals(
  items: Array<{ id: string; qty: Prisma.Decimal; confirmedQty: Prisma.Decimal | null }>,
  receivedMap: Map<string, number>
): { received: number; cap: number } {
  let cap = 0;
  let received = 0;
  for (const it of items) {
    cap += lineReceiveCap(it.confirmedQty, it.qty);
    received += receivedMap.get(it.id) ?? 0;
  }
  return {
    received: Math.round(received * 1000) / 1000,
    cap: Math.round(cap * 1000) / 1000,
  };
}

export type PoExcelAudience = 'buyer' | 'warehouse';

export type PoExcelFlatRow = Record<string, string | number | null>;

const PO_STATUS_VI: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  ISSUED: 'Đã phát hành',
  CREATED: 'Đã tạo',
  SENT: 'Đã gửi NCC',
  CONFIRMED: 'NCC xác nhận',
  PARTIAL_RECEIVED: 'Nhận một phần',
  FULLY_RECEIVED: 'Nhận đủ',
  CANCEL_REQUESTED: 'Yêu cầu hủy',
  CANCELLED: 'Đã hủy',
  CLOSED: 'Đóng',
};

const LINE_STATUS_VI: Record<string, string> = {
  OPEN: 'Mở',
  CONFIRMED: 'NCC confirm',
  PARTIAL: 'Nhận một phần',
  FULLY_RECEIVED: 'Nhận đủ',
  CANCELLED: 'Đã hủy',
};

const INCOMING_STATUS_VI: Record<string, string> = {
  AwaitingConfirm: 'Chờ confirm',
  Incoming: 'Incoming',
  Delayed: 'Trễ ETA',
  Partial: 'Partial',
  Received: 'Đã nhận đủ',
};

export const PO_EXCEL_HEADERS: string[] = [
  'Số PO',
  'Trạng thái PO',
  'Mã PR',
  'RFQ',
  'Buyer',
  'Người duyệt',
  'Ngày tạo PO',
  'Ngày gửi duyệt',
  'Ngày duyệt',
  'Ngày gửi NCC',
  'Ngày NCC xác nhận',
  'Mã NCC',
  'Tên NCC',
  'MST NCC',
  'Địa chỉ NCC',
  'SĐT NCC',
  'Tổng tiền PO',
  'Loại tiền',
  'Điều kiện thanh toán',
  'Incoterms',
  'Địa chỉ giao hàng',
  'Mã dự án',
  'Ngày giao PO',
  'Ngày giao baseline PR',
  'Ghi chú PO',
  'Ngân sách PR',
  'STT dòng',
  'Mã vật tư',
  'Hãng',
  'Mô tả dòng',
  'SL đặt',
  'ĐVT',
  'Đơn giá',
  'VAT %',
  'Thành tiền dòng',
  'SL confirm NCC',
  'ETA dòng',
  'Ngày confirm dòng',
  'Đã nhận kho',
  'Còn lại',
  'Trạng thái dòng',
  'Trạng thái incoming (dòng)',
  'Tiến độ PO (đã nhận/cap)',
  'Mã GRN đã tạo',
];

const poExportInclude = {
  purchaseRequest: {
    select: { id: true, prNumber: true, totalAmount: true, currency: true, requiredDate: true },
  },
  supplier: true,
  createdBy: { select: { username: true, fullName: true } },
  items: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      purchaseRequestItem: {
        select: { partNo: true, manufacturer: true, description: true, unit: true },
      },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

export type PoForExcelExport = Prisma.PurchaseOrderGetPayload<{ include: typeof poExportInclude }>;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function fmtNum(n: number | null | undefined, digits = 3): string | number {
  if (n == null || !Number.isFinite(n)) return '';
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

async function getReceivedByPoItemIds(poItemIds: string[]): Promise<Map<string, number>> {
  if (!poItemIds.length) return new Map();
  const rows = await prisma.goodsReceiptLine.groupBy({
    by: ['poItemId'],
    where: { poItemId: { in: poItemIds } },
    _sum: { qtyReceived: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.poItemId, toPoNum(row._sum.qtyReceived));
  }
  return map;
}

async function getApproverUsernames(approvedByIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(approvedByIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, fullName: true },
  });
  return new Map(
    users.map((u) => [u.id, u.fullName?.trim() || u.username || ''])
  );
}

async function getVatByQuotationItemIds(ids: string[]): Promise<Map<string, number | null>> {
  if (!ids.length) return new Map();
  const items = await prisma.quotationItem.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, vatPercent: true },
  });
  return new Map(
    items.map((qi) => [qi.id, qi.vatPercent != null ? Number(qi.vatPercent) : null])
  );
}

async function buildPoGrnNumbersByPoId(poIds: string[]): Promise<Record<string, string>> {
  if (!poIds.length) return {};
  const grns = await prisma.goodsReceipt.findMany({
    where: { purchaseOrderId: { in: poIds } },
    orderBy: [{ receivedAt: 'asc' }, { grnNumber: 'asc' }],
    select: { purchaseOrderId: true, grnNumber: true },
  });
  const out: Record<string, string[]> = {};
  for (const g of grns) {
    (out[g.purchaseOrderId] ??= []).push(g.grnNumber);
  }
  const flat: Record<string, string> = {};
  for (const [id, nums] of Object.entries(out)) {
    flat[id] = nums.join(', ');
  }
  return flat;
}

export async function fetchPosForExcelExport(where: Prisma.PurchaseOrderWhereInput): Promise<PoForExcelExport[]> {
  return prisma.purchaseOrder.findMany({
    where: { ...where, deletedAt: null },
    include: poExportInclude,
    orderBy: [{ updatedAt: 'desc' }, { poNumber: 'desc' }],
    take: 500,
  });
}

export async function buildPoExcelFlatRows(
  pos: PoForExcelExport[],
  audience: PoExcelAudience
): Promise<PoExcelFlatRow[]> {
  if (!pos.length) return [];

  const allItemIds = pos.flatMap((p) => p.items.map((i) => i.id));
  const receivedMap = await getReceivedByPoItemIds(allItemIds);
  const approverMap = await getApproverUsernames(
    pos.map((p) => p.approvedById).filter((id): id is string => Boolean(id))
  );
  const quotationItemIds = pos
    .flatMap((p) => p.items.map((i) => i.quotationItemId))
    .filter((id): id is string => Boolean(id));
  const vatMap = await getVatByQuotationItemIds(quotationItemIds);
  const grnByPo =
    audience === 'warehouse' ? await buildPoGrnNumbersByPoId(pos.map((p) => p.id)) : {};
  const today = todayDateOnlyUtc();

  const rows: PoExcelFlatRow[] = [];

  for (const po of pos) {
    const rfqNumbers = await resolveRfqNumbersForPo(
      po.purchaseRequestId,
      po.items.map((i) => i.quotationItemId)
    );
    const supplier = mapSupplierTaxForPoView(po.supplier, po.buyerSupplierTaxCode);
    const buyerName = po.createdBy?.fullName?.trim() || po.createdBy?.username || '';
    const approver = po.approvedById ? approverMap.get(po.approvedById) ?? '' : '';
    const deliveryDate = po.deliveryDate ?? po.purchaseRequest.requiredDate;
    const baselineDelivery = po.purchaseRequest.requiredDate;
    const activeItems = po.items.filter((i) => i.lineStatus !== 'CANCELLED');
    const progress = computePoReceiveTotals(
      activeItems.map((i) => ({
        id: i.id,
        qty: i.qty,
        confirmedQty: i.confirmedQty,
      })),
      receivedMap
    );
    const progressLabel =
      progress.cap > 0 ? `${fmtNum(progress.received)}/${fmtNum(progress.cap)}` : '';

    for (const it of po.items) {
      const received = receivedMap.get(it.id) ?? 0;
      const confirmed = it.confirmedQty != null ? toPoNum(it.confirmedQty) : null;
      const ordered = toPoNum(it.qty);
      const remaining =
        confirmed != null
          ? Math.max(0, confirmed - received)
          : Math.max(0, ordered - received);
      const expectedDate = it.expectedDeliveryDate
        ? it.expectedDeliveryDate.toISOString().slice(0, 10)
        : deliveryDate
          ? deliveryDate.toISOString().slice(0, 10)
          : null;

      let incomingLabel = '';
      if (audience === 'warehouse') {
        const displayStatus = computeIncomingLineDisplayStatus({
          poHeaderStatus: po.status,
          confirmedQty: confirmed,
          receivedQty: received,
          expectedDate,
          today,
        });
        incomingLabel = INCOMING_STATUS_VI[displayStatus] ?? displayStatus;
      }

      const vatFromQ =
        it.quotationItemId != null ? vatMap.get(it.quotationItemId) ?? null : null;
      const vatPercent =
        vatFromQ != null
          ? vatFromQ
          : inferVatPercentFromLine(ordered, Number(it.unitPrice), Number(it.amount));

      rows.push({
        'Số PO': po.poNumber,
        'Trạng thái PO': PO_STATUS_VI[po.status] ?? po.status,
        'Mã PR': po.purchaseRequest.prNumber,
        RFQ: rfqNumbers.length ? rfqNumbers.join(', ') : '',
        Buyer: buyerName,
        'Người duyệt': approver,
        'Ngày tạo PO': fmtDateTime(po.createdAt),
        'Ngày gửi duyệt': fmtDateTime(po.submittedAt),
        'Ngày duyệt': fmtDateTime(po.approvedAt),
        'Ngày gửi NCC': fmtDateTime(po.issuedAt),
        'Ngày NCC xác nhận': fmtDateTime(po.supplierConfirmedAt),
        'Mã NCC': supplier.code ?? '',
        'Tên NCC': supplier.name ?? '',
        'MST NCC': supplier.taxCode ?? '',
        'Địa chỉ NCC': supplier.address ?? '',
        'SĐT NCC': supplier.phone ?? '',
        'Tổng tiền PO': Number(po.totalAmount),
        'Loại tiền': po.currency,
        'Điều kiện thanh toán': po.paymentTerms ?? '',
        Incoterms: po.incoterms ?? '',
        'Địa chỉ giao hàng': po.deliveryAddress ?? '',
        'Mã dự án': po.projectCode ?? '',
        'Ngày giao PO': fmtDate(deliveryDate),
        'Ngày giao baseline PR': fmtDate(baselineDelivery),
        'Ghi chú PO': po.note ?? '',
        'Ngân sách PR': po.purchaseRequest.totalAmount
          ? Number(po.purchaseRequest.totalAmount)
          : '',
        'STT dòng': it.lineNo,
        'Mã vật tư':
          it.purchaseRequestItem.partNo?.trim() ||
          poItemLabel(it.purchaseRequestItem.partNo, it.description, it.lineNo).split('·')[0]?.trim() ||
          '',
        Hãng: it.purchaseRequestItem.manufacturer ?? '',
        'Mô tả dòng': it.description || it.purchaseRequestItem.description || '',
        'SL đặt': ordered,
        ĐVT: it.unit || it.purchaseRequestItem.unit || '',
        'Đơn giá': Number(it.unitPrice),
        'VAT %': vatPercent != null ? vatPercent : '',
        'Thành tiền dòng': Number(it.amount),
        'SL confirm NCC': confirmed != null ? confirmed : '',
        'ETA dòng': expectedDate ? expectedDate.split('-').reverse().join('/') : '',
        'Ngày confirm dòng': fmtDateTime(it.supplierConfirmedAt),
        'Đã nhận kho': received,
        'Còn lại': remaining,
        'Trạng thái dòng': LINE_STATUS_VI[it.lineStatus] ?? it.lineStatus,
        'Trạng thái incoming (dòng)': incomingLabel,
        'Tiến độ PO (đã nhận/cap)': progressLabel,
        'Mã GRN đã tạo': grnByPo[po.id] ?? '',
      });
    }
  }

  return rows;
}

export async function writePoExcelBuffer(
  rows: PoExcelFlatRow[],
  sheetName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(PO_EXCEL_HEADERS);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    ws.addRow(PO_EXCEL_HEADERS.map((h) => row[h] ?? ''));
  }

  ws.columns = PO_EXCEL_HEADERS.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(0, 200).map((r) => String(r[h] ?? '').length)
    );
    return { width: Math.min(Math.max(maxLen + 2, 10), 48) };
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function excelContentDisposition(filename: string): string {
  return `attachment; filename="${filename}"`;
}
