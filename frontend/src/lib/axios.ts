// Axios instance with security configurations
import axios from 'axios';
import { extractAPIError, logError, type APIResponse } from './errors';

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/';

// Create axios instance with default config
export const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 60000, // 60 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send HttpOnly cookies (refresh_token) with requests
});

// Request interceptor - Add auth token if available
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - Handle errors globally
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
    refreshSubscribers.push(cb);
};

const onRereshed = (token: string) => {
    refreshSubscribers.map((cb) => cb(token));
    refreshSubscribers = [];
};

apiClient.interceptors.response.use(
    (response) => {
        // For successful responses, unwrap the APIResponse structure
        // and return just the data if available
        const data = response.data as APIResponse<unknown>;

        if (data && typeof data === 'object' && 'success' in data) {
            if (data.success && 'data' in data) {
                // Return just the data payload for successful responses
                response.data = data.data;
            }
        }

        return response;
    },
    async (error) => {
        const appError = extractAPIError(error);

        logError(appError, {
            url: error.config?.url,
            method: error.config?.method,
        });
        if (error.response?.status === 401) {

            const isAuthRequest = error.config?.url?.includes('/auth/signin') || error.config?.url?.includes('/auth/refresh');

            if (!isAuthRequest) {
                const originalRequest = error.config;

                if (!isRefreshing) {
                    isRefreshing = true;
                    try {
                        const { useAuthStore } = await import('@/shared/stores/authStore');
                        const store = useAuthStore.getState();

                        // Attempt silent refresh — HttpOnly cookie is sent automatically
                        console.log('Session expired, attempting silent refresh...');
                        await store.refreshSession();

                        const newToken = localStorage.getItem('auth_token');
                        isRefreshing = false;

                        if (newToken) {
                            onRereshed(newToken);
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            return apiClient(originalRequest);
                        }
                    } catch (refreshError) {
                        isRefreshing = false;
                        console.error('Silent refresh failed, logging out...');
                        refreshSubscribers = [];
                    }
                } else {
                    // Queue the request until refresh is done
                    return new Promise((resolve) => {
                        subscribeTokenRefresh((token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(apiClient(originalRequest));
                        });
                    });
                }
            }

            localStorage.removeItem('auth_token');

            if (window.location.pathname !== '/login' && window.location.pathname !== '/admin/signin') {
                console.warn('Session expired. Please log in again.');
            }
        }

        if (error.response?.status === 403) {
            console.error('Access forbidden:', appError.message);
        }

        if (error.code === 'ECONNABORTED') {
            console.warn('Request timed out. The server might be busy or restarting.');
        } else if (error.response?.status >= 500) {
            const data = error.response.data;
            if (typeof data === 'string' && data.includes('<html')) {
                console.warn(`Server error (${error.response.status}): Service is currently unavailable (Proxy/Edge error).`);
            }
        }

        return Promise.reject(appError);
    }
);

export default apiClient;

