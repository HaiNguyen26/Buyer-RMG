import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type InventoryRowPayload = {
  partInternalCode: string;
  partName?: string;
  unit?: string;
  quantityAvailable: number;
  warehouseCode: string;
  location?: string;
  minStock?: number | null;
};

export type InventoryListRow = {
  id: string;
  partCode: string;
  partName: string;
  unit: string;
  quantity: number;
  quantityReserved: number;
  minStock?: number | null;
  warehouse: string;
  location: string;
};

export type InventoryReservationDetailLine = {
  reservationId: string;
  qtyReserved: number;
  issueItemLineNo: number;
  issueId: string;
  issueNumber: string;
  issueStatus: string;
  requestor: { username: string; fullName: string | null } | null;
  salesPO: {
    salesPONumber: string;
    projectCode: string | null;
    projectName: string | null;
  } | null;
  purchaseRequest: {
    id: string;
    prNumber: string;
    projectCode: string | null;
    projectName: string | null;
  } | null;
};

export type WarehouseDashboardData = {
  stats: {
    totalItems: number;
    totalQuantity: number;
    lowStockItems: number;
    outOfStock: number;
  };
  lowStock: Array<{ partCode: string; name: string; qty: number; min: number; warehouse: string }>;
  recentActivity: Array<{
    id: string;
    at: string;
    delta: number;
    partCode: string;
    partName: string | null;
    warehouse: string;
    changeType: string;
    label: string;
    text: string;
  }>;
};

function toPayload(rows: InventoryListRow[]): InventoryRowPayload[] {
  return rows
    .filter((r) => {
      if (!r.partCode.trim() || !r.warehouse.trim()) return false;
      const q = Number(r.quantity);
      return Number.isFinite(q) && q >= 0;
    })
    .map((r) => ({
      partInternalCode: r.partCode.trim(),
      partName: r.partName.trim(),
      unit: r.unit.trim(),
      quantityAvailable: Number(r.quantity),
      warehouseCode: r.warehouse.trim(),
      location: r.location.trim() || undefined,
      minStock:
        r.minStock != null && !Number.isNaN(Number(r.minStock)) ? Number(r.minStock) : null,
    }));
}

export type IncomingLineDisplayStatus =
  | 'AwaitingConfirm'
  | 'Incoming'
  | 'Delayed'
  | 'Partial'
  | 'Received';

export type IncomingPOLineRow = {
  poId: string;
  poNumber: string;
  vendor: string;
  vendorCode: string | null;
  poItemId: string;
  lineNo: number;
  itemLabel: string;
  partNo: string | null;
  expectedDate: string | null;
  confirmedQty: number | null;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  lineStatus: string;
  displayStatus: IncomingLineDisplayStatus;
  poHeaderStatus: string;
  listStatus: 'Sent' | 'Confirmed' | 'Partial';
};

/** @deprecated Use IncomingPOLineRow — kept for gradual migration */
export type IncomingPOListRow = IncomingPOLineRow & { id?: string };

export type GrnPOLine = {
  poItemId: string;
  lineNo: number;
  itemLabel: string;
  partNo: string | null;
  description: string;
  unit: string;
  ordered: number;
  confirmedQty: number | null;
  expectedDeliveryDate: string | null;
  alreadyReceived: number;
  remaining: number;
  canReceive: boolean;
  lineStatus: string;
};

export type GrnHistoryStatus = 'FULL' | 'PARTIAL' | 'PENDING_QC' | 'CANCELLED';

export type GrnHistoryListRow = {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  vendor: string;
  vendorCode: string | null;
  receivedAt: string;
  receivedDate: string;
  receivedTime: string;
  status: GrnHistoryStatus;
  receiver: string;
  lineCount: number;
  estimatedValueVnd: number;
};

export type GrnHistorySummary = {
  receivedTodayPoCount: number;
  itemsReceivedQty: number;
  partialGrnCount: number;
  totalValueMonthVnd: number;
  overdueIncomingLines: number;
};

export type GrnHistoryDetailItem = {
  poItemId: string;
  lineNo: number;
  name: string;
  partNo: string | null;
  ordered: number;
  confirmed: number;
  receivedThis: number;
  receivedTotal: number;
  unit: string;
};

export type GrnHistoryTimelineEvent = {
  title: string;
  desc: string;
  date: string;
  done: boolean;
};

export type GrnHistoryDetail = {
  id: string;
  grnNumber: string;
  warehouseCode: string;
  note: string | null;
  poId: string;
  poNumber: string;
  poStatus: string;
  vendor: string;
  vendorFull: string;
  vendorCode: string | null;
  receivedAt: string;
  receivedDate: string;
  receivedTime: string;
  status: GrnHistoryStatus;
  receiver: string;
  currency: string;
  estimatedValueVnd: number;
  poTotalAmount: number;
  items: GrnHistoryDetailItem[];
  timeline: GrnHistoryTimelineEvent[];
};

export type PoGrnSummary = {
  id: string;
  grnNumber: string;
  receivedAt: string;
  status: GrnHistoryStatus;
};

export type PoReceiveProgress = { received: number; cap: number };

export type GrnPODetail = {
  po: {
    id: string;
    poNumber: string;
    status?: string;
    vendor: string;
    vendorCode: string | null;
    deliveryDate: string | null;
    earliestExpectedDate?: string | null;
  };
  receiver: { id: string; displayName: string };
  lines: GrnPOLine[];
  existingGrns?: PoGrnSummary[];
  receiveProgress?: PoReceiveProgress;
};

export type IncomingPoViewLine = {
  poItemId: string;
  lineNo: number;
  itemLabel: string;
  partNo: string | null;
  ordered: number;
  confirmedQty: number | null;
  alreadyReceived: number;
  remaining: number;
  lineStatus: string;
  unit: string;
};

