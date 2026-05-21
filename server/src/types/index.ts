export interface RegisterInput {
    username: string;
    email: string;
    password: string;
    role?: 'REQUESTOR' | 'BUYER' | 'APPROVER' | 'ACCOUNTANT';
    location?: string;
}

export interface LoginInput {
    username: string;
    password: string;
}

export interface AuthResponse {
    user: {
        id: string;
        username: string;
        email: string;
        role: string;
        location: string | null;
        /** Username người duyệt cấp 1 (DEPARTMENT_HEAD) — bắt buộc khi requestor gửi PR */
        directManagerCode?: string | null;
        fullName?: string;
        jobTitle?: string;
        phone?: string;
    };
    token: string;
}

