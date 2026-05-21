import axios from 'axios';

export type SupplierConfirmLinePayload = {
  poItemId: string;
  confirmedQty: number;
  expectedDeliveryDate: string;
};

export type SupplierConfirmBody = {
  lines: SupplierConfirmLinePayload[];
  note?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds timeout for file uploads
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle potential serialization issues
api.interceptors.response.use(
  (response) => {
    // Log response for debugging
    if (response.config.url?.includes('/prs/')) {
      console.log('[buyerService interceptor] Response for PR endpoint:', {
        url: response.config.url,
        status: response.status,
        dataType: typeof response.data,
        dataIsNull: response.data === null,
        dataIsUndefined: response.data === undefined,
        dataKeys: response.data ? Object.keys(response.data) : 'N/A',
      });
    }
    
    // Handle case where response.data might be a stringified JSON
    if (typeof response.data === 'string' && response.data.trim()) {
      try {
        const parsed = JSON.parse(response.data);
        console.log('[buyerService interceptor] Parsed string response to object');
        response.data = parsed;
      } catch (e) {
        console.warn('[buyerService interceptor] Failed to parse string response:', e);
      }
    }
    
    return response;
  },
  (error) => {
    console.error('[buyerService interceptor] Response error:', error);
    return Promise.reject(error);
  }
);

// Dashboard Data
export interface BuyerDashboardData {
  assignedPRs: number;
  rfqInProgress: number;
  prsNeedMoreInfo: number;
  quotationsCompleted: number;
  todayPRs: Array<{
    id: string;
    prNumber: string;
    salesPO: string;
    project: string;
    status: string;
  }>;
}

// Assigned PR Data
export interface AssignedPRData {
  id: string;
  prNumber: string;
  salesPO: {
    number: string;
    project: string;
  };
  scope: string;
  status: string;
  assignedDate: string;
  department?: string | null;
  totalAmount?: number | null;
  deadline?: string | null;
  notes?: string;
}

export interface AssignedPRsData {
  prs: AssignedPRData[];
}

// Project Cost Reference Data
export interface ProjectCostData {
  id: string;
  salesPONumber: string;
  projectName: string;
  projectCode: string;
  salesPOAmount: number;
  actualCost: number;
  remainingBudget: number;
  progress: number;
}

export interface ProjectCostReferenceData {
  projects: ProjectCostData[];
}

// Notification Data
export interface BuyerNotificationData {
  id: string;
  type: 'PR_ASSIGNED' | 'PR_RETURNED' | 'LEADER_REQUEST' | 'QUOTATION_RECEIVED';
  title: string;
  message: string;
  prNumber?: string;
  comment?: string;
  rfqNumber?: string;
  createdAt: string;
  read: boolean;
}

export interface BuyerNotificationsData {
  notifications: BuyerNotificationData[];
}

export const buyerService = {
  // Get Dashboard
  getDashboard: async (): Promise<BuyerDashboardData> => {
    const response = await api.get('/buyer/dashboard');
    return response.data;
  },

  // Get Assigned PRs
  getAssignedPRs: async (params?: {
    status?: string;
  }): Promise<AssignedPRsData> => {
    const response = await api.get('/buyer/assigned-prs', { params });
    return response.data;
  },

  // Get Project Cost Reference
  getProjectCostReference: async (): Promise<ProjectCostReferenceData> => {
    const response = await api.get('/buyer/project-cost-reference');
    return response.data;
  },

  // Get Notifications
  getNotifications: async (): Promise<BuyerNotificationsData> => {
    const response = await api.get('/buyer/notifications');
    return response.data;
  },

  // Get Over Budget Alerts (item-level: PR, RFQ, Item, NCC, Baseline, Giá RFQ, Mức vượt, Trạng thái)
  getOverBudgetAlerts: async (): Promise<{
    alerts: Array<{
      id: string;
      prId: string;
      prNumber: string;
      rfqId: string;
      rfqNumber: string;
      itemId: string;
      itemDesc: string;
      supplierName: string;
      baselineUnitPrice: number;
      rfqUnitPrice: number;
      overAmount: number;
      overPercent: number;
      severity: 'light' | 'serious';
    }>;
  }> => {
    const response = await api.get('/buyer/over-budget-alerts');
    return response.data;
  },

  // Get Price Comparison
  getPriceComparison: async (): Promise<{
    comparisons: Array<{
      id: string;
      prNumber: string;
      description: string;
      prPrice: number;
      rfqPrice: number;
      currency: string;
      supplierName?: string;
    }>;
  }> => {
    const response = await api.get('/buyer/price-comparison');
    return response.data;
  },

  // Create Supplier
  createSupplier: async (data: {
    name: string;
    code?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxCode?: string;
    contactPerson?: string;
    bankName?: string;
    bankAccount?: string;
    notes?: string;
  }): Promise<any> => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  importSuppliersBulk: async (suppliers: Array<{
    name: string;
    code?: string;
    country?: string;
    category?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxCode?: string;
    contactPerson?: string;
    bankName?: string;
    bankAccount?: string;
    notes?: string;
  }>): Promise<{
    message: string;
    totalReceived: number;
    dedupedInPayload: number;
    inserted: number;
    skipped: number;
  }> => {
    const response = await api.post('/suppliers/bulk-import', { suppliers });
    return response.data;
  },

  // Get Suppliers (danh sách NCC)
  getSuppliers: async (): Promise<{ suppliers: any[] }> => {
    const response = await api.get('/suppliers');
    const data = response?.data;
    if (Array.isArray(data)) return { suppliers: data };
    if (data && Array.isArray(data.suppliers)) return { suppliers: data.suppliers };
    return { suppliers: [] };
  },

  // Get PR Details
  getPRDetails: async (prId: string): Promise<any> => {
    try {
      console.log(`[buyerService.getPRDetails] Fetching PR ${prId}`);
      const response = await api.get(`/buyer/prs/${prId}`);
      console.log('[buyerService.getPRDetails] Full response object:', response);
      console.log('[buyerService.getPRDetails] Response type:', typeof response);
      console.log('[buyerService.getPRDetails] Response keys:', Object.keys(response));
      console.log('[buyerService.getPRDetails] Response data:', response.data);
      console.log('[buyerService.getPRDetails] Response data type:', typeof response.data);
      console.log('[buyerService.getPRDetails] Response status:', response.status);
      console.log('[buyerService.getPRDetails] Response headers:', response.headers);
      
      // Check if data exists
      if (response.data === null || response.data === undefined) {
        console.error('[buyerService.getPRDetails] Response data is null or undefined');
        console.error('[buyerService.getPRDetails] Full response for debugging:', JSON.stringify(response, null, 2));
        throw new Error('PR details response is empty');
      }
      
      // Check if data is an empty object
      if (typeof response.data === 'object' && Object.keys(response.data).length === 0) {
        console.error('[buyerService.getPRDetails] Response data is an empty object');
        throw new Error('PR details response is empty');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[buyerService.getPRDetails] Error:', error);
      console.error('[buyerService.getPRDetails] Error message:', error.message);
      console.error('[buyerService.getPRDetails] Error response:', error.response);
      if (error.response) {
        console.error('[buyerService.getPRDetails] Error response data:', error.response.data);
        console.error('[buyerService.getPRDetails] Error response status:', error.response.status);
      }
      throw error;
    }
  },

  // Create Quotation for PR (Phase 2)
  createQuotationForPR: async (prId: string, data: {
    supplierId: string;
    quotationNumber?: string;
    totalAmount: number;
    currency?: string;
    leadTime?: number;
    deliveryTerms?: string;
    paymentTerms?: string;
    warranty?: string;
    riskNotes?: string;
    validUntil?: string;
    items: Array<{
      purchaseRequestItemId?: string;
      lineNo: number;
      description: string;
      qty: number;
      unit?: string;
      unitPrice: number;
      notes?: string;
    }>;
  }): Promise<any> => {
    const response = await api.post(`/buyer/prs/${prId}/quotations`, data);
    return response.data;
  },

  // Upload Quotation Attachments
  uploadQuotationAttachments: async (quotationId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post(
      `/buyer/quotations/${quotationId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Create Quotation for RFQ (Phase 2)
  createQuotation: async (data: {
    rfqId: string;
    supplierId: string;
    quotationNumber?: string;
    totalAmount: number;
    currency?: string;
    leadTime?: number;
    deliveryTerms?: string;
    paymentTerms?: string;
    warranty?: string;
    riskNotes?: string;
    validUntil?: string;
    items: Array<{
      purchaseRequestItemId?: string;
      lineNo: number;
      description: string;
      qty: number;
      unit?: string;
      unitPrice: number;
      vatPercent?: number;
      notes?: string;
    }>;
  }): Promise<any> => {
    const response = await api.post('/buyer/quotations', data);
    return response.data;
  },

  // Upload Quotation Attachments via RFQ ID (Phase 2)
  uploadQuotationAttachmentsByRFQ: async (rfqId: string, files: File[], quotationId?: string): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('attachment', file); // Note: field name is 'attachment' not 'files'
    });
    
    // Add quotationId to formData if provided
    if (quotationId) {
      formData.append('quotationId', quotationId);
    }
    
    try {
      const response = await api.post(
        `/buyer/rfqs/${rfqId}/quotations/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000, // 2 minutes timeout for file uploads
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              console.log(`Upload progress: ${percentCompleted}%`);
            }
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload error details:', error);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timeout. File có thể quá lớn. Vui lòng thử lại với file nhỏ hơn.');
      }
      throw error;
    }
  },

  // Delete Quotation Attachment
  deleteQuotationAttachment: async (attachmentId: string): Promise<void> => {
    await api.delete(`/buyer/quotations/attachments/${attachmentId}`);
  },

  // Create RFQ for PR
  createRFQ: async (purchaseRequestId: string, notes?: string, itemIds?: string[]): Promise<any> => {
    const response = await api.post('/buyer/rfqs', {
      purchaseRequestId,
      notes: notes || undefined,
      itemIds: itemIds && itemIds.length > 0 ? itemIds : undefined,
    });
    return response.data;
  },

  // Get RFQs
  getRFQs: async (params?: { status?: string }): Promise<any> => {
    const response = await api.get('/buyer/rfqs', { params });
    return response.data;
  },

  // Get RFQ by ID
  getRFQById: async (rfqId: string): Promise<any> => {
    const response = await api.get(`/buyer/rfqs/${rfqId}`);
    return response.data;
  },

  // Update RFQ
  updateRFQ: async (rfqId: string, data: { notes?: string; status?: string }): Promise<any> => {
    const response = await api.put(`/buyer/rfqs/${rfqId}`, data);
    return response.data;
  },

  // Gửi duyệt RFQ - Buyer xác nhận đã nhập đủ báo giá, chuyển sang READY_FOR_COMPARISON để Buyer Leader so sánh & chọn NCC
  completeRFQ: async (rfqId: string): Promise<any> => {
    const response = await api.post(`/buyer/rfqs/${rfqId}/complete`);
    return response.data;
  },

  // Export RFQ PDF/JSON
  exportRFQPDF: async (rfqId: string): Promise<void> => {
    const response = await api.get(`/buyer/rfqs/${rfqId}/export`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Get RFQ number from response headers or use ID
    const contentDisposition = response.headers['content-disposition'];
    let filename = `RFQ_${rfqId}_${new Date().getTime()}.json`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Get Quotations
  getQuotations: async (params?: { rfqId?: string; supplierId?: string; status?: string }): Promise<any> => {
    const response = await api.get('/buyer/quotations', { params });
    return response.data;
  },

  // Get Quotation by ID
  getQuotationById: async (quotationId: string): Promise<any> => {
    const response = await api.get(`/buyer/quotations/${quotationId}`);
    return response.data;
  },

  // ----- PO (Phase 3) -----
  getPODashboard: async () => {
    const response = await api.get('/buyer/po/dashboard');
    return response.data;
  },
  getPRsWaitingPO: async () => {
    const response = await api.get('/buyer/po/prs-waiting');
    return response.data;
  },
  getPRDetailForPO: async (prId: string) => {
    const response = await api.get(`/buyer/po/prs/${prId}/detail`);
    return response.data;
  },
  createDraftPOs: async (prId: string) => {
    const response = await api.post(`/buyer/po/create-from-pr/${prId}`);
    return response.data;
  },
  getPOList: async (params?: { poCode?: string; prCode?: string; supplier?: string; status?: string }) => {
    const response = await api.get('/buyer/po/list', { params });
    return response.data;
  },
  getPODetail: async (poId: string) => {
    const response = await api.get(`/buyer/po/${poId}`);
    return response.data;
  },
  updatePODraft: async (
    poId: string,
    data: {
      paymentTerms?: string;
      deliveryAddress?: string;
      incoterms?: string;
      projectCode?: string;
      deliveryDate?: string;
      note?: string;
      supplierName?: string;
      supplierAddress?: string;
      supplierTaxCode?: string;
      supplierPhone?: string;
    }
  ) => {
    const response = await api.patch(`/buyer/po/${poId}`, data);
    return response.data;
  },
  submitPO: async (
    poId: string,
    data?: {
      supplierTaxCode?: string;
    }
  ) => {
    const response = await api.post(`/buyer/po/${poId}/submit`, data ?? {});
    return response.data;
  },
  markPOSent: async (poId: string) => {
    const response = await api.post(`/buyer/po/${encodeURIComponent(poId)}/mark-sent`);
    return response.data;
  },
  markPOConfirmed: async (poId: string, body: SupplierConfirmBody) => {
    const response = await api.post(`/buyer/po/${encodeURIComponent(poId)}/mark-confirmed`, body);
    return response.data;
  },
  updateSupplierConfirmation: async (poId: string, body: SupplierConfirmBody) => {
    const response = await api.patch(
      `/buyer/po/${encodeURIComponent(poId)}/supplier-confirmation`,
      body
    );
    return response.data;
  },
  requestCancelPO: async (poId: string, reason: string, poItemIds?: string[]) => {
    const response = await api.post(`/buyer/po/${encodeURIComponent(poId)}/request-cancel`, {
      reason,
      ...(poItemIds?.length ? { poItemIds } : {}),
    });
    return response.data;
  },
};

