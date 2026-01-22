import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: `${API_URL}/buyer-manager`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Dashboard
export interface BuyerManagerDashboardData {
  metrics: {
    totalPRsInProgress: number;
    avgLeadTime: number;
    avgPriceTrend: number;
    buyerEfficiency: number;
  };
  buyerPerformance: Array<{
    name: string;
    role: string;
    prsHandled: number;
    avgTime: number;
  }>;
  priceTrends: Array<{
    category: string;
    period: string;
    change: number;
  }>;
}

// Team Management - Buyer Team
export interface BuyerTeamMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'BUYER' | 'BUYER_LEADER';
  purchaseTypes: Array<'DOMESTIC' | 'OVERSEA' | 'SERVICE'>; // Loại mua chuyên biệt
  activePRs: number; // Số PR đang xử lý
  avgLeadTime: number; // Lead time trung bình (ngày)
  overBudgetRate: number; // Tỷ lệ over-budget (%)
  // KPI Metrics
  onTimeRate: number; // % PR đúng hạn
  overBudgetPRRate: number; // % PR vượt ngân sách
  reworkRate: number; // % PR phải làm lại
  avgPriceVsEstimate: number; // Giá trung bình so với requestor estimate (%)
  totalPRsCompleted: number; // Tổng số PR đã hoàn thành
  totalPRsInProgress: number; // Tổng số PR đang xử lý
  workload: 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED'; // Mức độ tải
}

export interface TeamManagementData {
  totalMembers: number;
  buyerLeaders: number;
  buyers: number;
  avgEfficiency: number;
  totalWorkload: number;
  members: BuyerTeamMember[];
}

// Re-assign PR Data
export interface ReassignPRData {
  prId: string;
  currentBuyerId: string;
  newBuyerId: string;
  reason: string;
  itemIds?: string[]; // Nếu chia theo item
}

// Cost Analysis
export interface CostAnalysisData {
  avgSaving: number;
  avgLeadTime: number;
  riskySuppliers: number;
  priceTrendData: Array<{
    month: string;
    marketPrice: number;
    actualPrice: number;
  }>;
  leadTimeByCategory: Array<{
    category: string;
    avgLeadTime: number;
    targetLeadTime: number;
  }>;
  riskySuppliersList: Array<{
    name: string;
    reason: string;
    riskScore: number;
  }>;
}

// Supplier Performance
export interface SupplierPerformanceData {
  totalSuppliers: number;
  onTimeDeliveryRate: number;
  priceStability: number;
  avgLeadTime: number;
  suppliers: Array<{
    name: string;
    category: string;
    priceStability: number;
    onTimeDelivery: number;
    avgLeadTime: number;
    qualityRating: number;
    totalPRs: number;
    ranking: string;
  }>;
  topPerformers: Array<{
    name: string;
    category: string;
    score: number;
  }>;
  bottomPerformers: Array<{
    name: string;
    issue: string;
    score: number;
  }>;
}

// Strategic Reports
export interface StrategicReportsData {
  totalSaving: number;
  savingAmount: number;
  supplyChainRisks: number;
  procurementEfficiency: number;
  costSavingDetails: Array<{
    category: string;
    description: string;
    savedAmount: number;
    percentage: number;
  }>;
  supplyChainRiskDetails: Array<{
    title: string;
    description: string;
    severity: string;
  }>;
  strategicRecommendations: Array<{
    title: string;
    description: string;
    impact: string;
    priority: string;
  }>;
}

// Policy Guidelines
export interface PolicyGuidelinesData {
  supplierSelectionRules: Array<{
    title: string;
    description: string;
  }>;
  priceThresholds: Array<{
    category: string;
    maxPrice: number;
    warningPrice: number;
  }>;
  leadTimeThresholds: Array<{
    category: string;
    targetDays: number;
    maxDays: number;
  }>;
  priorityCategories: Array<{
    name: string;
    priority: string;
    description: string;
    sla: number;
  }>;
  approvalWorkflow: Array<{
    role: string;
    action: string;
    condition: string;
  }>;
}

// Alerts & Risks
export interface AlertsRisksData {
  criticalAlerts: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
    affectedItems: number;
  }>;
  highAlerts: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
    affectedItems: number;
  }>;
  mediumAlerts: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
    affectedItems: number;
  }>;
  resolvedAlerts: number;
  riskTrends: Array<{
    category: string;
    trend: string;
    change: number;
    description: string;
  }>;
}

export const buyerManagerService = {
  getDashboard: async (): Promise<BuyerManagerDashboardData> => {
    const response = await api.get('/dashboard');
    return response.data;
  },

  getTeamManagement: async (): Promise<TeamManagementData> => {
    const response = await api.get('/team-management');
    return response.data;
  },

  // Re-assign PR between buyers
  reassignPR: async (data: ReassignPRData): Promise<any> => {
    const response = await api.post('/team-management/reassign-pr', data);
    return response.data;
  },

  // Get buyer KPIs
  getBuyerKPIs: async (buyerId: string): Promise<{
    onTimeRate: number;
    overBudgetPRRate: number;
    reworkRate: number;
    avgPriceVsEstimate: number;
    totalPRsCompleted: number;
    totalPRsInProgress: number;
    recentPRs: Array<{
      id: string;
      prNumber: string;
      status: string;
      onTime: boolean;
      overBudget: boolean;
      rework: boolean;
    }>;
  }> => {
    const response = await api.get(`/team-management/buyers/${buyerId}/kpis`);
    return response.data;
  },

  // Get PRs assigned to a buyer
  getBuyerPRs: async (buyerId: string, status?: string): Promise<any> => {
    const params = status ? { status } : {};
    const response = await api.get(`/team-management/buyers/${buyerId}/prs`, { params });
    return response.data;
  },

  getCostAnalysis: async (): Promise<CostAnalysisData> => {
    const response = await api.get('/cost-analysis');
    return response.data;
  },

  getSupplierPerformance: async (): Promise<SupplierPerformanceData> => {
    const response = await api.get('/supplier-performance');
    return response.data;
  },

  getStrategicReports: async (): Promise<StrategicReportsData> => {
    const response = await api.get('/strategic-reports');
    return response.data;
  },

  getPolicyGuidelines: async (): Promise<PolicyGuidelinesData> => {
    const response = await api.get('/policy-guidelines');
    return response.data;
  },

  getAlertsRisks: async (): Promise<AlertsRisksData> => {
    const response = await api.get('/alerts-risks');
    return response.data;
  },

  // PR Monitoring - Get all PRs (read-only)
  getAllPRs: async (status?: string): Promise<any> => {
    const params = status ? { status } : {};
    const response = await api.get('/prs', { params });
    return response.data;
  },
};


