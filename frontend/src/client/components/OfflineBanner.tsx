import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (cb: () => void) => {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
    };
};

/** "You're offline" strip (v2-States). Shown only while the browser reports no connection. */
export const OfflineBanner = () => {
    const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
    if (online) return null;
    return (
        <div role="status" className="mb-4 flex items-center gap-3 bg-ink text-white rounded-[18px] px-4 py-3.5">
            <WifiOff className="size-5 text-volt shrink-0" aria-hidden="true" />
            <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-extrabold">You're offline</span>
                <span className="text-xs text-[#D9D6F2]">Showing what was last loaded. Booking and top-ups need a connection.</span>
            </span>
        </div>
    );
};
