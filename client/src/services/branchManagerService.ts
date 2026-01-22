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

// Response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    // Log successful responses for pending PRs endpoint
    if (response.config.url?.includes('/pending-prs')) {
      console.log('Axios Response Interceptor - Pending PRs:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
        hasPrs: !!response.data?.prs,
        prsCount: response.data?.prs?.length || 0,
      });
    }
    return response;
  },
  (error) => {
    // Log errors for pending PRs endpoint
    if (error.config?.url?.includes('/pending-prs')) {
      console.error('Axios Error Interceptor - Pending PRs:', {
        url: error.config?.url,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
    }
    return Promise.reject(error);
  }
);

// Dashboard Data
export interface BranchManagerDashboardData {
  pendingPRs: number;
  approvedPRsThisPeriod: number;
  rejectedPRsThisPeriod: number;
  urgentPRs: number;
  budgetExceptionsPending: number;
  totalPRValueThisMonth: number;
  prsByDepartment: Array<{
    department: string;
    count: number;
  }>;
  recentPendingPRs: Array<{
    id: string;
    prNumber: string;
    department: string;
    totalAmount: number | null;
    currency: string;
    requestor: {
      username: string;
      location?: string;
    };
    itemName: string;
    createdAt: string;
    purpose?: string;
  }>;
  prsByType: {
    PRODUCTION: number;
    COMMERCIAL: number;
  };
  prsByDate: Array<{
    date: string;
    count: number;
  }>;
  urgentPRList: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    requiredDate: string;
  }>;
}

// PR Approval Data
export interface PendingPRData {
  id: string;
  prNumber: string;
  itemName: string;
  specifications?: string;
  quantity: number;
  unit?: string;
  requiredDate?: string;
  purpose?: string;
  location?: string;
  salesPO?: {
    salesPONumber: string;
    projectName?: string;
  };
  requestor: {
    username: string;
    location?: string;
  };
}

export interface PendingPRsData {
  prs: PendingPRData[];
}

// PR History Data
export interface PRHistoryData {
  prs: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    status: string;
    requestor: {
      username: string;
      location?: string;
    };
    department: string;
    processedAt: string;
  }>;
}

// Branch Overview Data
export interface BranchOverviewData {
  prsByDepartment: Array<{
    department: string;
    count: number;
  }>;
  prsByType: Array<{
    type: string;
    count: number;
  }>;
  topPRsByValue: Array<{
    id: string;
    prNumber: string;
    department: string;
    totalAmount: number;
    currency: string;
    requestor: string;
    createdAt: string;
  }>;
}

// Notification Data
export interface BranchManagerNotificationData {
  id: string;
  type: 'NEW_PR' | 'PR_RETURNED' | 'PR_URGENT';
  title: string;
  message: string;
  prNumber?: string;
  comment?: string;
  createdAt: string;
  read: boolean;
}

export interface BranchManagerNotificationsData {
  notifications: BranchManagerNotificationData[];
}

export const branchManagerService = {
  // Dashboard
  getDashboard: async (): Promise<BranchManagerDashboardData> => {
    const response = await api.get('/branch-manager/dashboard');
    return response.data;
  },

  // PR Approval
  getPendingPRs: async (): Promise<PendingPRsData> => {
    try {
      const response = await api.get('/branch-manager/pending-prs');
      console.log('branchManagerService.getPendingPRs - Raw response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        dataType: typeof response.data,
        isString: typeof response.data === 'string',
        isObject: typeof response.data === 'object' && response.data !== null,
        hasPrs: !!response.data?.prs,
        prsCount: response.data?.prs?.length || 0,
      });
      
      // Handle case where response.data might be a stringified JSON
      let data = response.data;
      if (typeof data === 'string') {
        // If empty string, return empty result
        if (data.trim() === '') {
          console.warn('branchManagerService.getPendingPRs - Received empty string response');
          return { prs: [] };
        }
        try {
          data = JSON.parse(data);
          console.log('branchManagerService.getPendingPRs - Parsed string:', {
            parsed: data,
            hasPrs: !!data?.prs,
            prsCount: data?.prs?.length || 0,
          });
        } catch (parseError) {
          console.error('branchManagerService.getPendingPRs - Failed to parse string:', parseError, {
            stringLength: data.length,
            stringPreview: data.substring(0, 100),
          });
          // Return empty result instead of throwing
          return { prs: [] };
        }
      }
      
      // If data is null or undefined, return empty result
      if (!data) {
        console.warn('branchManagerService.getPendingPRs - Received null/undefined data');
        return { prs: [] };
      }
      
      return data;
    } catch (error: any) {
      console.error('branchManagerService.getPendingPRs - Error:', {
        error,
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      throw error;
    }
  },

  approvePR: async (prId: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/prs/${prId}/approve`);
    return response.data;
  },

  rejectPR: async (prId: string, comment: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/prs/${prId}/reject`, { comment });
    return response.data;
  },

  returnPR: async (prId: string, comment: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/prs/${prId}/return`, { comment });
    return response.data;
  },

  // PR History
  getPRHistory: async (params?: {
    status?: string;
    department?: string;
    days?: number;
  }): Promise<PRHistoryData> => {
    const response = await api.get('/branch-manager/pr-history', { params });
    return response.data;
  },

  // Branch Overview
  getBranchOverview: async (): Promise<BranchOverviewData> => {
    const response = await api.get('/branch-manager/branch-overview');
    return response.data;
  },

  // Notifications
  getNotifications: async (): Promise<BranchManagerNotificationsData> => {
    const response = await api.get('/branch-manager/notifications');
    return response.data;
  },

  // Budget Exception Approval
  getBudgetExceptions: async (): Promise<{
    exceptions: Array<{
      id: string;
      prNumber: string;
      prAmount: number;
      purchasePrice: number;
      currency: string;
      overPercent: number;
    }>;
  }> => {
    const response = await api.get('/branch-manager/budget-exceptions');
    return response.data;
  },

  approveBudgetException: async (prId: string, comment?: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/budget-exceptions/${prId}/approve`, { comment });
    return response.data;
  },

  rejectBudgetException: async (prId: string, comment?: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/budget-exceptions/${prId}/reject`, { comment });
    return response.data;
  },

  requestNegotiation: async (prId: string, comment: string): Promise<{ message: string }> => {
    const response = await api.post(`/branch-manager/budget-exceptions/${prId}/request-negotiation`, { comment });
    return response.data;
  },
};

