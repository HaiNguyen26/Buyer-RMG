import axios from 'axios';

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

export interface DashboardData {
  totalPRs: number;
  prsByStatus: Array<{
    status: string;
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
    const response = await api.get('/requestor/dashboard');
    return response.data;
  },

  // Get My PRs
  getMyPRs: async (filters?: { status?: string }): Promise<{ prs: PRData[] }> => {
    const response = await api.get('/requestor/prs', { params: filters });
    return response.data;
  },

  // Get PR by ID
  getPR: async (id: string): Promise<PRData> => {
    const response = await api.get(`/requestor/prs/${id}`);
    return response.data;
  },

  // Get Next PR number by Department (preview)
  getNextPRNumber: async (department: string): Promise<{ prNumber: string }> => {
    const response = await api.get('/requestor/prs/next-number', { params: { department } });
    return response.data;
  },

  // Create PR
  createPR: async (data: {
    department: string;
    type?: 'COMMERCIAL' | 'PRODUCTION';
    requiredDate?: string; // Estimated Date of Received
    currency?: string;
    tax?: number;
    notes?: string;
    items: Array<{
      description: string;
      partNo?: string;
      spec?: string;
      manufacturer?: string;
      qty: number;
      unit?: string;
      unitPrice?: number;
      purpose?: string;
      remark?: string;
    }>;
    action: 'SAVE' | 'SUBMIT';
  }): Promise<PRData> => {
    const response = await api.post('/requestor/prs', data);
    return response.data;
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
      purpose?: string;
      remark?: string;
    }>;
    action: 'UPDATE' | 'RESUBMIT';
  }): Promise<PRData> => {
    const response = await api.put(`/requestor/prs/${id}`, data);
    return response.data;
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
      };
    }>;
  }> => {
    const response = await api.get('/requestor/prs/tracking');
    return response.data;
  },

  // Get PR Tracking
  getPRTracking: async (id: string): Promise<PRTrackingData> => {
    const response = await api.get(`/requestor/prs/${id}/tracking`);
    return response.data;
  },

  // Get Notifications
  getNotifications: async (): Promise<{ notifications: NotificationData[] }> => {
    const response = await api.get('/requestor/notifications');
    return response.data;
  },
};

