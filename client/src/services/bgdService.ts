import axios from 'axios';

const API_URL = 'http://localhost:5000/api/bgd';

const getAuthHeader = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

// Executive Dashboard
export interface ExecutiveDashboardData {
  metrics: {
    totalSalesPOBudget: number;
    totalApprovedPRValue: number;
    projectsAtRisk: number;
    criticalPRsPending: number;
  };
  projectsAtRiskList: Array<{
    name: string;
    salesPOCode: string;
    budget: number;
    actualCost: number;
    remaining: number;
    usagePercent: number;
  }>;
  criticalPRsList: Array<{
    code: string;
    description: string;
    projectName: string;
    value: number;
    reason: string;
  }>;
  budgetUsage: {
    total: number;
    used: number;
    usedPercent: number;
  };
  costTrends: Array<{
    period: string;
    change: number;
    description: string;
  }>;
}

// Business Overview
export interface BusinessOverviewData {
  totalCost: number;
  activeProjects: number;
  prToPurchaseRatio: number;
  costDistribution: Array<{
    projectName: string;
    salesPOCode: string;
    amount: number;
    percentage: number;
  }>;
  demandTrends: Array<{
    period: string;
    prCount: number;
    totalValue: number;
  }>;
  maxPRCount: number;
  prStats: {
    totalPRs: number;
    completedPRs: number;
  };
}

// Exception Approval
export interface ExceptionApprovalData {
  pending: Array<{
    id: string;
    code: string;
    type: string;
    title: string;
    description: string;
    value: number;
    projectName: string;
    createdAt: string;
  }>;
  approved: Array<{
    id: string;
    title: string;
    description: string;
    approvedBy: string;
    approvedAt: string;
  }>;
  rejected: Array<{
    id: string;
    title: string;
    description: string;
    rejectionReason: string;
    rejectedBy: string;
    rejectedAt: string;
  }>;
}

// Strategic Supplier View
export interface StrategicSupplierViewData {
  keySuppliersCount: number;
  dependencyLevel: number;
  supplyChainRisks: number;
  totalPurchaseValue: number;
  keySuppliers: Array<{
    name: string;
    category: string;
    purchaseValue: number;
    dependencyPercent: number;
    totalPRs: number;
  }>;
  dependencyAnalysis: Array<{
    category: string;
    dependencyPercent: number;
    supplierCount: number;
  }>;
  supplyChainRiskList: Array<{
    title: string;
    description: string;
    impact: string;
    severity: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
  }>;
}

// Executive Reports
export interface ExecutiveReportsData {
  totalSaving: number;
  savingAmount: number;
  procurementEfficiency: number;
  completionRate: number;
  savingDetails: Array<{
    category: string;
    description: string;
    savedAmount: number;
    percentage: number;
  }>;
  procurementPerformance: Array<{
    name: string;
    value: string;
    percentage: number;
  }>;
  planVsActual: Array<{
    period: string;
    planned: number;
    actual: number;
  }>;
  summary: Array<{
    title: string;
    content: string;
  }>;
}

// Critical Alerts
export interface CriticalAlertsData {
  critical: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
    affectedProject?: string;
    impact?: string;
  }>;
  high: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
    affectedProject?: string;
  }>;
  medium: Array<{
    title: string;
    description: string;
    category: string;
    detectedAt: string;
  }>;
  resolved: number;
}

// Governance Policy
export interface GovernancePolicyData {
  approvalThresholds: Array<{
    category: string;
    description: string;
    threshold: number;
  }>;
  strategicPolicies: Array<{
    title: string;
    description: string;
    effectiveDate: string;
    updatedAt: string;
  }>;
  priorityGuidelines: Array<{
    category: string;
    priority: string;
    description: string;
    sla: number;
  }>;
  riskPolicies: Array<{
    title: string;
    description: string;
  }>;
}

export const bgdService = {
  getExecutiveDashboard: async (): Promise<ExecutiveDashboardData> => {
    const response = await axios.get(`${API_URL}/dashboard`, getAuthHeader());
    return response.data;
  },

  getBusinessOverview: async (): Promise<BusinessOverviewData> => {
    const response = await axios.get(`${API_URL}/business-overview`, getAuthHeader());
    return response.data;
  },

  getExceptionApprovals: async (): Promise<ExceptionApprovalData> => {
    const response = await axios.get(`${API_URL}/exception-approval`, getAuthHeader());
    return response.data;
  },

  approveException: async (id: string): Promise<void> => {
    await axios.post(`${API_URL}/exception-approval/${id}/approve`, {}, getAuthHeader());
  },

  rejectException: async (id: string, reason: string): Promise<void> => {
    await axios.post(`${API_URL}/exception-approval/${id}/reject`, { reason }, getAuthHeader());
  },

  getStrategicSupplierView: async (): Promise<StrategicSupplierViewData> => {
    const response = await axios.get(`${API_URL}/strategic-suppliers`, getAuthHeader());
    return response.data;
  },

  getExecutiveReports: async (): Promise<ExecutiveReportsData> => {
    const response = await axios.get(`${API_URL}/executive-reports`, getAuthHeader());
    return response.data;
  },

  getCriticalAlerts: async (): Promise<CriticalAlertsData> => {
    const response = await axios.get(`${API_URL}/critical-alerts`, getAuthHeader());
    return response.data;
  },

  getGovernancePolicy: async (): Promise<GovernancePolicyData> => {
    const response = await axios.get(`${API_URL}/governance`, getAuthHeader());
    return response.data;
  },
};


