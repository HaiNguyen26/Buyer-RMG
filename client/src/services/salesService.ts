import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SalesPO {
  id: string;
  salesPONumber: string;
  customer: {
    id: string;
    name: string;
    code?: string;
  };
  projectName?: string;
  projectCode?: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  status: 'ACTIVE' | 'CLOSED';
  actualCost?: number;
  remainingBudget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  activeSalesPOs: number;
  totalSalesPOAmount: number;
  actualCost: number;
  remainingBudget: number;
  warnings: Array<{
    type: 'exceeded' | 'approaching';
    salesPOId: string;
    salesPONumber: string;
    projectName?: string;
    amount: number;
    actualCost: number;
    remaining: number;
    usagePercent?: string;
  }>;
  trendData?: Array<{
    month: string;
    budget: number;
    actualCost: number;
  }>;
  salesPOs: SalesPO[];
}

export interface SalesPODetail {
  salesPO: SalesPO;
  purchaseRequests: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    status: 'PENDING' | 'SUPPLIER_SELECTED' | 'PAYMENT_DONE';
    actualCost: number;
    requestor: {
      id: string;
      username: string;
      email: string;
    };
    supplier?: {
      id: string;
      name: string;
    };
  }>;
  financialSummary: {
    salesPOAmount: number;
    actualCost: number;
    remainingBudget: number;
    progressPercent: string;
  };
}

export const salesService = {
  // Dashboard
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>('/sales/dashboard');
    return response.data;
  },

  // Sales PO Management
  getSalesPOs: async (params?: {
    status?: 'ACTIVE' | 'CLOSED';
    customerId?: string;
    search?: string;
  }): Promise<{ salesPOs: SalesPO[] }> => {
    const response = await api.get<{ salesPOs: SalesPO[] }>('/sales/sales-pos', { params });
    return response.data;
  },

  getSalesPOById: async (id: string): Promise<SalesPO> => {
    const response = await api.get<SalesPO>(`/sales/sales-pos/${id}`);
    return response.data;
  },

  getNextSalesPONumber: async (): Promise<{ salesPONumber: string }> => {
    const response = await api.get<{ salesPONumber: string }>('/sales/sales-pos/next-number');
    return response.data;
  },

  createSalesPO: async (data: {
    salesPONumber: string;
    customerId: string;
    projectName?: string;
    projectCode?: string;
    amount: number;
    currency?: string;
    effectiveDate: string;
    notes?: string;
  }): Promise<SalesPO> => {
    const response = await api.post<SalesPO>('/sales/sales-pos', data);
    return response.data;
  },

  updateSalesPO: async (
    id: string,
    data: Partial<{
      salesPONumber: string;
      customerId: string;
      projectName?: string;
      projectCode?: string;
      amount: number;
      currency?: string;
      effectiveDate: string;
      notes?: string;
    }>
  ): Promise<SalesPO> => {
    const response = await api.put<SalesPO>(`/sales/sales-pos/${id}`, data);
    return response.data;
  },

  closeSalesPO: async (id: string): Promise<SalesPO> => {
    const response = await api.post<SalesPO>(`/sales/sales-pos/${id}/close`);
    return response.data;
  },

  reopenSalesPO: async (id: string): Promise<SalesPO> => {
    const response = await api.post<SalesPO>(`/sales/sales-pos/${id}/reopen`);
    return response.data;
  },

  // Project/Sales PO Detail
  getSalesPODetail: async (id: string): Promise<SalesPODetail> => {
    const response = await api.get<SalesPODetail>(`/sales/sales-pos/${id}/detail`);
    return response.data;
  },

  // Cost Overview
  getCostOverview: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    overview: Array<{
      salesPOId: string;
      salesPONumber: string;
      projectName?: string;
      customerName: string;
      salesPOAmount: number;
      actualCost: number;
      remainingBudget: number;
      createdAt: string;
    }>;
  }> => {
    const response = await api.get('/sales/cost-overview', { params });
    return response.data;
  },

  // Reports
  exportReports: async (type: 'sales-po' | 'project' | 'customer', format: 'excel' | 'pdf') => {
    const response = await api.get(`/sales/reports/export`, {
      params: { type, format },
      responseType: format === 'excel' ? 'blob' : 'blob',
    });
    return response.data;
  },
};

