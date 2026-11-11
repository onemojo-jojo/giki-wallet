import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';

/**
 * Maximum wallet balance (in rupees) allowed by the server config.
 * Returns null until loaded or if the request fails, so callers can hide
 * anything that depends on it instead of showing a wrong number.
 */
export const useTopUpLimit = () => {
    const [maxLimit, setMaxLimit] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        apiClient
            .get<{ max_limit_paisa: number }>('/payment/limit')
            .then(({ data }) => {
                const value = data?.max_limit_paisa;
                if (!cancelled && typeof value === 'number' && Number.isFinite(value) && value > 0) {
                    setMaxLimit(value / 100);
                }
            })
            .catch(() => {
                /* leave as null — the cap meter is optional */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return maxLimit;
};
