import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Invalidate warehouse React Query caches after GRN / inventory changes. */
export function invalidateWarehouseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['warehouse-grn-history'] });
  void queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
  void queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['warehouse-grn-po'] });
  void queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
  void queryClient.invalidateQueries({ queryKey: ['warehouse-stock-issues'] });
}

/**
 * Socket listener for warehouse screens — refetch GRN history when a receipt is posted.
 */
export function useWarehouseRealtime(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    let socket: Socket | null = io(API_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onGrn = () => {
      invalidateWarehouseQueries(queryClient);
      void queryClient.refetchQueries({ queryKey: ['warehouse-grn-history'], type: 'active' });
    };

    socket.on('warehouse:grn', onGrn);

    return () => {
      socket?.off('warehouse:grn', onGrn);
      socket?.close();
      socket = null;
    };
  }, [enabled, queryClient]);
}
