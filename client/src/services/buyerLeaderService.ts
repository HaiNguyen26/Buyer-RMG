import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: `${API_URL}/buyer-leader`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const buyerLeaderService = {
  // Get pending PRs for assignment
  getPendingAssignments: async () => {
    const response = await api.get('/pending-assignments');
    return response.data;
  },

  // Assign PR to Buyer
  assignPR: async (prId: string, data: {
    buyerId: string;
    scope: 'FULL' | 'PARTIAL';
    assignedItemIds?: string[];
    note: string;
  }) => {
    const response = await api.post(`/prs/${prId}/assign`, data);
    return response.data;
  },

  // Get assignments history
  getAssignments: async () => {
    const response = await api.get('/assignments');
    return response.data;
  },

  // Theo dõi PR & tiến độ RFQ – danh sách
  getPRTrackingList: async () => {
    const response = await api.get('/pr-tracking');
    return response.data;
  },

  // Theo dõi PR – chi tiết theo item
  getPRTrackingDetail: async (prId: string) => {
    const response = await api.get(`/pr-tracking/${prId}`);
    return response.data;
  },

  // Get RFQs for comparison dropdown (rich data: buyer, quotation count, deadline, warnings)
  getRFQsForComparison: async () => {
    const response = await api.get('/rfqs/for-comparison');
    return response.data;
  },

  // Compare quotations for RFQ
  compareQuotations: async (rfqId: string) => {
    const response = await api.get(`/rfqs/${rfqId}/compare`);
    return response.data;
  },

  // Get recommendations
  getRecommendations: async (rfqId: string) => {
    const response = await api.get(`/rfqs/${rfqId}/recommendations`);
    return response.data;
  },

  // Get PR for supplier selection
  getPRForSupplierSelection: async (prId: string, rfqId?: string) => {
    const params = rfqId ? { rfqId } : {};
    const response = await api.get(`/prs/${prId}/select-supplier`, { params });
    return response.data;
  },

  // Select supplier: full (quotationId) hoặc per-item (selections: [{ purchaseRequestItemId, quotationId }])
  selectSupplier: async (data: {
    purchaseRequestId: string;
    selectionReason: string;
    overBudgetReason?: string;
    quotationId?: string;
    selections?: Array<{ purchaseRequestItemId: string; quotationId: string }>;
  }) => {
    const response = await api.post('/supplier-selections', data);
    return response.data;
  },

  optimizeAwardStrategy: async (data: {
    rfqId: string;
    mode: 'lowest_cost' | 'cost_plus_leadtime';
    selections: Record<string, string>;
  }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/optimize`, data);
    return response.data;
  },

  submitAwardForApproval: async (data: {
    rfqId: string;
    selections: Record<string, string>;
    justification: string;
  }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/submit`, data);
    return response.data;
  },

  getAwardApprovalView: async (rfqId: string) => {
    const response = await api.get(`/rfqs/${rfqId}/award/approval-view`);
    return response.data;
  },

  approveAwardDecision: async (data: {
    rfqId: string;
    selections: Record<string, string>;
    justification?: string;
  }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/approve`, data);
    return response.data;
  },

  returnAwardToBuyer: async (data: { rfqId: string; reason: string }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/return`, data);
    return response.data;
  },

  adjustAwardAllocation: async (data: {
    rfqId: string;
    selections: Record<string, string>;
    note?: string;
  }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/adjust`, data);
    return response.data;
  },

  generatePurchaseOrders: async (data: {
    rfqId: string;
    splits: Array<{ vendorId: string; amount: number }>;
  }) => {
    const response = await api.post(`/rfqs/${data.rfqId}/award/generate-pos`, data);
    return response.data;
  },

  // Get buyers list
  getBuyers: async () => {
    const response = await api.get('/buyers');
    return response.data;
  },

  // Get PR details by ID
  getPRDetails: async (prId: string) => {
    const response = await api.get(`/prs/${prId}`);
    return response.data;
  },

  // Get over-budget PRs
  getOverBudgetPRs: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/over-budget-prs', { params });
    return response.data;
  },

  // Get RFQ Monitoring
  getRFQMonitoring: async (filter?: 'open' | 'waiting_quotations' | 'overdue' | 'all') => {
    const params = filter ? { filter } : {};
    const response = await api.get('/rfq-monitoring', { params });
    return response.data;
  },

  // Get RFQs for a specific PR
  getPRRFQs: async (prId: string) => {
    const response = await api.get(`/prs/${prId}/rfqs`);
    return response.data;
  },

  // Remind buyer to submit RFQ
  remindBuyerRFQ: async (rfqId: string) => {
    const response = await api.post(`/rfqs/${rfqId}/remind`);
    return response.data;
  },

  // Escalate RFQ to Buyer Manager
  escalateRFQ: async (rfqId: string, reason?: string) => {
    const response = await api.post(`/rfqs/${rfqId}/escalate`, { reason });
    return response.data;
  },
};

