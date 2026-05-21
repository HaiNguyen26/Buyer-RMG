import * as XLSX from 'xlsx';

export type ParsedMaterialImportRow = {
  partInternalCode: string;
  partName?: string;
  specification?: string;
  manufacture?: string;
  quantity?: number;
  unit?: string;
  estimatedCost?: number;
  /** yyyy-mm-dd nếu parse được */
  leadTime?: string;
};

function normKey(h: string): string {
  const base = String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return base.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function mapHeaderKey(h: string): keyof ParsedMaterialImportRow | null {
  const n = normKey(h);
  const m: Record<string, keyof ParsedMaterialImportRow> = {
    part_internal_code: 'partInternalCode',
    ma_vat_tu: 'partInternalCode',
    ma: 'partInternalCode',
    part_name: 'partName',
    ten_vat_tu: 'partName',
    specification: 'specification',
    spec: 'specification',
    mo_ta: 'specification',
    manufacture: 'manufacture',
    manufacturer: 'manufacture',
    nha_san_xuat: 'manufacture',
    ncc_nsx: 'manufacture',
    ncc: 'manufacture',
    quantity: 'quantity',
    qty: 'quantity',
    sl: 'quantity',
    so_luong: 'quantity',
    unit: 'unit',
    dvt: 'unit',
    estimated_cost: 'estimatedCost',
    estimatedcost: 'estimatedCost',
    gia_du_kien: 'estimatedCost',
    gia_du_kien_vnd: 'estimatedCost',
    lead_time: 'leadTime',
    leadtime: 'leadTime',
    ngay_mong_muon_giao: 'leadTime',
    ngay_yeu_cau_giao: 'leadTime',
  };
  return m[n] ?? null;
}

function parseNumberCell(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseLeadCell(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && Number.isFinite(v)) {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return undefined;
}

function rowToParsed(raw: Record<string, unknown>): ParsedMaterialImportRow | null {
  const acc: Partial<ParsedMaterialImportRow> = {};
  for (const [header, val] of Object.entries(raw)) {
    const field = mapHeaderKey(header);
    if (!field) continue;
    if (field === 'quantity' || field === 'estimatedCost') {
      const n = parseNumberCell(val);
      if (n != null) (acc as any)[field] = n;
      continue;
    }
    if (field === 'leadTime') {
      const d = parseLeadCell(val);
      if (d) acc.leadTime = d;
      continue;
    }
    if (typeof val === 'string' || typeof val === 'number') {
      const t = String(val).trim();
      if (!t) continue;
      (acc as any)[field] = t;
    }
  }
  const code = acc.partInternalCode?.trim();
  if (!code) return null;
  return {
    partInternalCode: code,
    partName: acc.partName?.trim(),
    specification: acc.specification?.trim(),
    manufacture: acc.manufacture?.trim(),
    quantity: acc.quantity,
    unit: acc.unit?.trim(),
    estimatedCost: acc.estimatedCost,
    leadTime: acc.leadTime,
  };
}

function sheetToParsedRows(sheet: XLSX.WorkSheet): ParsedMaterialImportRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const out: ParsedMaterialImportRow[] = [];
  for (const r of rows) {
    const p = rowToParsed(r);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Đọc file mẫu import vật tư PR (CSV / Excel).
 * Cột khuyến nghị: part_internal_code, part_name, specification, manufacture, quantity, unit, Estimated Cost, lead_time
 */
export async function parseMaterialImportFile(file: File): Promise<ParsedMaterialImportRow[]> {
  const lower = file.name.toLowerCase();
  let wb: XLSX.WorkBook;
  if (lower.endsWith('.csv')) {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buf);
    wb = XLSX.read(text, { type: 'string', cellDates: true });
  } else {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return sheetToParsedRows(wb.Sheets[sheetName]);
}
