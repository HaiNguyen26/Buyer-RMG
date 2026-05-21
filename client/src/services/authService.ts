import axios, { isAxiosError } from 'axios';
import type { LoginCredentials, AuthResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

function messageFromAxiosError(e: unknown): string | null {
    if (!isAxiosError(e) || !e.response?.data) return null;
    const d = e.response.data as { error?: string; message?: string };
    if (typeof d.error === 'string' && d.error.trim()) return d.error;
    if (typeof d.message === 'string' && d.message.trim()) return d.message;
    return null;
}

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        try {
            const response = await api.post<AuthResponse>('/auth/login', credentials);
            return response.data;
        } catch (e) {
            const fromApi = messageFromAxiosError(e);
            if (fromApi) throw new Error(fromApi);
            if (isAxiosError(e) && e.response?.status === 401) {
                throw new Error('Sai tên đăng nhập hoặc mật khẩu (401).');
            }
            throw e;
        }
    },

    register: async (credentials: LoginCredentials & { email: string }): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/register', credentials);
        return response.data;
    },

    getCurrentUser: async (): Promise<{ user: AuthResponse['user'] }> => {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }
        const response = await api.get<{ user: AuthResponse['user'] }>('/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem('token');
    },
};

