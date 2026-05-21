import axios from 'axios';
import {
  shouldServeDeptHeadMock,
  getDeptHeadMockStockIssueById,
  getDeptHeadMockStockIssues,
} from '../mocks/departmentHeadDevMock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type StockIssueStatus =
  | 'DRAFT'
  | 'RESERVED'
  | 'APPROVED'
  | 'ISSUED'
  | 'REJECTED'
  | 'CANCELLED';

export interface StockIssueSalesPODto {
  id: string;
  salesPONumber: string;
  customerPONumber: string | null;
}

export interface StockIssueItemDto {
  id: string;
  lineNo: number;
  partInternalCode: string;
  partName: string | null;
  unit: string | null;
  qty: number;
  qtyShipped?: number;
  reservedQty?: number;
  description: string | null;
}

export interface StockIssuePurchaseRequestDto {
  id: string;
  prNumber: string;
  projectCode: string | null;
  projectName: string | null;
}

export interface StockIssueDto {
  id: string;
  issueNumber: string;
  status: StockIssueStatus;
  purpose: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  requestor?: { id: string; username: string; fullName: string | null };
  salesPO?: StockIssueSalesPODto | null;
  purchaseRequest?: StockIssuePurchaseRequestDto | null;
  items: StockIssueItemDto[];
}

export interface ListStockIssuesParams {
  status?: string;
  from?: string;
  to?: string;
  salesPo?: string;
}

export async function getNextIssueNumber(): Promise<{ issueNumber: string }> {
  const { data } = await api.get('/requestor/stock-issues/next-number');
  return data;
}

export async function getPartStockAvailability(codes: string[]): Promise<{
  byPart: Record<string, { available: number; onHand: number; reserved: number }>;
}> {
  if (!codes.length) return { byPart: {} };
  const { data } = await api.get('/requestor/stock-issues/part-stock', {
    params: { codes: codes.join(',') },
  });
  return data;
}

export async function listMyStockIssues(
  params?: ListStockIssuesParams
): Promise<{ issues: StockIssueDto[] }> {
  if (shouldServeDeptHeadMock()) {
    let issues = getDeptHeadMockStockIssues();
    if (params?.status) {
      const raw = params.status;
      const tokens = raw.includes(',') ? raw.split(',') : [raw];
      issues = issues.filter((i) => tokens.includes(i.status));
    }
    return { issues };
  }
  const { data } = await api.get<{ issues: StockIssueDto[] }>('/requestor/stock-issues', { params });
  return data;
}

export async function getStockIssueRequestor(id: string): Promise<StockIssueDto> {
  if (shouldServeDeptHeadMock()) {
    const row = getDeptHeadMockStockIssueById(id);
    if (row) return row;
  }
  const { data } = await api.get<StockIssueDto>(`/requestor/stock-issues/${id}`);
  return data;
}

export interface CreateStockIssueLine {
  partInternalCode: string;
  partName?: string;
  unit?: string;
  qty: number;
  description?: string;
}

export async function createStockIssue(payload: {
  purpose?: string;
  notes?: string;
  salesPoId?: string;
  purchaseRequestId?: string;
  items: CreateStockIssueLine[];
  action: 'DRAFT' | 'SUBMIT';
}): Promise<StockIssueDto> {
  const { data } = await api.post('/requestor/stock-issues', payload);
  return data;
}

export async function updateDraftStockIssue(
  id: string,
  payload: {
    purpose?: string;
    notes?: string;
    salesPoId?: string;
    purchaseRequestId?: string | null;
    items: CreateStockIssueLine[];
  }
): Promise<StockIssueDto> {
  const { data } = await api.put(`/requestor/stock-issues/${id}`, payload);
  return data;
}

export async function submitStockIssue(id: string): Promise<StockIssueDto> {
  const { data } = await api.post(`/requestor/stock-issues/${id}/submit`);
  return data;
}

export async function cancelStockIssue(id: string): Promise<StockIssueDto> {
  const { data } = await api.post(`/requestor/stock-issues/${id}/cancel`);
  return data;
}

export async function patchStockIssueItemQty(
  issueId: string,
  itemId: string,
  qty: number
): Promise<StockIssueDto> {
  const { data } = await api.patch(`/requestor/stock-issues/${issueId}/items/${itemId}`, { qty });
  return data;
}

/** Warehouse API */
export async function listWarehouseStockIssues(
  params?: ListStockIssuesParams
): Promise<{ issues: StockIssueDto[] }> {
  const { data } = await api.get('/warehouse/stock-issues/inbox', { params });
  return data;
}

export async function getStockIssueWarehouse(id: string): Promise<StockIssueDto> {
  const { data } = await api.get(`/warehouse/stock-issues/${id}`);
  return data;
}

export async function approveStockIssue(id: string): Promise<StockIssueDto> {
  const { data } = await api.post(`/warehouse/stock-issues/${id}/approve`);
  return data;
}

export async function rejectStockIssue(id: string, reason: string): Promise<StockIssueDto> {
  const { data } = await api.post(`/warehouse/stock-issues/${id}/reject`, { reason });
  return data;
}

export async function shipStockIssue(
  id: string,
  body?: { items?: { itemId: string; qty: number }[] }
): Promise<StockIssueDto> {
  const raw = body?.items?.filter((i) => i.itemId && Number(i.qty) > 0) ?? [];
  const payload = raw.length ? { items: raw } : {};
  const { data } = await api.post(`/warehouse/stock-issues/${id}/ship`, payload);
  return data;
}
