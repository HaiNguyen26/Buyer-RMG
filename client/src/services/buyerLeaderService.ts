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

  // Select supplier
  selectSupplier: async (data: {
    purchaseRequestId: string;
    quotationId: string;
    selectionReason: string;
    overBudgetReason?: string;
  }) => {
    const response = await api.post('/supplier-selections', data);
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
};

