import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Eye, EyeOff, History, Plus, RotateCcw } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { useTopUpLimit } from '@/client/modules/wallet/hooks/useTopUpLimit';
import { cn } from '@/lib/utils';

const formatRs = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

/** Midnight balance card: balance, cap meter and the three main money actions. */
export const BalanceHero = () => {
    const { balance, isDataLoading, fetchBalance } = useWalletModuleStore();
    const { onHistoryClick } = useWallet();
    const maxLimit = useTopUpLimit();
    const [showBalance, setShowBalance] = useState(true);

    useEffect(() => {
        void fetchBalance();
    }, [fetchBalance]);

    const capPercent = maxLimit ? Math.min(100, Math.max(0, (balance / maxLimit) * 100)) : null;
    const room = maxLimit ? Math.max(0, maxLimit - balance) : null;

    return (
        <section aria-label="Balance" className="relative overflow-hidden rounded-[28px] bg-ink text-white p-5 flex flex-col gap-5">
            <svg
                aria-hidden="true"
                className="absolute right-0 top-0 h-full w-2/3 pointer-events-none"
                viewBox="0 0 260 240"
                preserveAspectRatio="xMaxYMin slice"
                fill="none"
            >
                <path d="M20 240 C 60 170, 170 190, 180 120 S 150 30, 270 0" stroke="#C8F04A" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />
                <circle cx="180" cy="120" r="5" fill="#C8F04A" fillOpacity="0.6" />
            </svg>

            <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-ink-muted">G-Bux balance</span>
                    <span
                        className={cn('font-display font-extrabold text-[44px] sm:text-[52px] leading-none tracking-tight tabular', isDataLoading && 'opacity-70')}
                        aria-live="polite"
                    >
                        {showBalance ? `Rs ${formatRs(balance)}` : 'Rs ••••'}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowBalance((v) => !v)}
                        aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                        className="size-11 rounded-[14px] bg-ink-2 text-white flex items-center justify-center hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt"
                    >
                        {showBalance ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => void fetchBalance()}
                        aria-label="Refresh balance"
                        className="size-11 rounded-[14px] bg-ink-2 text-white flex items-center justify-center hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt"
                    >
                        <RotateCcw className={cn('size-5', isDataLoading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {capPercent !== null && room !== null && showBalance && (
                <div className="relative flex items-center gap-2.5 -mt-1">
                    <div
                        role="img"
                        aria-label={`Rs ${formatRs(balance)} of Rs ${formatRs(maxLimit!)} wallet cap`}
                        className="w-32 h-1.5 rounded-full bg-ink-3 overflow-hidden"
                    >
                        <div className="h-full rounded-full bg-volt" style={{ width: `${capPercent}%` }} />
                    </div>
                    <span className="text-xs text-[#D9D6F2]">Rs {formatRs(room)} room left</span>
                </div>
            )}

            <div className="relative grid grid-cols-3 gap-2.5">
                <Link
                    to="/top-up"
                    className="h-[52px] rounded-2xl bg-volt text-ink font-extrabold text-sm flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
                >
                    <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                    Add
                </Link>
                <Link
                    to="/transport"
                    className="h-[52px] rounded-2xl bg-ink-2 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt"
                >
                    <Bus className="size-[18px]" aria-hidden="true" />
                    Ride
                </Link>
                <button
                    type="button"
                    onClick={onHistoryClick}
                    className="h-[52px] rounded-2xl bg-ink-2 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt"
                >
                    <History className="size-[18px]" aria-hidden="true" />
                    History
                </button>
            </div>
        </section>
    );
};
