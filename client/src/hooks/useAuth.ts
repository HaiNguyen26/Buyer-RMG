import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { initSocket, disconnectSocket } from '../utils/socket';
import type { LoginCredentials, AuthResponse } from '../types';

export const useLogin = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
        onSuccess: (data: AuthResponse) => {
            localStorage.setItem('token', data.token);
            queryClient.setQueryData(['user'], data.user);
            
            // Initialize Socket.IO connection
            initSocket(data.token);
            
            // Redirect based on role
            if (data.user.role === 'SALES') {
                navigate('/dashboard/sales');
            } else if (data.user.role === 'REQUESTOR') {
                navigate('/dashboard/requestor');
            } else if (data.user.role === 'BUYER') {
                navigate('/dashboard/buyer');
            } else if (data.user.role === 'BUYER_MANAGER') {
                navigate('/dashboard/buyer-manager');
            } else if (data.user.role === 'BUYER_LEADER') {
                navigate('/dashboard/buyer-leader');
            } else if (data.user.username === 'buyer_manage') {
                navigate('/dashboard/buyer-manage');
            } else if (data.user.role === 'DEPARTMENT_HEAD') {
                navigate('/dashboard/department-head');
            } else if (data.user.role === 'BRANCH_MANAGER') {
                navigate('/dashboard/branch-manager');
            } else if (data.user.role === 'BGD') {
                navigate('/dashboard/bgd');
            } else if (data.user.role === 'SYSTEM_ADMIN') {
                navigate('/dashboard/system-admin');
            } else {
                navigate('/dashboard');
            }
        },
    });
};

export const useCurrentUser = () => {
    return useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const data = await authService.getCurrentUser();
            return data.user;
        },
        enabled: !!localStorage.getItem('token'),
        retry: false,
    });
};

export const useLogout = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return () => {
        // Disconnect Socket.IO
        disconnectSocket();
        
        authService.logout();
        queryClient.clear();
        navigate('/login');
    };
};

