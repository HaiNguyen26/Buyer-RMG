import ExcelJS from 'exceljs';
import {
  buildProcurementMonitorExportData,
  type MonitorExportLifecycle,
} from './procurementMonitoring';
import { excelContentDisposition } from './poExcelExport';

export { excelContentDisposition };

const LIFECYCLE_VI: Record<MonitorExportLifecycle, string> = {
  all: 'Tất cả',
  pending: 'Đang xử lý',
  completed: 'Hoàn thành',
};

const PR_HEADERS = [
  'Số PR',
  'Phòng ban',
  'Chi nhánh',
  'Buyer',
  'Trạng thái PR',
  'Nhóm báo cáo',
  'Bước hiện tại',
  'Chi tiết bước',
  'ETA',
  'SLA',
  'Rủi ro',
  'Tiến độ (%)',
  'Số dòng',
  'Số RFQ',
  'Số PO',
  'Mua lại',
  'Ngân sách đề xuất (VND)',
] as const;

const PO_HEADERS = [
  'Số PO',
  'Số PR',
  'Chi nhánh',
  'NCC',
  'Trạng thái PO',
  'Nhóm báo cáo',
  'ETA',
  'Đã nhận',
  'Quá ETA',
] as const;

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function autoColumnWidths(ws: ExcelJS.Worksheet, headers: readonly string[], rowCount: number) {
  ws.columns = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...Array.from({ length: Math.min(rowCount, 300) }, (_, i) => {
        const row = ws.getRow(i + 2);
        const col = headers.indexOf(h) + 1;
        return String(row.getCell(col).value ?? '').length;
      })
    );
    return { width: Math.min(Math.max(maxLen + 2, 10), 42) };
  });
}

function addDataSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: readonly string[],
  rows: Array<Record<string, string | number | null>>
) {
  const ws = wb.addWorksheet(name);
  ws.addRow([...headers]);
  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    ws.addRow(headers.map((h) => row[h] ?? ''));
  }
  autoColumnWidths(ws, headers, rows.length);
  return ws;
}

export async function buildProcurementMonitorExcelBuffer(
  scope: Parameters<typeof buildProcurementMonitorExportData>[0],
  lifecycle: MonitorExportLifecycle
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await buildProcurementMonitorExportData(scope, lifecycle);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Buying-RMG';
  wb.created = new Date(data.generatedAt);

  const meta = wb.addWorksheet('Tổng quan');
  meta.addRow(['Phạm vi báo cáo', data.scopeLabel]);
  meta.addRow(['Lọc trạng thái', LIFECYCLE_VI[lifecycle]]);
  meta.addRow(['Ngày xuất', new Date(data.generatedAt).toLocaleString('vi-VN')]);
  meta.addRow(['Số PR', data.prRows.length]);
  meta.addRow(['Số PO', data.poRows.length]);
  meta.getColumn(1).width = 22;
  meta.getColumn(2).width = 48;

  const prFlat = data.prRows.map((r) => ({
    'Số PR': r.prNumber,
    'Phòng ban': r.department ?? '',
    'Chi nhánh': r.branch ?? '',
    Buyer: r.buyerName ?? '',
    'Trạng thái PR': r.prStatusLabel,
    'Nhóm báo cáo': r.reportGroup,
    'Bước hiện tại': r.currentStep,
    'Chi tiết bước': r.currentStepDetail ?? '',
    ETA: r.eta ?? '',
    SLA: r.slaLabel,
    'Rủi ro': r.riskLabel ?? '',
    'Tiến độ (%)': r.progressPercent,
    'Số dòng': r.itemCount,
    'Số RFQ': r.rfqCount,
    'Số PO': r.poCount,
    'Mua lại': r.hasReopen ? 'Có' : 'Không',
    'Ngân sách đề xuất (VND)': r.proposedBudget,
  }));

  const poFlat = data.poRows.map((r) => ({
    'Số PO': r.poNumber,
    'Số PR': r.prNumber,
    'Chi nhánh': r.branch ?? '',
    NCC: r.vendorName,
    'Trạng thái PO': r.poStatusLabel,
    'Nhóm báo cáo': r.reportGroup,
    ETA: r.eta ?? '',
    'Đã nhận': r.receivedLabel,
    'Quá ETA': r.isOverdue ? 'Có' : 'Không',
  }));

  addDataSheet(wb, 'PR', PR_HEADERS, prFlat);
  addDataSheet(wb, 'PO', PO_HEADERS, poFlat);

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date(data.generatedAt).toISOString().slice(0, 10);
  const lifecycleSlug =
    lifecycle === 'all' ? 'tat-ca' : lifecycle === 'pending' ? 'dang-xu-ly' : 'hoan-thanh';
  return {
    buffer: Buffer.from(buf),
    filename: `Giam_sat_mua_hang_${lifecycleSlug}_${stamp}.xlsx`,
  };
}
