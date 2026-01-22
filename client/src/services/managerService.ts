import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Create axios instance with auth header
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Executive Dashboard Data
export interface ExecutiveDashboardData {
  activeSalesPOs: number;
  totalActualCost: number;
  projectsNearBudget: Array<{
    salesPONumber: string;
    projectName: string;
    salesPOAmount: number;
    actualCost: number;
    remainingBudget: number;
    progress: number;
  }>;
  projectsOverBudget: Array<{
    salesPONumber: string;
    projectName: string;
    salesPOAmount: number;
    actualCost: number;
    remainingBudget: number;
    progress: number;
  }>;
  prByStatus: {
    submitted: number;
    readyForRFQ: number;
    collectingQuotation: number;
    supplierSelected: number;
  };
}

// PR Overview Data
export interface PROverviewData {
  prs: Array<{
    id: string;
    prNumber: string;
    itemName: string;
    salesPO: {
      number: string;
      project: string;
    } | null;
    branch: string;
    department: string;
    buyer: {
      name: string;
      email: string;
    } | null;
    status: string;
    createdAt: string;
  }>;
}

// Supplier Overview Data
export interface SupplierOverviewData {
  suppliers: Array<{
    id: string;
    name: string;
    email: string;
    totalParticipations: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    recentPRs: Array<{
      prNumber: string;
      status: string;
      createdAt: string;
    }>;
  }>;
}

// Buyer Performance Data
export interface BuyerPerformanceData {
  buyers: Array<{
    id: string;
    name: string;
    email: string;
    totalPRs: number;
    avgProcessingTimeMinutes: number;
    returnedPRs: number;
    delayedPRs: number;
  }>;
}

// Notification Data
export interface NotificationData {
  id: string;
  type: 'BUDGET_EXCEEDED' | 'PR_STUCK' | 'BUYER_OVERLOADED' | 'PROJECT_NEAR_BUDGET';
  message: string;
  details?: {
    project?: {
      salesPONumber: string;
      projectName: string;
    };
    pr?: {
      prNumber: string;
      itemName: string;
    };
    buyer?: {
      name: string;
      totalPRs: number;
    };
  };
  createdAt: string;
  read: boolean;
}

export interface NotificationsData {
  notifications: NotificationData[];
}

// API Functions
export const managerService = {
  // Executive Dashboard
  getExecutiveDashboard: async (): Promise<ExecutiveDashboardData> => {
    const response = await api.get('/manager/dashboard');
    return response.data;
  },

  // PR Overview
  getPROverview: async (params?: {
    branch?: string;
    department?: string;
    salesPO?: string;
    buyer?: string;
    status?: string;
  }): Promise<PROverviewData> => {
    const response = await api.get('/manager/pr-overview', { params });
    return response.data;
  },

  // Supplier Overview
  getSupplierOverview: async (params?: {
    sortBy?: 'frequency' | 'winRate' | 'name';
  }): Promise<SupplierOverviewData> => {
    const response = await api.get('/manager/supplier-overview', { params });
    return response.data;
  },

  // Buyer Performance
  getBuyerPerformance: async (params?: {
    sortBy?: 'prCount' | 'avgProcessingTime' | 'returnedCount' | 'name';
  }): Promise<BuyerPerformanceData> => {
    const response = await api.get('/manager/buyer-performance', { params });
    return response.data;
  },

  // Notifications
  getNotifications: async (): Promise<NotificationsData> => {
    const response = await api.get('/manager/notifications');
    return response.data;
  },
};


