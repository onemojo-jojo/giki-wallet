import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Eye, EyeOff, List, Plus, RotateCcw } from 'lucide-react';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { useTopUpLimit } from '@/client/modules/wallet/hooks/useTopUpLimit';
import { useAuthStore } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/initials';

const formatRs = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

/**
 * Home's Midnight header (v2-Home): avatar → profile, greeting, balance,
 * wallet-cap meter and Add / Ride / History. Hide/refresh are kept as small
 * icon buttons next to the balance label.
 */
export const BalanceHero = () => {
    const user = useAuthStore((s) => s.user);
    const { balance, isDataLoading, fetchBalance } = useWalletModuleStore();
    const maxLimit = useTopUpLimit();
    const [showBalance, setShowBalance] = useState(true);

    useEffect(() => {
        void fetchBalance();
    }, [fetchBalance]);

    const firstName = user?.name?.split(/\s+/)[0] ?? '';
    const capPercent = maxLimit ? Math.min(100, Math.max(0, (balance / maxLimit) * 100)) : null;
    const room = maxLimit ? Math.max(0, maxLimit - balance) : null;

    return (
        <section
            aria-label="Balance"
            className="-mx-4 -mt-4 md:mx-0 md:mt-0 relative overflow-hidden bg-ink text-white rounded-b-[32px] md:rounded-[28px] px-5 pt-[18px] pb-6 flex flex-col gap-5"
        >
            <svg aria-hidden="true" className="absolute right-0 top-0 h-full w-full pointer-events-none" viewBox="0 0 390 300" preserveAspectRatio="xMaxYMin slice" fill="none">
                <path d="M200 300 C 230 220, 330 230, 340 150 S 300 40, 410 10" stroke="#C8F04A" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />
                <circle cx="340" cy="150" r="5" fill="#C8F04A" fillOpacity="0.6" />
            </svg>

            <header className="relative flex items-center justify-between">
                <Link to="/account" className="flex items-center gap-2.5 rounded-2xl focus-visible:outline-2 focus-visible:outline-volt" aria-label={`My account, ${firstName}`}>
                    <span className="size-[42px] rounded-[14px] bg-iris flex items-center justify-center font-display font-bold text-base">
                        {getInitials(user?.name ?? '')}
                    </span>
                    <span className="flex flex-col leading-tight">
                        <span className="text-xs text-ink-muted">Salaam,</span>
                        <span className="text-base font-extrabold">{firstName}</span>
                    </span>
                </Link>
            </header>

            <div className="relative flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-ink-muted">G-Bux balance</span>
                    <button
                        type="button"
                        onClick={() => setShowBalance((v) => !v)}
                        aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                        className="size-11 -my-2 rounded-[12px] text-ink-muted hover:text-white flex items-center justify-center focus-visible:outline-2 focus-visible:outline-volt"
                    >
                        {showBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => void fetchBalance()}
                        aria-label="Refresh balance"
                        className="size-11 -my-2 rounded-[12px] text-ink-muted hover:text-white flex items-center justify-center focus-visible:outline-2 focus-visible:outline-volt"
                    >
                        <RotateCcw className={cn('size-4', isDataLoading && 'animate-spin')} />
                    </button>
                </span>
                <span className={cn('font-display font-extrabold text-[52px] leading-none tracking-tight tabular', isDataLoading && 'opacity-70')} aria-live={showBalance ? 'polite' : 'off'}>
                    {showBalance ? `Rs ${formatRs(balance)}` : 'Rs ••••'}
                </span>
                {capPercent !== null && room !== null && showBalance && (
                    <span className="flex items-center gap-2 mt-1.5">
                        <span role="img" aria-label={`Rs ${formatRs(balance)} of Rs ${formatRs(maxLimit!)} wallet cap`} className="w-[120px] h-1.5 rounded-full bg-ink-3 overflow-hidden">
                            <span className="block h-full rounded-full bg-volt" style={{ width: `${capPercent}%` }} />
                        </span>
                        <span className="text-xs text-[#D9D6F2]">Rs {formatRs(room)} room left</span>
                    </span>
                )}
            </div>

            <div className="relative grid grid-cols-3 gap-2.5">
                <Link to="/top-up" className="h-[52px] rounded-2xl bg-volt text-ink font-extrabold text-sm flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt">
                    <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                    Add
                </Link>
                <Link to="/transport" className="h-[52px] rounded-2xl bg-ink-2 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt">
                    <Bus className="size-[18px]" aria-hidden="true" />
                    Ride
                </Link>
                <Link to="/wallet" className="h-[52px] rounded-2xl bg-ink-2 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt">
                    <List className="size-[18px]" aria-hidden="true" />
                    History
                </Link>
            </div>
        </section>
    );
};
