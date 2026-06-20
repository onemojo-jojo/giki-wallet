import { apiClient } from '@/lib/axios';

export type SignUpPayload = {
    name: string;
    email: string;
    phone_number: string;
    password: string;
    user_type: 'STUDENT' | 'EMPLOYEE';
    reg_id: string;
};

export type SignInPayload = {
    email: string;
    password: string;
};

export type AuthResponse = {
    id: string;
    name: string;
    email: string;
    phone_number?: string;
    user_type: 'STUDENT' | 'EMPLOYEE' | 'SUPER_ADMIN' | 'TRANSPORT_ADMIN' | 'FINANCE_ADMIN';
    auth?: {
        access_token: string;
        expires_at: number;
    };
};

export async function signUp(payload: SignUpPayload) {
    const res = await apiClient.post<AuthResponse>('/auth/register', payload);
    return res.data;
}


export async function signIn(payload: SignInPayload) {
    const res = await apiClient.post<AuthResponse>('/auth/signin', payload);
    return res.data;
}


export async function getMe() {
    const res = await apiClient.get<AuthResponse>('/auth/me');
    return res.data;
}


export async function verifyEmail(token: string) {
    const res = await apiClient.get<AuthResponse>('/auth/verify', { params: { token } });
    return res.data;
}


export async function signOut() {
    await apiClient.post('/auth/signout');
}

export async function refreshToken() {
    // No body needed — refresh token is sent automatically via HttpOnly cookie
    const res = await apiClient.post<AuthResponse>('/auth/refresh');
    return res.data;
}

export async function requestPasswordReset(email: string) {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return res.data;
}

export async function resetPassword(payload: { token: string; password: string }) {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', payload);
    return res.data;
}
