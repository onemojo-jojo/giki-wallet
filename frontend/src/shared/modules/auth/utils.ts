export type AuthUserType = 'STUDENT' | 'EMPLOYEE';

export function extractStudentRegIdFromEmail(email: string): string | null {
    const normalized = email.trim().toLowerCase();
    // Match (u|gcs|gcv|gee|gem|ges) followed by digits
    const match = normalized.match(/^(?:u|ges|gcs|gcv|gee|gem)(\d+)@giki\.edu\.pk$/);
    return match?.[1] ?? null;
}

export function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}


