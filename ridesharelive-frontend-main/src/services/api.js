import axios from 'axios';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// API service functions
export const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await apiClient({
      url: endpoint,
      ...options,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// Auth API
export const authAPI = {
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  
  register: (userData) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  refreshToken: () => apiRequest('/auth/refresh', {
    method: 'POST',
  }),
  
  logout: () => apiRequest('/auth/logout', {
    method: 'POST',
  }),
};

// Ride API
export const rideAPI = {
  getRides: () => apiRequest('/api/rides'),
  
  createRide: (rideData) => apiRequest('/api/rides', {
    method: 'POST',
    body: JSON.stringify(rideData),
  }),
  
  getRideById: (id) => apiRequest(`/api/rides/${id}`),
  
  updateRideStatus: (id, status) => apiRequest(`/api/rides/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  
  cancelRide: (id, reason) => apiRequest(`/api/rides/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
};

// User API
export const userAPI = {
  getProfile: () => apiRequest('/api/user/profile'),
  
  updateProfile: (profileData) => apiRequest('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  }),
  
  getRideHistory: () => apiRequest('/api/user/rides'),
  
  getSettings: () => apiRequest('/api/user/settings'),
  
  updateSettings: (settings) => apiRequest('/api/user/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
};

// Driver API
export const driverAPI = {
  getAvailableRides: () => apiRequest('/api/driver/available-rides'),
  
  acceptRide: (rideId) => apiRequest(`/api/driver/rides/${rideId}/accept`, {
    method: 'POST',
  }),
  
  updateLocation: (location) => apiRequest('/api/driver/location', {
    method: 'POST',
    body: JSON.stringify(location),
  }),
  
  getEarnings: () => apiRequest('/api/driver/earnings'),
  
  getDriverStats: () => apiRequest('/api/driver/stats'),
};

// Payment API
export const paymentAPI = {
  createPaymentIntent: (rideId, amount) => apiRequest('/api/payment/create-intent', {
    method: 'POST',
    body: JSON.stringify({ rideId, amount }),
  }),
  
  confirmPayment: (paymentIntentId) => apiRequest('/api/payment/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  }),
  
  getPaymentMethods: () => apiRequest('/api/payment/methods'),
  
  addPaymentMethod: (methodData) => apiRequest('/api/payment/methods', {
    method: 'POST',
    body: JSON.stringify(methodData),
  }),
};

// Notification API
export const notificationAPI = {
  getNotifications: () => apiRequest('/api/notifications'),
  
  markAsRead: (notificationId) => apiRequest(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
  }),
  
  markAllAsRead: () => apiRequest('/api/notifications/read-all', {
    method: 'PATCH',
  }),
  
  subscribeToPush: (subscription) => apiRequest('/api/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
  }),
};

export default apiClient;
