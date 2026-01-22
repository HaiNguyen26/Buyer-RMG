export interface User {
    id: string;
    username: string;
    email: string;
    role: 'Requestor' | 'Buyer' | 'Approver' | 'Accountant';
    location?: string;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

