import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

  // Get Over Budget Alerts
  getOverBudgetAlerts: async (): Promise<{
    alerts: Array<{
      id: string;
      prNumber: string;
      prAmount: number;
      purchasePrice: number;
      currency: string;
      overPercent: number;
      branchManagerStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
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
};

