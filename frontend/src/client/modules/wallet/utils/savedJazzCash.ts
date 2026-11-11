/**
 * "Save this number for next time" — kept ONLY on this device (localStorage),
 * and only when the user ticks the box. Nothing is sent to the server.
 */
export type SavedJazzCash = { mobile: string; cnicLast6: string };

const KEY = 'gw.savedJazzCash';

// Backend accepts 03XXXXXXXXX or 3XXXXXXXXX (backend/internal/payment/utils.go).
export const MOBILE_RE = /^(03\d{9}|3\d{9})$/;
export const CNIC_RE = /^\d{6}$/;

/** Digits only; a pasted +92 / 0092 prefix becomes the local 0. */
export const normalizeMobile = (input: string) => {
    let d = input.replace(/\D/g, '');
    if (d.startsWith('0092')) d = '0' + d.slice(4);
    else if (d.startsWith('92') && d.length >= 12) d = '0' + d.slice(2);
    return d.slice(0, 11);
};

export const loadSavedJazzCash = (): SavedJazzCash | null => {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<SavedJazzCash>;
        if (typeof v.mobile === 'string' && MOBILE_RE.test(v.mobile) && typeof v.cnicLast6 === 'string' && CNIC_RE.test(v.cnicLast6)) {
            return { mobile: v.mobile, cnicLast6: v.cnicLast6 };
        }
    } catch {
        /* storage unavailable or corrupt */
    }
    return null;
};

export const saveJazzCash = (v: SavedJazzCash) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
        /* storage unavailable */
    }
};

export const forgetJazzCash = () => {
    try {
        localStorage.removeItem(KEY);
    } catch {
        /* storage unavailable */
    }
};

/** "03001234567" → "0300 ••• 4567" */
export const maskMobile = (m: string) => (m.length >= 7 ? `${m.slice(0, 4)} ••• ${m.slice(-4)}` : m);
