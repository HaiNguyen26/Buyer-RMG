import axios from 'axios';
import type { PRSalesOrderInfo } from '../types/prSalesOrder';
import { shouldServeDeptHeadMock } from '../mocks/departmentHeadDevMock';
import {
  getDeptHeadMockMyPRDashboardShape,
  getDeptHeadMockMyPRsList,
  getDeptHeadMockPRData,
  getDeptHeadMockPRTracking,
} from '../mocks/departmentHeadDevMock';

export type RequestorItemStatusKey =
  | 'REVISION_REQUIRED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'FROM_STOCK'
  | 'FULFILLED'
  | 'RECEIVED'
  | 'PARTIAL_RECEIVED'
  | 'DELAYED'
  | 'INCOMING'
  | 'AWAITING_VENDOR_CONFIRM'
  | 'PO_SENT'
  | 'VENDOR_CONFIRMED'
  | 'SUPPLIER_SELECTED'
  | 'RFQ'
  | 'PENDING_APPROVAL'
  | 'PROCUREMENT'
  | 'CANCELLED';

export type ProcurementListSnapshot = {
  nextEta: string | null;
  receivedCount: number;
  totalCount: number;
  partialCount: number;
  hasDelay: boolean;
  delayHint: string | null;
  itemPreview: Array<{
    label: string;
    statusLabel: string;
    statusKey: RequestorItemStatusKey;
    eta: string | null;
    qtyReceived: number;
    qtyCap: number;
  }>;
};

export type StockIssuePickupMeta = {
  ready: boolean;
  linkedStockIssue: {
    id: string;
    issueNumber: string;
    status: string;
  } | null;
};

export type RequestorProcurementTracking = {
  pr: {
    id: string;
    prNumber: string;
    status: string;
    statusLabel: string;
    department: string | null;
    purpose: string | null;
    totalAmount: number | null;
    currency: string;
    createdAt: string;
    updatedAt: string;
    salesOrder?: PRSalesOrderInfo | null;
  };
  timeline: {
    stages: Array<{ key: string; label: string; completed: boolean; current: boolean }>;
    percentage: number;
  };
  currentStep: {
    label: string;
    detail: string | null;
    iconKey: 'package' | 'clock' | 'check' | 'alert' | 'file';
    tone: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate';
  };
  deliverySummary: {
    receivedCount: number;
    totalCount: number;
    nextEta: string | null;
    partialCount: number;
  };
  items: Array<{
    itemId: string;
    lineNo: number;
    label: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyCap: number;
    eta: string | null;
    statusKey: RequestorItemStatusKey;
    statusLabel: string;
    poNumber: string | null;
  }>;
  sla: {
    status: 'on_time' | 'warning' | 'overdue' | 'completed';
    timeRemaining: string | null;
    timeOverdue: string | null;
    daysSinceCreated: number;
    percentConsumed: number;
    estimatedDays: number;
  };
  costInsight?: {
    proposedAmount: number | null;
    procurementCostAmount?: number | null;
    buyerTargetAmount: number | null;
    costSource?: 'none' | 'award' | 'po';
    isFinalized?: boolean;
    awaitingVendorConfirm?: boolean;
    deltaAmount: number;
    deltaPercent: number;
    status: 'unknown' | 'within' | 'equal' | 'over';
    purchasePhase?: 'sourcing' | 'completed';
    actualReceivedAmount?: number | null;
    finalPurchaseAmount?: number | null;
  };
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface CustomerPOItem {
  id: string;
  poNumber: string;
  salesPONumber: string;
  customer: string;
  projectName: string;
  projectCode: string | null;
  contractValue: number;
  currency: string;
  salesOwner: string | null;
}

export interface PartCatalogRow {
  id: string;
  partInternalCode: string;
  partName: string;
  unit: string;
  manufacturer: string | null;
  referenceUrl?: string | null;
  stockAvailable: number;
}

export interface CustomerPODetail {
  id: string;
  poNumber: string;
  salesPONumber: string;
  customer: { id: string; name: string; code?: string } | null;
  projectName: string | null;
  projectCode: string | null;
  contractValue: number;
  currency: string;
  salesOwner: { id: string; name: string } | string | null;
  totalPRs?: number;
  totalProcurementCost?: number;
  remainingBudget?: number;
  purchaseRequests?: Array<{ id: string; prNumber: string; totalAmount: number | null; status: string }>;
}

export interface DashboardData {
  totalPRs: number;
  prsByStatus: Array<{
    status: string;
    count: number;
  }>;
  prsByType?: Array<{
    type: string;
    typeKey?: string;
    count: number;
  }>;
  prsByMonth?: Array<{
    monthKey: string;
    label: string;
    count: number;
  }>;
  prsNeedMoreInfo: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    salesPO?: {
      salesPONumber: string;
      projectName: string;
    };
    notes?: string;
  }>;
  recentPRs: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    status: string;
    salesPO?: {
      salesPONumber: string;
      projectName: string;
    };
    createdAt: string;
  }>;
}

