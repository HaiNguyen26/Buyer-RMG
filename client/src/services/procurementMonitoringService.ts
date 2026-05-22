import axios from 'axios';

const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export type MonitorApiBase =
  | 'buyer-manager'
  | 'branch-manager'
  | 'department-head'
  | 'manager';

export type MonitorSlaLevel = 'healthy' | 'warning' | 'critical' | 'completed';

export type MonitorExportLifecycle = 'all' | 'pending' | 'completed';

export type ProcurementMonitoringSnapshot = {
  generatedAt: string;
  scopeLabel: string;
  kpis: {
    prInProgress: number;
    poInTransit: number;
    itemsAwaitingPurchase: number;
    poOverEta: number;
    reopenProcurement: number;
    totalSourcingValue: number;
  };
  pipeline: Array<{ key: string; label: string; count: number }>;
  rows: Array<{
    prId: string;
    prNumber: string;
    department: string | null;
    branch: string | null;
    buyerName: string | null;
    currentStep: string;
    currentStepDetail: string | null;
    eta: string | null;
    sla: MonitorSlaLevel;
    slaLabel: string;
    risk: string | null;
    riskLabel: string | null;
    prStatus: string;
    progressPercent: number;
    hasReopen: boolean;
    itemCount: number;
    rfqCount: number;
    poCount: number;
  }>;
  reopenRows: Array<{
    prId: string;
    prNumber: string;
    itemLabel: string;
    buyerName: string | null;
    reason: string | null;
    qtyWaiting: number;
  }>;
  costRows: Array<{
    prId: string;
    prNumber: string;
    budget: number;
    currentCost: number;
    variance: number;
    direction: 'over' | 'savings' | 'on_budget';
  }>;
  deliveryRows: Array<{
    poId: string;
    poNumber: string;
    prNumber: string;
    vendorName: string;
    eta: string | null;
    receivedLabel: string;
    isOverdue: boolean;
  }>;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium';
    category: string;
    title: string;
    description: string;
    prNumber?: string;
    poNumber?: string;
    detectedAt: string;
  }>;
};

function createClient(base: MonitorApiBase) {
  const client = axios.create({
    baseURL: `${API_ROOT}/${base}`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 45000,
  });
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return client;
}

export async function fetchProcurementMonitoring(
  apiBase: MonitorApiBase
): Promise<ProcurementMonitoringSnapshot> {
  const { data } = await createClient(apiBase).get<ProcurementMonitoringSnapshot>(
    '/procurement-monitor'
  );
  return data;
}

export async function fetchProcurementMonitorPrDetail(
  apiBase: MonitorApiBase,
  prId: string
) {
  const { data } = await createClient(apiBase).get(`/procurement-monitor/${prId}`);
  return data;
}

export async function downloadProcurementMonitorExcel(
  apiBase: MonitorApiBase,
  lifecycle: MonitorExportLifecycle
): Promise<Blob> {
  const { data, headers } = await createClient(apiBase).get<Blob>('/procurement-monitor/export', {
    params: { lifecycle },
    responseType: 'blob',
  });

  const disposition = headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1];

  if (data instanceof Blob && data.type?.includes('json')) {
    const text = await data.text();
    let message = 'Không xuất được Excel';
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  const blob = data instanceof Blob ? data : new Blob([data]);
  if (filename) {
    Object.defineProperty(blob, 'filename', { value: filename, enumerable: true });
  }
  return blob;
}
