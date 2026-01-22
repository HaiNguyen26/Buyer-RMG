import axios from 'axios';
import type { LoginCredentials, AuthResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/login', credentials);
        return response.data;
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

