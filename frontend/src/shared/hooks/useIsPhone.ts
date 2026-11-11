import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** True below the md breakpoint (phones), where we show on-screen keypads. */
export const useIsPhone = () => {
    const [isPhone, setIsPhone] = useState(() =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false
    );

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mql = window.matchMedia(QUERY);
        const onChange = () => setIsPhone(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return isPhone;
};
