import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api/notifications`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  // Ensure response is parsed as JSON
  responseType: 'json',
  transformResponse: [(data) => {
    // If data is already an object, return it
    if (typeof data === 'object' && data !== null) {
      return data;
    }
    // If data is a string, try to parse it as JSON
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('❌ Failed to parse JSON response:', e);
        console.error('❌ Raw data:', data);
        return { notifications: [] };
      }
    }
    // Fallback
    return { notifications: [] };
  }],
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const notificationService = {
  // Get notifications
  getNotifications: async (status?: string) => {
    console.log('📬 API: getNotifications called with status:', status);
    const params = status ? { status } : {};
    try {
      const response = await api.get('/', { 
        params,
        decompress: true,
        timeout: 10000,
      });
      
      console.log('📬 API: getNotifications response status:', response.status);
      console.log('📬 API: getNotifications response headers:', response.headers);
      console.log('📬 API: getNotifications response data type:', typeof response.data);
      console.log('📬 API: getNotifications response data:', response.data);
      
      // Handle case where response.data is a string (Axios didn't auto-parse)
      let parsedData = response.data;
      if (typeof response.data === 'string') {
        console.warn('⚠️ Response data is string, attempting to parse JSON...');
        console.warn('⚠️ String length:', response.data.length);
        console.warn('⚠️ String preview (first 200 chars):', response.data.substring(0, 200));
        try {
          parsedData = JSON.parse(response.data);
          console.log('✅ Successfully parsed string to object');
          console.log('✅ Parsed data:', parsedData);
        } catch (e) {
          console.error('❌ Failed to parse response data as JSON:', e);
          console.error('❌ Raw string:', response.data);
          return { notifications: [] };
        }
      }
      
      console.log('📬 API: Parsed data type:', typeof parsedData);
      console.log('📬 API: Parsed data keys:', parsedData ? Object.keys(parsedData) : 'null');
      console.log('📬 API: parsedData.notifications:', parsedData?.notifications);
      console.log('📬 API: parsedData.notifications type:', typeof parsedData?.notifications);
      console.log('📬 API: parsedData.notifications isArray:', Array.isArray(parsedData?.notifications));
      console.log('📬 API: parsedData.notifications length:', parsedData?.notifications?.length);
      
      // Check if parsedData is the notifications array directly
      if (Array.isArray(parsedData)) {
        console.warn('⚠️ API response is array directly, wrapping in object');
        return { notifications: parsedData };
      }
      
      // Ensure we return the correct format
      if (!parsedData || !parsedData.notifications) {
        console.warn('⚠️ API response missing notifications array');
        console.warn('⚠️ Parsed data:', JSON.stringify(parsedData, null, 2));
        return { notifications: Array.isArray(parsedData) ? parsedData : [] };
      }
      
      // Return with fallback
      const result = { notifications: parsedData.notifications || [] };
      console.log('📬 API: Returning result:', {
        hasNotifications: !!result.notifications,
        notificationsType: Array.isArray(result.notifications) ? 'array' : typeof result.notifications,
        notificationsLength: result.notifications?.length || 0,
      });
      
      return result;
    } catch (error: any) {
      console.error('❌ API: getNotifications error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error response headers:', error.response?.headers);
      throw error;
    }
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await api.get('/unread-count');
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (id: string) => {
    const response = await api.post(`/${id}/read`);
    return response.data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const response = await api.post('/mark-all-read');
    return response.data;
  },
};


