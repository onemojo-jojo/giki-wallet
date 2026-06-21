import { create } from 'zustand';
import { getErrorMessage } from '@/lib/errors';
import {
    signUp,
    signIn,
    signOut as apiSignOut,
    getMe,
    verifyEmail,
    type SignUpPayload,
    type SignInPayload,
    type AuthResponse,
} from '@/shared/modules/auth/api';

export type AuthUserType = 'STUDENT' | 'EMPLOYEE' | 'SUPER_ADMIN' | 'TRANSPORT_ADMIN' | 'FINANCE_ADMIN';

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    phone_number?: string | null;
    user_type: AuthUserType;
    created_at?: string;
    updated_at?: string;
};

type AuthState = {
    token: string | null;
    user: AuthUser | null;
    isLoading: boolean;
    initialized: boolean;
    error: string | null;

    signOut: () => void;
    loadMe: () => Promise<void>;
    verifyAndLogin: (token: string) => Promise<void>;
    refreshSession: () => Promise<void>;

    registerUser: (input: SignUpPayload) => Promise<AuthUser>;
    login: (input: SignInPayload) => Promise<void>;
};

function getApiErrorMessage(err: unknown): string {
    if (typeof err !== 'object' || err === null) return 'Something went wrong';
    const maybeAxios = err as {
        response?: { data?: { code?: unknown; error?: unknown; message?: unknown } };
        message?: unknown;
    };
    const msg =
        maybeAxios.response?.data?.message ||
        maybeAxios.response?.data?.error ||
        maybeAxios.response?.data?.message ||
        maybeAxios.message;
    return typeof msg === 'string' && msg.trim() ? msg : 'Something went wrong';
}

function mapAuthResponseToUser(data: AuthResponse): AuthUser {
    return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone_number: data.phone_number ?? null,
        user_type: data.user_type,
    };
}

export const useAuthStore = create<AuthState>()(
    (set) => ({
        token: localStorage.getItem('auth_token'),
        user: null,
        isLoading: false,
        initialized: false,
        error: null,

        signOut: () => {
            void apiSignOut().catch(() => { });
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            set({ token: null, user: null, error: null, isLoading: false, initialized: true });
        },

        loadMe: async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    localStorage.removeItem('refresh_token');
                    set({ token: null, user: null, initialized: true });
                    return;
                }
                const data = await getMe();
                set({
                    token,
                    user: mapAuthResponseToUser(data),
                    initialized: true
                });
            } catch {
                // If loadMe fails (token expired), we leave it to the axios interceptor 
                // to attempt a refresh. We don't clear localStorage here to avoid
                // killing a session that could be refreshed.
                set({ initialized: true });
            }
        },

        verifyAndLogin: async (token: string) => {
            set({ isLoading: true, error: null });
            try {
                const data = await verifyEmail(token);
                const accessToken = data.auth?.access_token;

                if (!accessToken) throw new Error('Access token not received');

                localStorage.setItem('auth_token', accessToken);
                localStorage.removeItem('refresh_token');

                set({
                    token: accessToken,
                    user: mapAuthResponseToUser(data),
                    isLoading: false,
                    error: null,
                    initialized: true
                });
            } catch (e) {
                const message = getErrorMessage(e);
                set({ error: message, isLoading: false });
                throw new Error(message);
            }
        },

        refreshSession: async () => {
            try {
                const { refreshToken: apiRefreshToken } = await import('@/shared/modules/auth/api');
                const data = await apiRefreshToken();

                const accessToken = data.auth?.access_token;

                if (!accessToken) throw new Error('Failed to refresh access token');

                localStorage.setItem('auth_token', accessToken);
                localStorage.removeItem('refresh_token');

                set({
                    token: accessToken,
                    // If we don't have user object yet (silent refresh), map it if it exists in response
                    user: data.id ? mapAuthResponseToUser(data) : useAuthStore.getState().user,
                    error: null,
                    initialized: true
                });
            } catch (e) {
                console.error('Session refresh failed:', e);
                useAuthStore.getState().signOut();
                throw e;
            }
        },

        registerUser: async (input) => {
            set({ isLoading: true, error: null });
            try {
                const data = await signUp(input);
                const user = mapAuthResponseToUser(data);
                // Register does not sign in (students must verify; employees may need approval).
                set({ isLoading: false, error: null });
                return user;
            } catch (e) {
                const message = getErrorMessage(e);
                set({ error: message, isLoading: false });
                throw new Error(message);
            }
        },

        login: async (input) => {
            set({ isLoading: true, error: null });
            try {
                const data = await signIn(input);
                const accessToken = data.auth?.access_token;

                if (!accessToken) throw new Error('Access token not received');

                localStorage.setItem('auth_token', accessToken);
                localStorage.removeItem('refresh_token');

                set({
                    token: accessToken,
                    user: mapAuthResponseToUser(data),
                    isLoading: false,
                    error: null,
                    initialized: true
                });
            } catch (e) {
                const message = getErrorMessage(e);
                set({ error: message, isLoading: false });
                throw new Error(message);
            }
        },
    })
);
