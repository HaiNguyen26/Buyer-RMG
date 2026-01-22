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
    };
    token: string;
}

