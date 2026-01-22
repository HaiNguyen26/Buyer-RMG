import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { notificationService } from '../services/notificationService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useNotifications() {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Get unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      console.log('📊 Fetching unread count...');
      const result = await notificationService.getUnreadCount();
      console.log('📊 Unread count result:', result);
      return result;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Get notifications
  const { data: notificationsData, isLoading: isLoadingNotifications, error: notificationsError } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      console.log('📊 Fetching notifications...');
      try {
        const result = await notificationService.getNotifications();
        console.log('📊 Notifications result:', result);
        console.log('📊 Notifications result type:', typeof result);
        console.log('📊 Notifications result keys:', result ? Object.keys(result) : 'null');
        console.log('📊 Notifications array:', result?.notifications);
        console.log('📊 Notifications array type:', typeof result?.notifications);
        console.log('📊 Notifications array isArray:', Array.isArray(result?.notifications));
        console.log('📊 Notifications count:', result?.notifications?.length || 0);
        
        // Ensure we have the correct structure
        if (!result || !result.notifications) {
          console.warn('⚠️ Result missing notifications array, returning empty array');
          return { notifications: [] };
        }
        
        return result;
      } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        // Return empty structure on error
        return { notifications: [] };
      }
    },
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Log errors
  useEffect(() => {
    if (notificationsError) {
      console.error('❌ Notifications query error:', notificationsError);
    }
  }, [notificationsError]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Initialize Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(API_URL, {
      path: '/socket.io',
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      console.log('✅ Socket ID:', newSocket.id);
      console.log('✅ Socket transport:', newSocket.io.engine.transport.name);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      console.error('❌ Error details:', error.message);
    });

    newSocket.on('notification', (data: any) => {
      console.log('🔔 ========== NOTIFICATION RECEIVED ==========');
      console.log('🔔 Notification data:', JSON.stringify(data, null, 2));
      console.log('🔔 Timestamp:', new Date().toISOString());
      // Invalidate queries to refetch immediately
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications-unread-count'] });
      console.log('🔔 Queries invalidated and refetched');
      console.log('🔔 ==========================================');
    });

    newSocket.on('badge:update', (badges: any) => {
      console.log('Badge update received:', badges);
      // Handle badge updates if needed
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [queryClient]);

  // Update unread count
  useEffect(() => {
    if (countData?.count !== undefined) {
      setUnreadCount(countData.count);
    }
  }, [countData]);

  // Debug: Log current state
  useEffect(() => {
    console.log('📊 useNotifications state:', {
      notificationsCount: notificationsData?.notifications?.length || 0,
      unreadCount,
      notifications: notificationsData?.notifications,
    });
  }, [notificationsData, unreadCount]);

  return {
    notifications: notificationsData?.notifications || [],
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    isLoading: markAsReadMutation.isPending || markAllAsReadMutation.isPending,
  };
}

