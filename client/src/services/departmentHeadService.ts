import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    // Log successful responses for pending PRs endpoint
    if (response.config.url?.includes('/pending-prs')) {
      console.log('Axios Response Interceptor - Department Head Pending PRs:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
        hasPrs: !!response.data?.prs,
        prsCount: response.data?.prs?.length || 0,
      });
      
      // Handle string response (similar to branch manager)
      if (typeof response.data === 'string' && response.data.trim()) {
        try {
          const parsed = JSON.parse(response.data);
          return { ...response, data: parsed };
        } catch (e) {
          console.error('Failed to parse string response:', e);
        }
      }
    }
    return response;
  },
  (error) => {
    // Log errors for pending PRs endpoint
    if (error.config?.url?.includes('/pending-prs')) {
      console.error('Axios Error Interceptor - Department Head Pending PRs:', {
        url: error.config?.url,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
    }
    return Promise.reject(error);
  }
);

// Get Department Head Dashboard
export const getDepartmentHeadDashboard = async () => {
  try {
    const response = await api.get('/department-head/dashboard');
    return response.data;
  } catch (error: any) {
    console.error('Get department head dashboard error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to load dashboard');
  }
};

// Get Pending PRs
export const getPendingPRs = async () => {
  try {
    const response = await api.get('/department-head/pending-prs');
    
    // Handle different response formats
    let data = response.data;
    
    // If response is a string, try to parse it
    if (typeof data === 'string' && data.trim()) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse string response:', e);
        throw new Error('Invalid response format');
      }
    }
    
    // Ensure we return the expected format
    if (data && data.prs) {
      return data;
    } else if (Array.isArray(data)) {
      return { prs: data };
    } else if (data && typeof data === 'object') {
      return data;
    } else {
      console.warn('Unexpected response format:', data);
      return { prs: [] };
    }
  } catch (error: any) {
    console.error('Get pending PRs error:', error);
    if (error.response?.status === 401) {
      throw new Error('Unauthorized. Please login again.');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    } else if (error.message) {
      throw error;
    } else {
      throw new Error('Network error. Please check your connection.');
    }
  }
};

// Approve PR
export const approvePR = async (prId: string, comment?: string) => {
  try {
    const response = await api.post(`/department-head/prs/${prId}/approve`, { comment });
    return response.data;
  } catch (error: any) {
    console.error('Approve PR error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to approve PR');
  }
};

// Reject PR
export const rejectPR = async (prId: string, comment: string) => {
  try {
    const response = await api.post(`/department-head/prs/${prId}/reject`, { comment });
    return response.data;
  } catch (error: any) {
    console.error('Reject PR error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to reject PR');
  }
};

// Return PR
export const returnPR = async (prId: string, comment: string) => {
  try {
    const response = await api.post(`/department-head/prs/${prId}/return`, { comment });
    return response.data;
  } catch (error: any) {
    console.error('Return PR error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to return PR');
  }
};

// Get Department Overview
export const getDepartmentOverview = async () => {
  try {
    const response = await api.get('/department-head/department-overview');
    return response.data;
  } catch (error: any) {
    console.error('Get department overview error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to load department overview');
  }
};