export interface PRData {
  id: string;
  prNumber: string;
  department?: string;
  itemName: string;
  specifications?: string;
  quantity: number;
  unit?: string;
  requiredDate?: string;
  purpose?: string;
  location?: string;
  status: string;
  /** Danh sách PR (API) */
  totalAmount?: number | null;
  currency?: string;
  /** Chuẩn API: thông tin SO/PO khách gắn PR */
  salesOrder?: PRSalesOrderInfo | null;
  salesPO?: {
    id: string;
    salesPONumber: string;
    projectName: string;
    projectCode?: string;
    customer?: {
      id: string;
      name: string;
      code?: string;
    };
  };
  notes?: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    contentType: string;
  }>;
  items?: Array<{
    id?: string;
    lineNo: number;
    description: string;
    partNo?: string;
    spec?: string;
    manufacturer?: string;
    qty: number;
    unit?: string;
    purpose?: string;
    remark?: string;
    estimatedUnitPriceVnd?: number | null;
    desiredDeliveryDate?: string;
    attachments?: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      contentType: string;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PRTrackingData {
  pr: PRData;
  timeline: Array<{
    status: string;
    completed: boolean;
    date?: string;
    handler?: string;
    comment?: string;
  }>;
  currentHandler?: string;
  comments: Array<{
    from: string;
    message: string;
    date: string;
  }>;
}

export interface NotificationData {
  id: string;
  type: string;
  message: string;
  prNumber?: string;
  comment?: string;
  createdAt: string;
}

export const requestorService = {
  // Get Dashboard Data
  getDashboard: async (): Promise<DashboardData> => {
    if (shouldServeDeptHeadMock()) {
      return getDeptHeadMockMyPRDashboardShape();
    }
    const response = await api.get('/requestor/dashboard');
    return response.data as DashboardData;
  },

  // Get My PRs
  getMyPRs: async (filters?: { status?: string }): Promise<{ prs: PRData[] }> => {
    if (shouldServeDeptHeadMock()) {
      let { prs } = getDeptHeadMockMyPRsList();
      const st = filters?.status;
      if (st && st !== 'all') {
        prs = prs.filter((p) => p.status === st);
      }
      return { prs };
    }
    const response = await api.get('/requestor/prs', { params: filters });
    return response.data as { prs: PRData[] };
  },

  // Get PR by ID
  getPR: async (id: string): Promise<PRData> => {
    if (shouldServeDeptHeadMock()) {
      const mock = getDeptHeadMockPRData(id);
      if (mock) return mock;
    }
    const response = await api.get(`/requestor/prs/${id}`);
    return response.data;
  },

  resubmitPRItemDepartmentRevision: async (
    prId: string,
    itemId: string,
    body: {
      description: string;
      partNo: string;
      spec?: string;
      manufacturer?: string;
      qty: number;
      unit: string;
      estimatedUnitPriceVnd?: number;
      desiredDeliveryDate?: string;
      purpose?: string;
      remark?: string;
    }
  ) => {
    const response = await api.post(`/requestor/prs/${prId}/items/${itemId}/resubmit-revision`, body);
    return response.data;
  },

  // Get Next PR number by Department (preview)
  getNextPRNumber: async (department: string): Promise<{ prNumber: string }> => {
    const response = await api.get('/requestor/prs/next-number', { params: { department } });
    return response.data;
  },

  // Customer PO — requestor chỉ chọn có sẵn hoặc không chọn (mua nội bộ)
  getCustomerPOs: async (): Promise<{ customerPOs: CustomerPOItem[] }> => {
    const response = await api.get('/requestor/customer-pos');
    return response.data;
  },
  getCustomerPOById: async (id: string): Promise<CustomerPODetail> => {
    const response = await api.get(`/requestor/customer-pos/${id}`);
    return response.data;
  },

  listPartCatalog: async (q?: string): Promise<PartCatalogRow[]> => {
    const response = await api.get<{ parts: PartCatalogRow[] }>('/requestor/part-catalog', {
      params: q?.trim() ? { q: q.trim() } : {},
    });
    return response.data.parts;
  },

  resolvePartCatalogByCodes: async (
    codes: string[]
  ): Promise<{ parts: PartCatalogRow[]; notFound: string[] }> => {
    const { data } = await api.post<{ parts: PartCatalogRow[]; notFound: string[] }>(
      '/requestor/part-catalog/resolve',
      { codes }
    );
    return data;
  },

  createPartCatalogEntry: async (body: {
    partInternalCode: string;
    partName: string;
    unit: string;
    manufacturer?: string;
    referenceUrl?: string;
  }): Promise<PartCatalogRow> => {
    const response = await api.post<{ part: PartCatalogRow }>('/requestor/part-catalog', body);
    return response.data.part;
  },

  // Create PR
  createPR: async (data: {
    department: string;
    type?: 'COMMERCIAL' | 'PRODUCTION' | 'PROJECT' | 'OFFICE';
    requiredDate?: string;
    currency?: string;
    tax?: number;
    notes?: string;
    purpose?: string;
    salesPOId?: string;
    customerPO?: string;
    projectCode?: string;
    projectName?: string;
    customerName?: string;
    salesPersonId?: string;
    items: Array<{
      description: string;
      partNo?: string;
      spec?: string;
      manufacturer?: string;
      qty: number;
      unit?: string;
      unitPrice?: number;
      estimatedUnitPriceVnd?: number;
      desiredDeliveryDate?: string;
      purpose?: string;
      remark?: string;
    }>;
    action: 'SAVE' | 'SUBMIT';
    attachments?: File[];
    itemAttachments?: Array<{ lineNo: number; files: File[] }>;
  }): Promise<PRData> => {
    const { attachments, itemAttachments, ...payload } = data;
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.trim().replace(/^"(.*)"$/, '$1') : '';
    if (!token) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    const hasAnyFiles =
      (attachments?.length ?? 0) > 0 ||
      (itemAttachments ?? []).some((row) => (row.files?.length ?? 0) > 0);

    const response = await api.post('/requestor/prs', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const created = response.data as PRData;

    if (hasAnyFiles && created?.id) {
      const fd = new FormData();
      (attachments ?? []).forEach((f) => fd.append('attachments', f));
      (itemAttachments ?? []).forEach((row) => {
        (row.files ?? []).forEach((f) => fd.append(`itemAttachment:${row.lineNo}`, f));
      });
      try {
        await axios.post(`${API_URL}/requestor/prs/${created.id}/attachments`, fd, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (uploadErr) {
        console.warn('PR created but attachment upload failed', uploadErr);
        throw new Error('PR đã tạo nhưng upload file đính kèm thất bại. Vui lòng thử lại upload tài liệu.');
      }
    }

    return created;
  },

  // Update PR
  updatePR: async (id: string, data: {
    requiredDate?: string;
    notes?: string;
    items?: Array<{
      description: string;
      partNo?: string;
      spec?: string;
      manufacturer?: string;
      qty: number;
      unit?: string;
      unitPrice?: number;
      estimatedUnitPriceVnd?: number;
      desiredDeliveryDate?: string;
      purpose?: string;
      remark?: string;
    }>;
    action: 'UPDATE' | 'RESUBMIT';
  }): Promise<PRData> => {
    const response = await api.put(`/requestor/prs/${id}`, data);
    return response.data;
  },

  deletePR: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/requestor/prs/${id}`);
    return response.data;
  },

  uploadPRAttachments: async (
    id: string,
    files: File[],
    itemAttachments?: Array<{ lineNo: number; files: File[] }>
  ): Promise<{ success: boolean; uploaded: number }> => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.trim().replace(/^"(.*)"$/, '$1') : '';
    if (!token) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    const fd = new FormData();
    files.forEach((f) => fd.append('attachments', f));
    (itemAttachments ?? []).forEach((row) => {
      (row.files ?? []).forEach((f) => fd.append(`itemAttachment:${row.lineNo}`, f));
    });
    const response = await axios.post(`${API_URL}/requestor/prs/${id}/attachments`, fd, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as { success: boolean; uploaded: number };
  },

  // Get PR Tracking List
  getPRTrackingList: async (): Promise<{
    prs: Array<{
      id: string;
      prNumber: string;
      itemName: string | null;
      purpose: string | null;
      department: string | null;
      status: string;
      totalAmount: number | null;
      currency: string;
      createdAt: string;
      updatedAt: string;
      progress: {
        percentage: number;
        stages: Array<{
          key: string;
          label: string;
          completed: boolean;
          current: boolean;
        }>;
        currentStage: {
          key: string;
          label: string;
          completed: boolean;
          current: boolean;
        } | null;
      };
      currentHandler: string | null;
      sla: {
        status: 'on_time' | 'warning' | 'overdue' | 'completed';
        timeRemaining: string | null;
        timeOverdue: string | null;
        daysSinceCreated: number;
        percentConsumed?: number;
        estimatedDays?: number;
      };
      costInsight?: {
        proposedAmount: number | null;
        procurementCostAmount?: number | null;
        buyerTargetAmount: number | null;
        costSource?: 'none' | 'award' | 'po';
        isFinalized?: boolean;
        awaitingVendorConfirm?: boolean;
        deltaAmount: number;
        deltaPercent: number;
        status: 'unknown' | 'within' | 'equal' | 'over';
        purchasePhase?: 'sourcing' | 'completed';
        actualReceivedAmount?: number | null;
        finalPurchaseAmount?: number | null;
      };
      procurementSnapshot?: ProcurementListSnapshot;
      stockIssuePickup?: StockIssuePickupMeta;
      salesOrder?: PRSalesOrderInfo | null;
    }>;
  }> => {
    const response = await api.get('/requestor/prs/tracking');
    return response.data as {
      prs: Array<{
        id: string;
        prNumber: string;
        itemName: string | null;
        purpose: string | null;
        department: string | null;
        status: string;
        totalAmount: number | null;
        currency: string;
        createdAt: string;
        updatedAt: string;
        progress: {
          percentage: number;
          stages: Array<{ key: string; label: string; completed: boolean; current: boolean }>;
          currentStage: { key: string; label: string; completed: boolean; current: boolean } | null;
        };
        currentHandler: string | null;
        sla: {
          status: 'on_time' | 'warning' | 'overdue' | 'completed';
          timeRemaining: string | null;
          timeOverdue: string | null;
          daysSinceCreated: number;
        };
        costInsight?: {
          proposedAmount: number | null;
          buyerTargetAmount: number | null;
          deltaAmount: number;
          deltaPercent: number;
          status: 'unknown' | 'within' | 'equal' | 'over';
        };
        salesOrder?: PRSalesOrderInfo | null;
      }>;
    };
  },

  getPRProcurementTracking: async (id: string): Promise<RequestorProcurementTracking> => {
    const response = await api.get<RequestorProcurementTracking>(
      `/requestor/prs/${encodeURIComponent(id)}/procurement-tracking`
    );
    return response.data;
  },

  // Get PR Tracking
  getPRTracking: async (id: string): Promise<PRTrackingData> => {
    if (shouldServeDeptHeadMock()) {
      const m = getDeptHeadMockPRTracking(id);
      if (m) return m;
    }
    const response = await api.get(`/requestor/prs/${id}/tracking`);
    return response.data;
  },

  // Get Notifications
  getNotifications: async (): Promise<{ notifications: NotificationData[] }> => {
    const response = await api.get('/requestor/notifications');
    return response.data;
  },
};

