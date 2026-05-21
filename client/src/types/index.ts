export interface User {
    id: string;
    username: string;
    email: string;
    /** Giá trị enum từ API (VD: WAREHOUSE, SALES, SYSTEM_ADMIN) */
    role: string;
    fullName?: string;
    jobTitle?: string;
    phone?: string;
    location?: string;
    department?: string;
    /** Username người duyệt cấp 1; thiếu thì không gửi duyệt PR được */
    directManagerCode?: string | null;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface CompareAwardSelectionMap {
    [purchaseRequestItemId: string]: string;
}

export interface CompareAwardOptimizePayload {
    rfqId: string;
    mode: 'lowest_cost' | 'cost_plus_leadtime';
    selections: CompareAwardSelectionMap;
}

export interface CompareAwardSubmitPayload {
    rfqId: string;
    selections: CompareAwardSelectionMap;
    justification: string;
}

export interface CompareAwardSplitPOPayload {
    rfqId: string;
    splits: Array<{ vendorId: string; amount: number }>;
}

