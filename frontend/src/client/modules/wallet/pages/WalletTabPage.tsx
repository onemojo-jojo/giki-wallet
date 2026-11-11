import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Plus, RotateCcw } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useWalletModuleStore } from '../store';
import { Transaction, TransactionFilter, formatAmount, matchesFilter, toTransaction } from '../utils/transactionHelpers';
import { TransactionList } from '../components/TransactionList';


const TZ = 'Asia/Karachi';

const FILTERS: { key: TransactionFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'rides', label: 'Rides' },
    { key: 'topups', label: 'Top-ups' },
    { key: 'refunds', label: 'Refunds' },
    { key: 'transfers', label: 'Transfers' },
];

/** The Wallet tab: balance, this month's in/out, and the full filterable history. */
export const WalletTabPage = () => {
    const { balance, transactions, isDataLoading, isHistoryLoading, historyError, fetchBalance, fetchHistory } = useWalletModuleStore();
    // Show the skeleton (not "No transactions yet") until the first history request has finished.
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [filter, setFilter] = useState<TransactionFilter>('all');
    const navigate = useNavigate();

    useEffect(() => {
        void fetchBalance();
        void fetchHistory().finally(() => setHistoryLoaded(true));
    }, [fetchBalance, fetchHistory]);

    const mapped = useMemo(() => transactions.map(toTransaction), [transactions]);

    // Only show the Transfers chip if the user actually has transfers.
    const filters = useMemo(
        () => FILTERS.filter((f) => f.key !== 'transfers' || mapped.some((t) => matchesFilter(t, 'transfers'))),
        [mapped]
    );

    const visible = useMemo(() => mapped.filter((t) => matchesFilter(t, filter)), [mapped, filter]);

    const month = useMemo(() => {
        const key = formatInTimeZone(new Date(), TZ, 'yyyy-MM');
        let spent = 0;
        let added = 0;
        mapped.forEach((t) => {
            if (!t.date.startsWith(key)) return;
            if (t.amount < 0) spent += -t.amount;
            else added += t.amount;
        });
        return { name: formatInTimeZone(new Date(), TZ, 'MMMM'), spent, added };
    }, [mapped]);


    const refresh = () => {
        void fetchBalance();
        void fetchHistory();
    };

    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 pt-1">
            <header className="flex items-center justify-between gap-3">
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-ink leading-none">Wallet</h1>
            </header>

            <section aria-label="Balance" className="bg-card rounded-3xl p-[18px] flex flex-col gap-3.5">
                <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1">
                            <span className="text-[13px] font-bold text-muted-foreground whitespace-nowrap">G-Bux balance</span>
                            <button
                                type="button"
                                onClick={() => setShowBalance((v) => !v)}
                                aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                                className="size-11 -my-2 rounded-[12px] text-muted-foreground hover:text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                            >
                                {showBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={refresh}
                                aria-label="Refresh balance and history"
                                className="size-11 -my-2 rounded-[12px] text-muted-foreground hover:text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                            >
                                <RotateCcw className={cn('size-4', (isDataLoading || isHistoryLoading) && 'animate-spin')} />
                            </button>
                        </span>
                        <span className={cn('font-display font-extrabold text-[40px] leading-none tracking-tight tabular text-ink', isDataLoading && 'opacity-70')} aria-live={showBalance ? 'polite' : 'off'}>
                            {showBalance ? `Rs ${formatAmount(balance)}` : 'Rs ••••'}
                        </span>
                    </div>
                    <Link
                        to="/top-up"
                        className="h-12 px-4 rounded-2xl bg-primary text-primary-foreground font-extrabold text-[15px] flex items-center gap-1.5 hover:bg-iris-strong shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                        Add money
                    </Link>
                </div>

                {showBalance && (
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-background rounded-2xl p-3">
                            <span className="block text-xs font-semibold text-muted-foreground">Out · {month.name}</span>
                            <span className="font-display text-xl font-extrabold text-ink tabular">Rs {formatAmount(month.spent)}</span>
                        </div>
                        <div className="bg-background rounded-2xl p-3">
                            <span className="block text-xs font-semibold text-muted-foreground">In · {month.name}</span>
                            <span className="font-display text-xl font-extrabold text-mint tabular">Rs {formatAmount(month.added)}</span>
                        </div>
                    </div>
                )}
            </section>

            <div role="group" aria-label="Filter transactions" className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        aria-pressed={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            'h-10 px-4 rounded-full text-[13px] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris',
                            filter === f.key ? 'bg-ink text-white font-extrabold' : 'bg-card border-[1.5px] border-input text-ink font-semibold'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {historyError && transactions.length === 0 ? (
                <div role="alert" className="bg-coral-tint rounded-[20px] p-4 flex items-center gap-3">
                    <span className="flex-1 text-sm font-bold text-[#8F1B21]">Couldn't load your transactions.</span>
                    <button
                        type="button"
                        onClick={() => void fetchHistory()}
                        className="h-10 px-4 rounded-xl bg-card text-[#8F1B21] text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-coral"
                    >
                        Retry
                    </button>
                </div>
            ) : (isHistoryLoading || !historyLoaded) && transactions.length === 0 ? (
                <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading transactions">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="bg-card rounded-[20px] p-3.5 flex items-center gap-3">
                            <span className="size-[42px] rounded-[14px] bg-secondary" />
                            <span className="flex-1 flex flex-col gap-2">
                                <span className="h-3 w-2/3 rounded bg-secondary" />
                                <span className="h-2.5 w-1/3 rounded bg-secondary/70" />
                            </span>
                        </div>
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <div className="bg-card rounded-[20px] p-6 text-center flex flex-col items-center gap-2">
                    <span className="font-display text-lg font-extrabold text-ink">
                        {mapped.length === 0 ? 'No transactions yet' : 'Nothing here yet'}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                        {mapped.length === 0 ? 'Add money to get started.' : 'Try another filter.'}
                    </span>
                </div>
            ) : (
                <TransactionList transactions={visible} onSelect={(t: Transaction) => navigate(`/wallet/receipt/${t.id}`)} />
            )}

        </div>
    );
};

export default WalletTabPage;
