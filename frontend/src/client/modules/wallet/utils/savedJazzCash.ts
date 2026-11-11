/**
 * "Save this number for next time" — kept ONLY on this device (localStorage),
 * and only when the user ticks the box. Nothing is sent to the server.
 */
export type SavedJazzCash = { mobile: string; cnicLast6: string };

const KEY = 'gw.savedJazzCash';

export const loadSavedJazzCash = (): SavedJazzCash | null => {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<SavedJazzCash>;
        if (typeof v.mobile === 'string' && /^\d{10,11}$/.test(v.mobile) && typeof v.cnicLast6 === 'string' && /^\d{6}$/.test(v.cnicLast6)) {
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
