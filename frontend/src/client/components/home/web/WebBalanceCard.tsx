import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { useTopUpLimit } from '@/client/modules/wallet/hooks/useTopUpLimit';

const formatRs = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

/** Web home balance card (v2-Web): balance, cap meter, Add money / Book a ride. */
export const WebBalanceCard = () => {
    const { balance, isDataLoading, fetchBalance } = useWalletModuleStore();
    const maxLimit = useTopUpLimit();
    const [showBalance, setShowBalance] = useState(true);

    useEffect(() => {
        void fetchBalance();
    }, [fetchBalance]);

    const capPercent = maxLimit ? Math.min(100, Math.max(0, (balance / maxLimit) * 100)) : null;
    const room = maxLimit ? Math.max(0, maxLimit - balance) : null;

    return (
        <section aria-label="Balance" className="bg-ink text-white rounded-[28px] p-[26px] flex flex-col gap-[18px]">
            <span className="flex items-center gap-1">
                <span className="text-[13px] font-bold text-ink-muted">G-Bux balance</span>
                <button
                    type="button"
                    onClick={() => setShowBalance((v) => !v)}
                    aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                    className="size-9 rounded-[10px] text-ink-muted hover:text-white flex items-center justify-center focus-visible:outline-2 focus-visible:outline-volt"
                >
                    {showBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button
                    type="button"
                    onClick={() => void fetchBalance()}
                    aria-label="Refresh balance"
                    className="size-9 rounded-[10px] text-ink-muted hover:text-white flex items-center justify-center focus-visible:outline-2 focus-visible:outline-volt"
                >
                    <RotateCcw className={cn('size-4', isDataLoading && 'animate-spin')} />
                </button>
            </span>
            <span className={cn('font-display font-extrabold text-[56px] tracking-[-0.04em] leading-none tabular', isDataLoading && 'opacity-70')} aria-live={showBalance ? 'polite' : 'off'}>
                {showBalance ? `Rs ${formatRs(balance)}` : 'Rs ••••'}
            </span>
            {capPercent !== null && room !== null && showBalance && (
                <div className="flex items-center gap-2.5">
                    <div role="img" aria-label={`Rs ${formatRs(balance)} of Rs ${formatRs(maxLimit!)} cap`} className="flex-1 h-1.5 rounded-full bg-[#3A3478] overflow-hidden">
                        <div className="h-full bg-volt" style={{ width: `${capPercent}%` }} />
                    </div>
                    <span className="text-xs text-[#D9D6F2]">Rs {formatRs(room)} room left</span>
                </div>
            )}
            <div className="flex flex-wrap gap-2.5">
                <Link
                    to="/top-up"
                    className="flex-[1_1_120px] h-[50px] rounded-2xl bg-volt text-ink flex items-center justify-center text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
                >
                    Add money
                </Link>
                <Link
                    to="/transport"
                    className="flex-[1_1_120px] h-[50px] rounded-2xl bg-ink-2 text-white flex items-center justify-center text-[15px] font-bold hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-volt"
                >
                    Book a ride
                </Link>
            </div>
            <Link to="/wallet" className="self-start text-[13px] font-bold text-ink-muted hover:text-white rounded focus-visible:outline-2 focus-visible:outline-volt">
                See history →
            </Link>
        </section>
    );
};