export type IncomingPoViewDetail = {
  po: {
    id: string;
    poNumber: string;
    status: string;
    vendor: string;
    vendorCode: string | null;
    deliveryDate: string | null;
    earliestExpectedDate: string | null;
  };
  lines: IncomingPoViewLine[];
  existingGrns: PoGrnSummary[];
};

export const warehouseService = {
  getDashboard: async (): Promise<WarehouseDashboardData> => {
    const { data } = await api.get<WarehouseDashboardData>('/warehouse/dashboard');
    return data;
  },

  list: async (): Promise<InventoryListRow[]> => {
    const { data } = await api.get<{ rows: InventoryListRow[] }>('/warehouse/inventory');
    return data.rows;
  },

  listReservationDetails: async (
    partCode: string,
    warehouseCode: string
  ): Promise<{ lines: InventoryReservationDetailLine[] }> => {
    const { data } = await api.get<{ lines: InventoryReservationDetailLine[] }>(
      '/warehouse/inventory/reservations',
      { params: { partCode, warehouseCode } }
    );
    return data;
  },

  lookup: async (code: string): Promise<{ partName: string; unit: string } | null> => {
    const { data } = await api.get(`/warehouse/parts/lookup`, { params: { code } });
    return data;
  },

  validate: async (rows: InventoryListRow[]) => {
    const { data } = await api.post<{ ok: boolean; issues: { index: number; errors: string[] }[] }>(
      '/warehouse/inventory/validate',
      { rows: toPayload(rows) }
    );
    return data;
  },

  save: async (rows: InventoryListRow[], source?: 'import' | 'manual') => {
    const { data } = await api.post<{ success: boolean; saved: number }>('/warehouse/inventory/save', {
      rows: toPayload(rows),
      ...(source === 'import' ? { source: 'import' } : {}),
    });
    return data;
  },

  downloadTemplate: async () => {
    const { data } = await api.get('/warehouse/inventory/template', { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_import_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },

  listIncomingPOs: async (params?: {
    vendor?: string;
    from?: string;
    to?: string;
    status?: 'all' | 'pending' | 'partial' | 'delayed';
  }): Promise<{
    rows: IncomingPOLineRow[];
    poGrns: Record<string, PoGrnSummary[]>;
    poProgress: Record<string, PoReceiveProgress>;
  }> => {
    const { data } = await api.get<{
      rows: IncomingPOLineRow[];
      poGrns: Record<string, PoGrnSummary[]>;
      poProgress?: Record<string, PoReceiveProgress>;
    }>(
      '/warehouse/incoming/pos',
      {
        params: {
          ...(params?.vendor ? { vendor: params.vendor } : {}),
          ...(params?.from ? { from: params.from } : {}),
          ...(params?.to ? { to: params.to } : {}),
          ...(params?.status && params.status !== 'all' ? { status: params.status } : {}),
        },
      }
    );
    return data;
  },

  getIncomingPoView: async (poId: string): Promise<IncomingPoViewDetail> => {
    const { data } = await api.get<IncomingPoViewDetail>(
      `/warehouse/incoming/pos/${encodeURIComponent(poId)}/view`
    );
    return {
      rows: data.rows,
      poGrns: data.poGrns ?? {},
      poProgress: data.poProgress ?? {},
    };
  },

  getPOForGrn: async (poId: string): Promise<GrnPODetail> => {
    const { data } = await api.get<GrnPODetail>(`/warehouse/incoming/pos/${encodeURIComponent(poId)}`);
    return data;
  },

  listGrnHistory: async (params?: {
    search?: string;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<{ summary: GrnHistorySummary; grns: GrnHistoryListRow[] }> => {
    const { data } = await api.get<{ summary: GrnHistorySummary; grns: GrnHistoryListRow[] }>(
      '/warehouse/grn-history',
      {
        params: {
          ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
          ...(params?.from?.trim() ? { from: params.from.trim() } : {}),
          ...(params?.to?.trim() ? { to: params.to.trim() } : {}),
          ...(params?.status && params.status !== 'ALL' ? { status: params.status } : {}),
        },
      }
    );
    return data;
  },

  getGrnHistoryDetail: async (id: string): Promise<GrnHistoryDetail> => {
    const { data } = await api.get<GrnHistoryDetail>(
      `/warehouse/grn-history/${encodeURIComponent(id)}`
    );
    return data;
  },

  submitGrn: async (
    poId: string,
    body: {
      lines: { poItemId: string; qtyReceived: number }[];
      note?: string | null;
      warehouseCode?: string;
      receivedAt?: string | null;
      attachmentNames?: string[];
    }
  ): Promise<{
    success: boolean;
    created?: boolean;
    grnId: string;
    grnNumber: string;
    poStatus: string;
  }> => {
    const { data } = await api.post<{
      success: boolean;
      created?: boolean;
      grnId: string;
      grnNumber: string;
      poStatus: string;
    }>(
      `/warehouse/incoming/pos/${encodeURIComponent(poId)}/grn`,
      body
    );
    return data;
  },

  importPreview: async (
    file: File,
    opts?: { defaultWarehouse?: string; defaultUnit?: string }
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<{
      preview: Array<{
        rowIndex: number;
        partCode: string;
        partName: string;
        unit: string;
        quantity: number;
        minStock: number | null;
        warehouse: string;
        location: string;
        errors: string[];
      }>;
    }>('/warehouse/import/preview', fd, {
      params: {
        ...(opts?.defaultWarehouse !== undefined
          ? { defaultWarehouse: opts.defaultWarehouse }
          : {}),
        ...(opts?.defaultUnit ? { defaultUnit: opts.defaultUnit } : {}),
      },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.preview;
  },
};

export { toPayload };
